/**
 * 工具调用测试 Worker — 非流式请求，验证 tool_choice=required 下的 tool_calls 返回率
 */
export async function executeToolTestCall(channel, scenario, options) {
  const startTime = Date.now() / 1000;
  const url = `${channel.base_url || channel.baseUrl}/chat/completions`;

  const body = {
    messages: [{ role: 'user', content: scenario.prompt }],
    model: channel.model,
    tools: scenario.tools,
    tool_choice: 'required',        // 核心：强制要求调用工具
    temperature: options.temperature ?? 0.7,
    stream: false,                   // 非流式，需要获取完整 tool_calls
  };

  const controller = new AbortController();
  const timeoutMs = (options.timeout || 60) * 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channel.api_key || channel.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const elapsed = Date.now() / 1000 - startTime;

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        scenarioName: scenario.name,
        prompt: scenario.prompt.slice(0, 100),
        success: false,
        hasToolCalls: false,
        toolCount: 0,
        calledTools: [],
        modelOutput: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        errorMessage: `HTTPError: ${response.status} - ${text.slice(0, 200)}`,
        responseTimeMs: elapsed * 1000,
      };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    // 检查 tool_calls
    const toolCalls = message?.tool_calls || [];
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
    const calledTools = hasToolCalls
      ? toolCalls.map(tc => tc.function?.name || 'unknown')
      : [];

    // 构建输出描述
    let modelOutput = '';
    if (hasToolCalls) {
      modelOutput = toolCalls.map(tc => {
        const fn = tc.function;
        const args = fn?.arguments ? JSON.stringify(JSON.parse(fn.arguments)) : '{}';
        return `tool:${fn?.name}(${args})`;
      }).join(' | ');
    }
    if (message?.content) {
      modelOutput = modelOutput ? `${modelOutput} | content:${message.content}` : `content:${message.content}`;
    }
    if (!modelOutput) modelOutput = '(无输出)';

    return {
      scenarioName: scenario.name,
      prompt: scenario.prompt.slice(0, 100) + (scenario.prompt.length > 100 ? '...' : ''),
      success: hasToolCalls,
      hasToolCalls,
      toolCount: toolCalls.length,
      calledTools,
      modelOutput,
      responseTimeMs: elapsed * 1000,
      rawResponse: data, // 保留完整响应用于调试
    };
  } catch (e) {
    clearTimeout(timer);
    const elapsed = Date.now() / 1000 - startTime;
    let errorType = 'Unknown';
    let errorMessage = e.message;
    if (e.name === 'AbortError') {
      errorType = 'Timeout';
      errorMessage = `请求超时 (超过${options.timeout || 60}s)`;
    } else if (e.code === 'ECONNREFUSED') {
      errorType = 'ConnectionError';
      errorMessage = '连接被拒绝';
    }

    return {
      scenarioName: scenario.name,
      prompt: scenario.prompt.slice(0, 100),
      success: false,
      hasToolCalls: false,
      toolCount: 0,
      calledTools: [],
      modelOutput: `[${errorType}] ${errorMessage}`,
      errorMessage: `${errorType}: ${errorMessage}`,
      responseTimeMs: elapsed * 1000,
    };
  }
}
