import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, getChannel, getEnabledChannels, resolveConfigPath } from '../utils/config.js';
import { getDatasetsDir, getResultsDir, getDefaultDatasetPath } from '../utils/workspace.js';
import { runScheduler } from '../engine/scheduler.js';
import { StatsCollector } from '../engine/stats.js';
import { generateHtmlReport } from '../reporter/html.js';
import { errorLogger } from '../utils/logger.js';

/**
 * 从渠道的 /v1/models 端点拉取可用模型列表
 */
export async function fetchModels(channel) {
  const url = `${channel.base_url || channel.baseUrl}/models`;
  const apiKey = channel.api_key || channel.apiKey;
  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data?.map(m => m.id) || null;
  } catch {
    return null;
  }
}

export async function runCommand(cmdOptions) {
  const config = loadConfig(cmdOptions.config);

  // 合并参数
  const rpm = parseInt(cmdOptions.rpm) || config.defaults.rpm;
  const duration = parseInt(cmdOptions.duration) || config.defaults.duration;
  const maxConcurrent = parseInt(cmdOptions.concurrent) || config.defaults.max_concurrent;

  // 确定渠道
  let channels = [];
  if (cmdOptions.all) {
    channels = getEnabledChannels(config);
  } else if (cmdOptions.channel) {
    const ch = getChannel(config, cmdOptions.channel);
    if (!ch) {
      throw new Error(`渠道 "${cmdOptions.channel}" 未找到或未启用`);
    }
    channels = [ch];
  } else {
    channels = getEnabledChannels(config).slice(0, 1);
  }
  if (channels.length === 0) {
    throw new Error('没有可用的渠道。请先通过菜单选项4添加并启用渠道。');
  }

  // 加载数据集 — 支持多路径搜索
  const datasetPath = cmdOptions.dataset || '';
  const candidates = datasetPath
    ? [datasetPath, resolve(getDatasetsDir(), datasetPath)]
    : [getDefaultDatasetPath()];
  let resolvedDatasetPath = null;
  for (const p of candidates) {
    if (existsSync(p)) { resolvedDatasetPath = p; break; }
  }
  if (!resolvedDatasetPath) {
    throw new Error(
      `数据集文件不存在: ${datasetPath || 'default.json'}\n` +
      `提示: 请先运行「菜单选项5」生成数据集，或使用 --dataset 指定路径`,
    );
  }
  const raw = JSON.parse(readFileSync(resolvedDatasetPath, 'utf-8'));
  const dataset = raw.map(item => (typeof item === 'string' ? item : item.content)).filter(Boolean);
  if (dataset.length === 0) {
    throw new Error('数据集为空');
  }
  console.log(`加载数据集: ${dataset.length} 条 Prompt (${resolvedDatasetPath})`);

  // 报告输出目录
  const outputDir = getResultsDir();
  mkdirSync(outputDir, { recursive: true });

  const results = [];

  for (const channel of channels) {
    // 支持 --model 参数覆盖渠道的模型（不修改配置文件）
    const effectiveChannel = cmdOptions.model
      ? { ...channel, model: cmdOptions.model, name: cmdOptions.model }
      : channel;

    const stats = new StatsCollector();
    const mergedOptions = {
      rpm,
      duration,
      maxConcurrent,
      connectTimeout: config.timeout?.connect || 100,
      readTimeout: config.timeout?.read || 180,
      totalTimeout: config.timeout?.total || 300,
      maxTokens: config.request?.max_tokens || 2048,
      temperature: config.request?.temperature ?? 0.7,
      scheduleMode: config.defaults?.schedule_mode || 'adaptive',
      secondThreshold: config.defaults?.second_threshold || 600,
    };

    console.log(`\n========================================`);
    console.log(`[${effectiveChannel.name}] 开始压测 RPM=${rpm} Duration=${duration}s`);
    console.log(`========================================\n`);

    // 初始化错误日志
    errorLogger.init(effectiveChannel.name);

    await runScheduler(effectiveChannel, dataset, stats, mergedOptions);

    // 关闭错误日志
    errorLogger.close();

    console.log(`\n========================================`);
    console.log(`压测完成: ${effectiveChannel.name}`);
    console.log(`总请求: ${stats.getTotalRequests()}, 成功: ${stats.successCount}, 失败: ${stats.failureCount}`);
    console.log(`成功率: ${stats.getSuccessRate().toFixed(2)}%`);
    console.log(`实际 RPM: ${stats.getActualRpm().toFixed(1)} / ${rpm}`);
    const respArr = stats.responseTimes;
    if (respArr.length > 0) {
      const sorted = [...respArr].sort((a, b) => a - b);
      const avg = respArr.reduce((a, b) => a + b, 0) / respArr.length * 1000;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] * 1000;
      console.log(`平均响应: ${avg.toFixed(0)}ms, P95: ${p95.toFixed(0)}ms`);
    }
    if (stats.ttftTimes.length > 0) {
      console.log(`平均 TTFT: ${(stats.ttftTimes.reduce((a, b) => a + b, 0) / stats.ttftTimes.length * 1000).toFixed(0)}ms`);
    }
    console.log(`输出 TPS: ${stats.getCompletionTps().toFixed(1)} tokens/s`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = effectiveChannel.name.replace(/[\/\\:*?"<>|]/g, '_');
    const reportFile = `${safeName}_${timestamp}_report.html`;
    const reportPath = resolve(outputDir, reportFile);
    generateHtmlReport(stats, {
      modelName: effectiveChannel.name,
      targetRpm: rpm,
      duration,
      config: {
        maxConcurrent,
        connectTimeout: mergedOptions.connectTimeout,
        readTimeout: mergedOptions.readTimeout,
        totalTimeout: mergedOptions.totalTimeout,
        maxTokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
      },
    }, reportPath);
    console.log(`报告: ${reportPath}`);
    console.log(`========================================`);

    results.push({
      channel: channel.name,
      model: channel.model,
      totalRequests: stats.getTotalRequests(),
      successRate: stats.getSuccessRate(),
      actualRpm: stats.getActualRpm(),
      completionTps: stats.getCompletionTps(),
      report: reportPath,
    });
  }

  if (cmdOptions.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  }
}
