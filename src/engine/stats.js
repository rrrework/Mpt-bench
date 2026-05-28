const MAX_DEQUE = 100000;
const MAX_ERRORS = 1000;
const MAX_REQUESTS = 50000;

export class StatsCollector {
  constructor() {
    this.successCount = 0;
    this.failureCount = 0;
    this.responseTimes = [];
    this.ttftTimes = [];
    this.sentTimestamps = [];
    this.errorMessages = [];
    this.errorCodes = new Map();
    this.requests = [];
    this.connectTimeoutErrors = 0;
    this.readTimeoutErrors = 0;
    this.totalTimeoutErrors = 0;
    this.serverErrors = 0;
    this.connectionErrors = 0;
    this.rateLimitErrors = 0;
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalTokens = 0;
    this.completionTokensBySecond = {};
    this.promptTokensBySecond = {};
    this.startTime = null;
    this.endTime = null;
    this.stopFlag = false;
  }

  _pushDeque(arr, value) {
    arr.push(value);
    if (arr.length > MAX_DEQUE) arr.shift();
  }

  addSuccess(elapsed, sendTimestamp, requestId, ttft = null, responseJson = null) {
    this.successCount++;
    this._pushDeque(this.responseTimes, elapsed);
    this._pushDeque(this.sentTimestamps, sendTimestamp);
    if (ttft !== null) this._pushDeque(this.ttftTimes, ttft);

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (responseJson && responseJson.usage) {
      const u = responseJson.usage;
      promptTokens = u.prompt_tokens || 0;
      completionTokens = u.completion_tokens || 0;
      totalTokens = u.total_tokens || (promptTokens + completionTokens);
    } else {
      // fallback estimate
      promptTokens = 1664;
      completionTokens = 2048;
      totalTokens = promptTokens + completionTokens;
    }

    this.totalPromptTokens += promptTokens;
    this.totalCompletionTokens += completionTokens;
    this.totalTokens += totalTokens;

    const secondKey = Math.floor(sendTimestamp);
    this.completionTokensBySecond[secondKey] =
      (this.completionTokensBySecond[secondKey] || 0) + completionTokens;
    this.promptTokensBySecond[secondKey] =
      (this.promptTokensBySecond[secondKey] || 0) + promptTokens;

    if (this.requests.length < MAX_REQUESTS) {
      this.requests.push({
        requestId, status: 'SUCCESS', elapsed: elapsed * 1000,
        ttft: ttft !== null ? ttft * 1000 : null,
        promptTokens, completionTokens, totalTokens, httpStatus: 200,
      });
    }
  }

  addFailure(elapsed, sendTimestamp, requestId, errorType, errorMsg, statusCode = null, responseBody = null, xRequestId = null) {
    this.failureCount++;
    this._pushDeque(this.responseTimes, elapsed);
    this._pushDeque(this.sentTimestamps, sendTimestamp);

    const msg = errorMsg ? String(errorMsg).slice(0, 200) : 'Unknown error';
    if (this.errorMessages.length < MAX_ERRORS) {
      this.errorMessages.push(`[${requestId}] ${msg}`);
    }

    if (statusCode) {
      const key = `HTTP_${statusCode}`;
      this.errorCodes.set(key, (this.errorCodes.get(key) || 0) + 1);
      if (statusCode >= 500 && statusCode < 600) this.serverErrors++;
      else if (statusCode === 429) this.rateLimitErrors++;
    } else {
      this.errorCodes.set(errorType, (this.errorCodes.get(errorType) || 0) + 1);
    }

    // 超时分类
    if (errorType === 'CONNECT_TIMEOUT') this.connectTimeoutErrors++;
    else if (errorType === 'READ_TIMEOUT') this.readTimeoutErrors++;
    else if (errorType === 'TOTAL_TIMEOUT') this.totalTimeoutErrors++;
    else if (String(errorType).toLowerCase().includes('timeout')) { /* generic timeout */ }
    else if (String(errorType).toLowerCase().includes('connection')) this.connectionErrors++;

    if (this.requests.length < MAX_REQUESTS) {
      this.requests.push({
        requestId, status: 'FAILED', elapsed: elapsed * 1000,
        ttft: null, promptTokens: 0, completionTokens: 0, totalTokens: 0,
        httpStatus: statusCode || null, errorType, errorMsg: msg,
      });
    }
  }

  getTotalRequests() {
    return this.successCount + this.failureCount;
  }

  getSuccessRate() {
    const t = this.getTotalRequests();
    return t > 0 ? (this.successCount / t * 100) : 0;
  }

  getActualRpm() {
    if (this.startTime && this.endTime && this.endTime > this.startTime) {
      return this.getTotalRequests() / ((this.endTime - this.startTime) / 60);
    }
    return 0;
  }

  getActualRps() {
    if (this.startTime && this.endTime && this.endTime > this.startTime) {
      return this.getTotalRequests() / (this.endTime - this.startTime);
    }
    return 0;
  }

  getTokenTps() {
    if (this.startTime && this.endTime && this.endTime > this.startTime) {
      return this.totalTokens / (this.endTime - this.startTime);
    }
    return 0;
  }

  getCompletionTps() {
    if (this.startTime && this.endTime && this.endTime > this.startTime) {
      return this.totalCompletionTokens / (this.endTime - this.startTime);
    }
    return 0;
  }

  getMaxTpsPerSecond() {
    const vals = Object.values(this.completionTokensBySecond);
    return vals.length > 0 ? Math.max(...vals) : 0;
  }

  getAvgTpsPerSecond() {
    if (!this.startTime || !this.endTime) return 0;
    const totalSeconds = Math.floor(this.endTime - this.startTime) + 1;
    let sum = 0;
    for (let s = Math.floor(this.startTime); s <= Math.floor(this.endTime); s++) {
      sum += (this.completionTokensBySecond[s] || 0);
    }
    return totalSeconds > 0 ? sum / totalSeconds : 0;
  }

  getActualInterval() {
    if (this.sentTimestamps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < this.sentTimestamps.length; i++) {
        sum += this.sentTimestamps[i] - this.sentTimestamps[i - 1];
      }
      return sum / (this.sentTimestamps.length - 1);
    }
    return 0;
  }
}
