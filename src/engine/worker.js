import { errorLogger } from '../utils/logger.js';

export async function executeRequest(channel, prompt, stats, requestId, sendTimestamp, options) {
  const startTime = Date.now() / 1000;
  let firstTokenTime = null;
  const url = `${channel.base_url || channel.baseUrl}/chat/completions`;

  const body = {
    messages: [{ role: 'user', content: prompt }],
    model: channel.model,
    max_tokens: options.maxTokens || 2048,
    stream: true,
    temperature: options.temperature ?? 0.7,
  };

  // --- 三层超时配置（对齐 Python aiohttp.ClientTimeout）---
  const connectTimeoutMs = (options.connectTimeout || 100) * 1000;
  const readTimeoutMs = (options.readTimeout || 180) * 1000;
  const totalTimeoutMs = (options.totalTimeout || 300) * 1000;

  // 总超时控制器 — 覆盖整个请求生命周期（连接+读取）
  const totalController = new AbortController();
  const totalTimer = setTimeout(() => totalController.abort(), totalTimeoutMs);

  // 连接阶段超时
  const connectController = new AbortController();
  const connectTimer = setTimeout(() => connectController.abort(), connectTimeoutMs);

  // 合并两个 abort signal：任一触发都中断 fetch
  const combinedSignal = AbortSignal.any([totalController.signal, connectController.signal]);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channel.api_key || channel.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });
    clearTimeout(connectTimer);

    const xRequestId = response.headers.get('x-request-id') || 'N/A';

    if (!response.ok) {
      const elapsed = Date.now() / 1000 - startTime;
      const text = await response.text().catch(() => '');
      errorLogger.log(requestId, 'HTTP_ERROR', `HTTP ${response.status}: ${text.slice(0, 200)}`, {
        statusCode: response.status, xRequestId, responseBody: text, elapsed,
      });
      stats.addFailure(
        elapsed, sendTimestamp, requestId,
        'HTTP_ERROR', `HTTP ${response.status}: ${text.slice(0, 200)}`,
        response.status, text, xRequestId,
      );
      return false;
    }

    // --- 流式读取 ---
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usageInfo = null;
    const responseContent = []; // 收集响应内容用于 Token 估算

    // 读取超时 Promise
    const readTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('READ_TIMEOUT')), readTimeoutMs);
    });

    // 总超时 Promise（读取阶段也要检查）
    const totalTimeoutPromise = new Promise((_, reject) => {
      const remaining = totalTimeoutMs - (Date.now() - startTime * 1000);
      if (remaining <= 0) {
        reject(new Error('TOTAL_TIMEOUT'));
      } else {
        setTimeout(() => reject(new Error('TOTAL_TIMEOUT')), remaining);
      }
    });

    const readLoop = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          try {
            const chunk = JSON.parse(data);
            if (!firstTokenTime) {
              firstTokenTime = Date.now() / 1000;
              errorLogger.debug(requestId, `首token到达 TTFT: ${((firstTokenTime - startTime) * 1000).toFixed(0)}ms`);
            }
            if (chunk.usage) usageInfo = chunk.usage;
            // 收集 delta content 用于 Token 估算 fallback
            if (chunk.choices?.[0]?.delta?.content) {
              responseContent.push(chunk.choices[0].delta.content);
            }
          } catch (e) { /* ignore parse errors in SSE chunks */ }
        }
      }
    };

    try {
      await Promise.race([readLoop(), readTimeoutPromise, totalTimeoutPromise]);
    } catch (e) {
      reader.cancel().catch(() => {});
      const elapsed = Date.now() / 1000 - startTime;
      const errorType = e.message === 'READ_TIMEOUT' ? 'READ_TIMEOUT'
        : e.message === 'TOTAL_TIMEOUT' ? 'TOTAL_TIMEOUT' : 'TIMEOUT';
      errorLogger.log(requestId, errorType, e.message, { elapsed, xRequestId });
      stats.addFailure(
        elapsed, sendTimestamp, requestId,
        errorType, e.message, null, null, xRequestId,
      );
      return false;
    }

    const elapsed = Date.now() / 1000 - startTime;
    const ttft = firstTokenTime ? firstTokenTime - startTime : elapsed;

    // 构建 responseJson：优先用 API 返回的 usage，否则用内容估算
    let responseJson = null;
    if (usageInfo) {
      responseJson = { usage: usageInfo };
    } else if (responseContent.length > 0) {
      // fallback: 根据实际响应内容长度估算 token（中文：字符数/2）
      const fullContent = responseContent.join('');
      const estimatedCompletionTokens = Math.max(1, Math.floor(fullContent.length / 2));
      const estimatedPromptTokens = Math.max(1, Math.floor(prompt.length / 2));
      responseJson = {
        usage: {
          prompt_tokens: estimatedPromptTokens,
          completion_tokens: estimatedCompletionTokens,
          total_tokens: estimatedPromptTokens + estimatedCompletionTokens,
          _estimated: true, // 标记为估算值
        },
      };
    }

    stats.addSuccess(elapsed, sendTimestamp, requestId, ttft, responseJson);
    return true;
  } catch (e) {
    clearTimeout(connectTimer);
    const elapsed = Date.now() / 1000 - startTime;
    let errorType = 'UNKNOWN_ERROR';
    if (e.name === 'AbortError') {
      // 判断是连接超时还是总超时
      if (totalController.signal.aborted) errorType = 'TOTAL_TIMEOUT';
      else if (connectController.signal.aborted) errorType = 'CONNECT_TIMEOUT';
      else errorType = 'CONNECT_TIMEOUT';
    }
    else if (e.message?.includes('READ_TIMEOUT')) errorType = 'READ_TIMEOUT';
    else if (e.message?.includes('TOTAL_TIMEOUT')) errorType = 'TOTAL_TIMEOUT';
    else if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') errorType = 'CONNECTION_ERROR';
    errorLogger.log(requestId, errorType, e.message, { elapsed });
    stats.addFailure(elapsed, sendTimestamp, requestId, errorType, e.message);
    return false;
  } finally {
    clearTimeout(totalTimer);
  }
}
