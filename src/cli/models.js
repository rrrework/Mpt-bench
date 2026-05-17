import { loadConfig, getChannel } from '../utils/config.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * mpt models — 拉取渠道的可用模型列表
 * 用法: mpt models --channel SHENYUAN
 */
export async function modelsCommand(opts) {
  const config = loadConfig(opts.config);
  const channel = getChannel(config, opts.channel);
  if (!channel) {
    throw new Error(`渠道 "${opts.channel}" 未找到。请先通过 mpt channel add 添加。`);
  }

  const url = `${channel.base_url || channel.baseUrl}/models`;
  const apiKey = channel.api_key || channel.apiKey;

  console.log(`正在从 ${channel.name} (${url}) 拉取模型列表...\n`);

  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
    const data = await resp.json();
    const models = data.data?.map(m => m.id) || [];

    if (models.length === 0) {
      console.log('未找到可用模型（该端点可能不支持 /v1/models）');
      return;
    }

    console.log(`共 ${models.length} 个可用模型:\n`);
    for (const m of models) {
      console.log(`  ${m}`);
    }
    console.log(`\n提示: 使用 mpt run --channel ${opts.channel} --model <模型ID> 对单个模型压测`);
    console.log(`      使用 mpt benchmark --channel ${opts.channel} --models ${models.slice(0, 3).join(',')},... 批量测试`);
  } catch (e) {
    console.log(`拉取失败: ${e.message}`);
    console.log('该渠道可能不支持 /v1/models 端点，请手动指定模型ID。');
  }
}
