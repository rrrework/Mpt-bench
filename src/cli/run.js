import { readFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, getChannel, getEnabledChannels, resolveConfigPath } from '../utils/config.js';
import { getDatasetsDir, getResultsDir, getDefaultDatasetPath } from '../utils/workspace.js';
import { runScheduler } from '../engine/scheduler.js';
import { StatsCollector } from '../engine/stats.js';
import { generateHtmlReport } from '../reporter/html.js';
import { generateXlsxReport } from '../reporter/xlsx.js';
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

export function loadDatasetWithMeta(resolvedDatasetPath) {
  const raw = JSON.parse(readFileSync(resolvedDatasetPath, 'utf-8'));

  if (Array.isArray(raw)) {
    const items = raw
      .map(item => (typeof item === 'string' ? item : item?.content))
      .filter(Boolean);
    return { items, meta: {}, path: resolvedDatasetPath };
  }

  if (raw && typeof raw === 'object' && Array.isArray(raw.items)) {
    const items = raw.items
      .map(item => (typeof item === 'string' ? item : item?.content))
      .filter(Boolean);
    return { items, meta: raw.meta || {}, path: resolvedDatasetPath };
  }

  throw new Error('数据集格式不支持：需要数组格式或 { meta, items } 格式');
}

export function resolveScenario(cmdOptions, datasetMeta, datasetPath) {
  if (cmdOptions.scenario) return cmdOptions.scenario;
  if (datasetMeta?.scenario) return datasetMeta.scenario;

  const lower = (datasetPath || '').toLowerCase();
  if (lower.includes('long-summary') || lower.includes('long_summary')) return 'long-summary';
  if (lower.includes('short')) return 'short';
  return 'default';
}

