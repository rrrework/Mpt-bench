import { loadConfig, getChannel } from '../utils/config.js';
import { createRequire } from 'module';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);

/**
 * mpt benchmark — 模型横评 CLI 版本
 * 用法: mpt benchmark --channel MY_CHANNEL --models model-a,model-b --rpm 30 --duration 60
 *       省略 --models 则自动拉取所有可用模型
 */
export async function benchmarkCommand(opts) {
  const config = loadConfig(opts.config);
  const channel = getChannel(config, opts.channel);
  if (!channel) {
    throw new Error(`渠道 "${opts.channel}" 未找到。请先通过 mpt channel add 添加。`);
  }

  const rpm = parseInt(opts.rpm) || config.defaults?.rpm || 30;
  const duration = parseInt(opts.duration) || config.defaults?.duration || 60;
  const maxConcurrent = parseInt(opts.concurrent) || config.defaults?.max_concurrent || 50;

  // Step 1: 确定模型列表
  let modelIds = [];
  if (opts.models) {
    modelIds = opts.models.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    // 自动拉取
    console.log('未指定 --models，正在自动拉取可用模型列表...');
    const url = `${channel.base_url || channel.baseUrl}/models`;
    const apiKey = channel.api_key || channel.apiKey;
    try {
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        modelIds = data.data?.map(m => m.id) || [];
      }
    } catch (e) {
      console.log(`自动拉取失败: ${e.message}`);
    }
    if (modelIds.length === 0) {
      throw new Error('未指定 --models 且自动拉取模型列表失败。请使用 --models 手动指定。');
    }
  }

  if (modelIds.length === 0) {
    throw new Error('模型列表为空');
  }

  // Step 2: 检查数据集
  const { getDefaultDatasetPath, getDatasetsDir } = await import('../utils/workspace.js');
  const { datasetGen } = await import('./dataset.js');

  let datasetPath = opts.dataset || '';
  if (datasetPath) {
    const { resolve } = await import('path');
    const candidates = [datasetPath, resolve(getDatasetsDir(), datasetPath)];
    let found = false;
    for (const p of candidates) {
      if (existsSync(p)) { datasetPath = p; found = true; break; }
    }
    if (!found) throw new Error(`数据集文件不存在: ${datasetPath}`);
  } else {
    datasetPath = getDefaultDatasetPath();
    if (!existsSync(datasetPath)) {
      console.log('未找到数据集，自动生成...');
      await datasetGen({ count: '100', sizeKb: '10', output: 'default.json' });
    }
  }

  // Step 3: 执行
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`模型横评: ${channel.name} (${channel.base_url || channel.baseUrl})`);
  console.log(`模型数量: ${modelIds.length}`);
  console.log(`参数: RPM=${rpm}, Duration=${duration}s, 并发=${maxConcurrent}`);
  console.log(`${'═'.repeat(60)}\n`);

  const { runCommand } = await import('./run.js');
  const results = [];

  for (let i = 0; i < modelIds.length; i++) {
    const modelId = modelIds[i];
    console.log(`[${i + 1}/${modelIds.length}] 测试模型: ${modelId}`);

    try {
      await runCommand({
        channel: channel.name,
        model: modelId,
        rpm: String(rpm),
        duration: String(duration),
        concurrent: String(maxConcurrent),
        dataset: datasetPath ? (opts.dataset || undefined) : undefined,
        config: opts.config,
      });
      results.push({ model: modelId, status: 'success' });
    } catch (e) {
      console.log(`  失败: ${e.message}`);
      results.push({ model: modelId, status: 'failed', error: e.message });
    }
  }

  // Step 4: 汇总
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`模型横评完成: ${channel.name}`);
  console.log(`${'═'.repeat(60)}`);
  for (const r of results) {
    const icon = r.status === 'success' ? 'OK' : 'FAIL';
    console.log(`  [${icon}] ${r.model}${r.error ? ` — ${r.error}` : ''}`);
  }
  console.log(`\n详细报告请在 mpt report list 中查看。`);
}
