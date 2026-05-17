import { executeRequest } from './worker.js';
import { Semaphore } from './semaphore.js';

export async function runScheduler(channel, dataset, stats, options) {
  const { rpm, duration, maxConcurrent } = options;
  const rps = rpm / 60;

  stats.startTime = Date.now() / 1000;
  let requestId = 0;
  let sentCount = 0;
  const pending = new Set();
  const semaphore = new Semaphore(maxConcurrent);

  const dispatch = async (id, sendTime) => {
    await semaphore.acquire();
    try {
      const prompt = dataset[Math.floor(Math.random() * dataset.length)];
      await executeRequest(channel, prompt, stats, id, sendTime, options);
    } finally {
      semaphore.release();
    }
  };

  /**
   * 单行进度条，使用 \r 覆盖
   */
  const printProgress = () => {
    const total = stats.getTotalRequests();
    const elapsed = Date.now() / 1000 - stats.startTime;
    if (elapsed <= 0) return;

    const phase = elapsed < duration ? '压测中' : '等待返回';
    const remaining = elapsed < duration ? Math.ceil(duration - elapsed) : 0;
    const pct = Math.min(100, (elapsed / duration) * 100);
    const barLen = 20;
    const filled = Math.round(pct / 100 * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    const currentRpm = total > 0 ? (total / elapsed) * 60 : 0;
    const recent = stats.responseTimes.slice(-50);
    const avgResp = recent.length > 0
      ? recent.reduce((a, b) => a + b, 0) / recent.length * 1000
      : 0;
    const recentTtft = stats.ttftTimes.slice(-50);
    const avgTtft = recentTtft.length > 0
      ? recentTtft.reduce((a, b) => a + b, 0) / recentTtft.length * 1000
      : 0;
    const tps = elapsed > 0 ? stats.totalCompletionTokens / elapsed : 0;
    const activeConcurrent = semaphore._max - semaphore._current;

    process.stdout.write(
      `\r[${bar}] ${pct.toFixed(0)}% ${phase} ${remaining}s ` +
      `已发:${sentCount} 完成:${total}(${stats.successCount}OK/${stats.failureCount}FAIL) ` +
      `并发:${activeConcurrent} ` +
      `RPM:${currentRpm.toFixed(1)} ` +
      `响应:${avgResp.toFixed(0)}ms ` +
      `TTFT:${avgTtft.toFixed(0)}ms ` +
      `TPS:${tps.toFixed(1)}   `,
    );
  };

  // 启动独立的后台进度刷新器
  const progressInterval = setInterval(printProgress, 500);

  // 统一使用精细调度（100ms slot）
  const SLOT_MS = 100;
  const totalSlots = Math.floor(duration * 1000 / SLOT_MS);
  const requestsPerSlot = rps * (SLOT_MS / 1000);

  let accumulator = 0;

  try {
    for (let slot = 0; slot < totalSlots; slot++) {
      if (stats.stopFlag) break;

      const slotStart = Date.now() / 1000;

      accumulator += requestsPerSlot;
      while (accumulator >= 1) {
        const id = `s${slot}-${requestId}`;
        const sendTime = Date.now() / 1000;
        const p = dispatch(id, sendTime).then(() => pending.delete(p));
        pending.add(p);
        requestId++;
        sentCount++;
        accumulator -= 1;
      }

      const slotElapsed = Date.now() / 1000 - slotStart;
      const sleepTime = SLOT_MS / 1000 - slotElapsed;
      if (sleepTime > 0) await new Promise(r => setTimeout(r, sleepTime * 1000));
    }

    // 调度结束，等待所有请求完成（和 Python 参考一致：无限等待）
    // 每个 request 自身有 connectTimeout/readTimeout/totalTimeout 控制单请求超时
    if (pending.size > 0) {
      process.stdout.write(`\n\n压测调度完成，等待 ${pending.size} 个请求返回...\n`);
      await Promise.allSettled([...pending]);
    }
  } finally {
    clearInterval(progressInterval);
  }

  stats.endTime = Date.now() / 1000;
  printProgress();
  process.stdout.write('\n');
}
