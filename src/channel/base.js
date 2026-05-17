export class ChannelAdapter {
  constructor({ name, baseUrl, apiKey, model } = {}) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  buildUrl() {
    return `${this.baseUrl}/chat/completions`;
  }

  buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  buildPayload(prompt, options = {}) {
    return {
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      max_tokens: options.maxTokens || 2048,
      stream: options.stream !== false,
      temperature: options.temperature ?? 0.7,
    };
  }
}
