/**
 * Promise-based Semaphore — 异步并发控制（对齐 Python asyncio.Semaphore）
 */
export class Semaphore {
  constructor(max) {
    this._max = max;
    this._current = 0;
    this._queue = [];
  }

  async acquire() {
    if (this._current < this._max) {
      this._current++;
      return;
    }
    await new Promise(resolve => this._queue.push(resolve));
    this._current++;
  }

  release() {
    this._current--;
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      next();
    }
  }
}
