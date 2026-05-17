import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getLogsDir } from '../utils/workspace.js';

class ErrorLogger {
  constructor() {
    this._stream = null;
    this._modelName = 'unknown';
  }

  /**
   * 初始化日志文件（每次压测开始时调用）
   */
  init(modelName) {
    this._modelName = modelName;
    const logsDir = getLogsDir();
    // 将模型名中的特殊字符替换为安全字符（防止路径问题）
    const safeName = modelName.replace(/[\/\\:*?"<>|]/g, '_');
    const filename = `${safeName}_${new Date().toISOString().replace(/[:.]/g, '-')}_error.log`;
    const filepath = join(logsDir, filename);

    mkdirSync(logsDir, { recursive: true });
    this._stream = createWriteStream(filepath, { flags: 'a', encoding: 'utf-8' });
    this._stream.write(`\n${'='.repeat(80)}\nMPT 压测错误日志 | 模型: ${modelName} | 开始: ${new Date().toISOString()}\n${'='.repeat(80)}\n`);
    console.log(`错误日志: ${filepath}`);
    return filepath;
  }

  /**
   * 记录错误
   */
  log(requestId, errorType, errorMsg, details = {}) {
    if (!this._stream) return;
    const timestamp = new Date().toISOString();
    const entry = [
      `\n${'─'.repeat(60)}`,
      `[${timestamp}] [${requestId}] ${errorType}`,
      `  错误: ${errorMsg ? String(errorMsg).slice(0, 300) : 'Unknown'}`,
      details.statusCode ? `  HTTP状态: ${details.statusCode}` : '',
      details.xRequestId ? `  x-request-id: ${details.xRequestId}` : '',
      details.responseBody ? `  响应: ${String(details.responseBody).slice(0, 300)}` : '',
      details.elapsed ? `  耗时: ${(details.elapsed * 1000).toFixed(0)}ms` : '',
    ].filter(Boolean).join('\n');
    this._stream.write(entry + '\n');
  }

  /**
   * 记录调试信息
   */
  debug(requestId, message) {
    if (!this._stream) return;
    const timestamp = new Date().toISOString();
    this._stream.write(`[${timestamp}] [DEBUG] [${requestId}] ${message}\n`);
  }

  /**
   * 关闭日志
   */
  close() {
    if (this._stream) {
      this._stream.write(`\n${'='.repeat(80)}\n压测结束 | ${new Date().toISOString()}\n${'='.repeat(80)}\n`);
      this._stream.end();
      this._stream = null;
    }
  }
}

// 全局单例
export const errorLogger = new ErrorLogger();