export async function runCommand(cmdOptions, deps = {}) {
  const loadConfigFn = deps.loadConfig || loadConfig;
  const getChannelFn = deps.getChannel || getChannel;
  const getEnabledChannelsFn = deps.getEnabledChannels || getEnabledChannels;
  const getDefaultDatasetPathFn = deps.getDefaultDatasetPath || getDefaultDatasetPath;
  const getResultsDirFn = deps.getResultsDir || getResultsDir;
  const runSchedulerFn = deps.runScheduler || runScheduler;
  const generateHtmlReportFn = deps.generateHtmlReport || generateHtmlReport;
  const errorLoggerInstance = deps.errorLogger || errorLogger;
  const emit = deps.emit || console.log;
  const isJsonMode = cmdOptions.format === 'json';
  const log = isJsonMode ? (() => {}) : emit;

  const config = loadConfigFn(cmdOptions.config);

  // 合并参数
  const rpm = parseInt(cmdOptions.rpm) || config.defaults.rpm;
  const duration = parseInt(cmdOptions.duration) || config.defaults.duration;
  const maxConcurrent = parseInt(cmdOptions.concurrent) || config.defaults.max_concurrent;

  // 确定渠道
  let channels = [];
  if (cmdOptions.all) {
    channels = getEnabledChannelsFn(config);
  } else if (cmdOptions.channel) {
    const ch = getChannelFn(config, cmdOptions.channel);
    if (!ch) {
      throw new Error(`渠道 "${cmdOptions.channel}" 未找到或未启用`);
    }
    channels = [ch];
  } else {
    channels = getEnabledChannelsFn(config).slice(0, 1);
  }
  if (channels.length === 0) {
    throw new Error('没有可用的渠道。请先通过菜单选项4添加并启用渠道。');
  }

  // 加载数据集 — 支持多路径搜索
  const datasetPath = cmdOptions.dataset || '';
  const candidates = datasetPath
    ? [datasetPath, resolve(getDatasetsDir(), datasetPath)]
    : [getDefaultDatasetPathFn()];
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
  const loaded = loadDatasetWithMeta(resolvedDatasetPath);
  const dataset = loaded.items;
  const datasetMeta = loaded.meta || {};
  const scenario = resolveScenario(cmdOptions, datasetMeta, resolvedDatasetPath);
  if (dataset.length === 0) {
    throw new Error('数据集为空');
  }
  log(`加载数据集: ${dataset.length} 条 Prompt (${resolvedDatasetPath})`);
  log(`场景: ${scenario}`);

  // 报告输出目录
  const outputDir = cmdOptions.output ? resolve(cmdOptions.output) : getResultsDirFn();
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

    log(`\n========================================`);
    log(`[${effectiveChannel.name}] 开始压测 RPM=${rpm} Duration=${duration}s`);
    log(`========================================\n`);

    // 初始化错误日志
    errorLoggerInstance.init(effectiveChannel.name);

    await runSchedulerFn(effectiveChannel, dataset, stats, mergedOptions);

    // 关闭错误日志
    errorLoggerInstance.close();

    log(`\n========================================`);
    log(`压测完成: ${effectiveChannel.name}`);
    log(`总请求: ${stats.getTotalRequests()}, 成功: ${stats.successCount}, 失败: ${stats.failureCount}`);
    log(`成功率: ${stats.getSuccessRate().toFixed(2)}%`);
    log(`实际 RPM: ${stats.getActualRpm().toFixed(1)} / ${rpm}`);
    const respArr = stats.responseTimes;
    if (respArr.length > 0) {
      const sorted = [...respArr].sort((a, b) => a - b);
      const avg = respArr.reduce((a, b) => a + b, 0) / respArr.length * 1000;
      const p95 = sorted[Math.floor(sorted.length * 0.95)] * 1000;
      log(`平均响应: ${avg.toFixed(0)}ms, P95: ${p95.toFixed(0)}ms`);
    }
    if (stats.ttftTimes.length > 0) {
      log(`平均 TTFT: ${(stats.ttftTimes.reduce((a, b) => a + b, 0) / stats.ttftTimes.length * 1000).toFixed(0)}ms`);
    }
    log(`输出 TPS: ${stats.getCompletionTps().toFixed(1)} tokens/s`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = effectiveChannel.name.replace(/[\/\\:*?"<>|]/g, '_');
    const safeScenario = (scenario || 'default').replace(/[\/\\:*?"<>|]/g, '_');
    const reportFile = `${safeName}_${safeScenario}_${timestamp}_report.html`;
    const reportPath = resolve(outputDir, reportFile);
    const reportOptions = {
      modelName: effectiveChannel.name,
      targetRpm: rpm,
      duration,
      scenario,
      dataset: {
        path: resolvedDatasetPath,
        count: dataset.length,
        corpus: datasetMeta?.corpus || null,
      },
      silent: isJsonMode,
      config: {
        maxConcurrent,
        connectTimeout: mergedOptions.connectTimeout,
        readTimeout: mergedOptions.readTimeout,
        totalTimeout: mergedOptions.totalTimeout,
        maxTokens: mergedOptions.maxTokens,
        temperature: mergedOptions.temperature,
      },
      apiUrl: channel.base_url || channel.baseUrl || 'N/A',
      timestamp: new Date().toISOString(),
      scheduleMode: mergedOptions.scheduleMode,
      stream: config.request?.stream ?? true,
    };
    generateHtmlReportFn(stats, reportOptions, reportPath);

    const xlsxFile = reportFile.replace('_report.html', '_report.xlsx');
    const xlsxPath = resolve(outputDir, xlsxFile);
    generateXlsxReport(stats, reportOptions, xlsxPath);

    log(`报告: ${reportPath}`);
    log(`报告: ${xlsxPath}`);
    log(`========================================`);

    results.push({
      channel: effectiveChannel.name,
      model: effectiveChannel.model,
      scenario,
      totalRequests: stats.getTotalRequests(),
      successRate: stats.getSuccessRate(),
      actualRpm: stats.getActualRpm(),
      completionTps: stats.getCompletionTps(),
      report: reportPath,
      xlsx: xlsxPath,
    });
  }

  if (cmdOptions.format === 'json') {
    emit(JSON.stringify(results, null, 2));
  }
}
