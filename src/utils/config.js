import yaml from 'js-yaml';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getConfigPath } from './workspace.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');

/**
 * 加载配置文件。
 * 查找顺序:
 *   1. 用户显式指定的 configPath（绝对/相对路径）
 *   2. ~/.mpt/config.yaml（工作目录配置）
 *   3. 包内置的 config/default.yaml（兜底）
 */
export function loadConfig(configPath) {
  const candidates = configPath
    ? [configPath]
    : [getConfigPath(), join(PKG_ROOT, 'config', 'default.yaml')];

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8');
        return yaml.load(raw);
      } catch (e) {
        throw new Error(`配置文件加载失败 (${p}): ${e.message}`);
      }
    }
  }
  throw new Error(`配置文件未找到，已搜索: ${candidates.join(', ')}`);
}

/**
 * 获取实际使用的配置文件路径（用于 saveConfig 时写入正确的位置）
 */
export function resolveConfigPath(configPath) {
  if (configPath && existsSync(configPath)) return configPath;
  const wsPath = getConfigPath();
  if (existsSync(wsPath)) return wsPath;
  return join(PKG_ROOT, 'config', 'default.yaml');
}

export function getChannel(config, channelName) {
  if (!config || !config.channels) return null;
  return config.channels.find(ch => ch.name === channelName && ch.enabled) || null;
}

export function getEnabledChannels(config) {
  if (!config || !config.channels) return [];
  return config.channels.filter(ch => ch.enabled);
}
