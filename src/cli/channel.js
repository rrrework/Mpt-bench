import { loadConfig } from '../utils/config.js';
import { getConfigPath } from '../utils/workspace.js';
import yaml from 'js-yaml';
import { writeFileSync } from 'fs';

function resolveConfigPath(options) {
  // 优先级: options.parent.config > options.config > ~/.mpt/config.yaml
  return options?.parent?.config || options?.config || getConfigPath();
}

function saveConfig(configPath, config) {
  writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }), 'utf-8');
}

export function channelList(options) {
  const configPath = resolveConfigPath(options);
  const cfg = loadConfig(configPath);
  if (options?.format === 'json') {
    console.log(JSON.stringify(cfg.channels, null, 2));
    return;
  }
  console.log(`配置文件: ${configPath}\n`);
  console.log('渠道名称         模型              API URL                                    状态');
  console.log('-'.repeat(100));
  for (const ch of cfg.channels) {
    const name = (ch.name || '').padEnd(16);
    const model = (ch.model || '').padEnd(16);
    const url = (ch.base_url || ch.baseUrl || '').padEnd(42);
    const status = ch.enabled ? '[启用]' : '[禁用]';
    console.log(`${name} ${model} ${url} ${status}`);
  }
  console.log(`\n共 ${cfg.channels.length} 个渠道，${cfg.channels.filter(c => c.enabled).length} 个已启用`);
}

export function channelAdd(options) {
  const configPath = resolveConfigPath(options);
  const cfg = loadConfig(configPath);
  if (cfg.channels.some(ch => ch.name === options.name)) {
    throw new Error(`渠道 "${options.name}" 已存在`);
  }
  cfg.channels.push({
    name: options.name,
    base_url: options.url,
    api_key: options.key,
    model: options.model,
    enabled: true,
  });
  saveConfig(configPath, cfg);
  console.log(`渠道 "${options.name}" 添加成功`);
}

export function channelRemove(options) {
  const configPath = resolveConfigPath(options);
  const cfg = loadConfig(configPath);
  const before = cfg.channels.length;
  cfg.channels = cfg.channels.filter(ch => ch.name !== options.name);
  if (cfg.channels.length === before) {
    throw new Error(`渠道 "${options.name}" 未找到`);
  }
  saveConfig(configPath, cfg);
  console.log(`渠道 "${options.name}" 删除成功`);
}

export function channelEnable(options) {
  const configPath = resolveConfigPath(options);
  const cfg = loadConfig(configPath);
  const ch = cfg.channels.find(c => c.name === options.name);
  if (!ch) {
    throw new Error(`渠道 "${options.name}" 未找到`);
  }
  ch.enabled = true;
  saveConfig(configPath, cfg);
  console.log(`渠道 "${options.name}" 已启用`);
}

export function channelDisable(options) {
  const configPath = resolveConfigPath(options);
  const cfg = loadConfig(configPath);
  const ch = cfg.channels.find(c => c.name === options.name);
  if (!ch) {
    throw new Error(`渠道 "${options.name}" 未找到`);
  }
  ch.enabled = false;
  saveConfig(configPath, cfg);
  console.log(`渠道 "${options.name}" 已禁用`);
}
