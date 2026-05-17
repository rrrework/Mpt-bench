import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..', '..');
const MPT_HOME = join(homedir(), '.mpt');

let _initialized = false;

/**
 * 获取 MPT 工作目录（~/.mpt/），首次运行时自动初始化
 */
export function getWorkspaceDir() {
  if (!_initialized && !existsSync(MPT_HOME)) {
    mkdirSync(join(MPT_HOME, 'datasets'), { recursive: true });
    mkdirSync(join(MPT_HOME, 'results'), { recursive: true });
    mkdirSync(join(MPT_HOME, 'logs'), { recursive: true });

    // 从包内复制默认配置
    const defaultConfig = join(PKG_ROOT, 'config', 'default.yaml');
    const userConfig = join(MPT_HOME, 'config.yaml');
    if (existsSync(defaultConfig)) {
      copyFileSync(defaultConfig, userConfig);
    } else {
      writeFileSync(userConfig, getMinimalConfig(), 'utf-8');
    }
    console.log(`已创建 MPT 工作目录: ${MPT_HOME}\n`);
  }
  _initialized = true;
  return MPT_HOME;
}

export function getConfigPath() {
  return join(getWorkspaceDir(), 'config.yaml');
}

export function getDatasetsDir() {
  return join(getWorkspaceDir(), 'datasets');
}

export function getResultsDir() {
  return join(getWorkspaceDir(), 'results');
}

export function getDefaultDatasetPath() {
  return join(getDatasetsDir(), 'default.json');
}

export function getLogsDir() {
  const dir = join(getWorkspaceDir(), 'logs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 跨平台打开文件/URL（浏览器、文件夹等）
 */
export function openFile(filePath) {
  const cmd = platform() === 'win32'
    ? `start "" "${filePath}"`
    : platform() === 'darwin'
      ? `open "${filePath}"`
      : `xdg-open "${filePath}"`;
  exec(cmd, (err) => {
    if (err) console.error(`无法打开: ${err.message}`);
  });
}

function getMinimalConfig() {
  return `# MPT 默认配置 - 自动生成
defaults:
  rpm: 60
  duration: 120
  max_concurrent: 1000
  schedule_mode: adaptive
  second_threshold: 600

timeout:
  connect: 100
  read: 180
  total: 300

request:
  max_tokens: 2048
  temperature: 0.7
  stream: true

report:
  output_dir: "~/.mpt/results"
  filename: "{model}_stress_test_report.html"

channels:
  - name: "glm-5.1"
    base_url: "https://www.sophnet.com/api/open-apis/v1"
    api_key: "YOUR_API_KEY_HERE"
    model: "GLM-5.1"
    enabled: true
`;
}
