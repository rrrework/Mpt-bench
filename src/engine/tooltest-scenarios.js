/**
 * LLM 工具调用测试场景定义
 * Ported from test/test_scenarios.py
 *
 * 3 种测试模式：
 * 1. simple   — 简单验证（固定 prompt+工具，重复请求验证 tool_choice=required 稳定性）
 * 2. multi    — 多场景验证（不同业务场景下的工具调用准确性）
 * 3. boundary — 边界测试（极端/异常输入下的鲁棒性）
 */

// ============================================================
// 工具定义（OpenAI Function Calling 格式）
// ============================================================

export const CALCULATOR_TOOL = {
  type: 'function',
  function: {
    name: 'calculator',
    description: '执行数学计算',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: "要计算的数学表达式，如 '123 + 456'" },
      },
      required: ['expression'],
    },
  },
};

export const WEATHER_TOOL = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: '查询指定城市的天气信息',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: "城市名称，如 '北京'、'上海'" },
        date: { type: 'string', description: "日期，如 '今天'、'明天'、'2024-01-01'" },
      },
      required: ['city'],
    },
  },
};

export const FILE_READ_TOOL = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '读取指定路径的文件内容',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径' },
      },
      required: ['path'],
    },
  },
};

export const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '执行网络搜索',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        limit: { type: 'integer', description: '返回结果数量', default: 10 },
      },
      required: ['query'],
    },
  },
};

export const TRANSLATE_TOOL = {
  type: 'function',
  function: {
    name: 'translate',
    description: '将文本翻译成指定语言',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '要翻译的文本' },
        target_language: { type: 'string', description: "目标语言，如 'en'、'zh'、'ja'" },
      },
      required: ['text', 'target_language'],
    },
  },
};

export const NO_PARAM_TOOL = {
  type: 'function',
  function: {
    name: 'get_current_time',
    description: '获取当前时间',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export const AMBIGUOUS_TOOL = {
  type: 'function',
  function: {
    name: 'do_something',
    description: '做一些事情',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: '输入' },
      },
      required: ['input'],
    },
  },
};

// ============================================================
// 1. 简单验证场景
// ============================================================

export const SIMPLE_SCENARIOS = [
  {
    name: '简单验证-计算工具',
    description: '固定 prompt 和计算器工具，重复发送请求验证 tool_choice=required 稳定性',
    prompt: '请帮我计算 256 乘以 1024 等于多少？',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '简单验证-天气工具',
    description: '固定 prompt 和天气工具',
    prompt: '查询北京今天的天气',
    tools: [WEATHER_TOOL],
  },
];

// ============================================================
// 2. 多场景验证
// ============================================================

export const MULTI_SCENARIOS = [
  {
    name: '场景-数学计算',
    description: '明确的数学计算请求，应调用 calculator 工具',
    prompt: '计算 (123 + 456) * 789 的结果',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '场景-天气查询',
    description: '天气查询请求，应调用 get_weather 工具',
    prompt: '上海明天的天气怎么样？适合出门吗？',
    tools: [WEATHER_TOOL],
  },
  {
    name: '场景-文件读取',
    description: '文件读取请求，应调用 read_file 工具',
    prompt: '请帮我读取 /home/user/documents/report.txt 文件的内容',
    tools: [FILE_READ_TOOL],
  },
  {
    name: '场景-网络搜索',
    description: '信息检索请求，应调用 web_search 工具',
    prompt: '搜索一下 Python 3.12 的新特性',
    tools: [SEARCH_TOOL],
  },
  {
    name: '场景-翻译',
    description: '翻译请求，应调用 translate 工具',
    prompt: "把 'Hello, how are you today?' 翻译成日语",
    tools: [TRANSLATE_TOOL],
  },
  {
    name: '场景-多工具选择',
    description: '提供多个工具，prompt 明确指向其中一个',
    prompt: '我想知道东京现在的温度',
    tools: [CALCULATOR_TOOL, WEATHER_TOOL, FILE_READ_TOOL],
  },
  {
    name: '场景-复杂多工具',
    description: '提供多个工具，prompt 可能触发多个工具调用',
    prompt: '计算一下北京到上海的距离，然后查一下上海明天的天气',
    tools: [CALCULATOR_TOOL, WEATHER_TOOL, SEARCH_TOOL],
  },
];

// ============================================================
// 3. 边界测试场景
// ============================================================

export const BOUNDARY_SCENARIOS = [
  {
    name: '边界-极短prompt',
    description: '极短的 prompt，测试模型是否仍强制调用工具',
    prompt: 'Hi',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '边界-单字prompt',
    description: '单个汉字的 prompt',
    prompt: '算',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '边界-空prompt',
    description: '空的 prompt（API 可能直接报错）',
    prompt: '',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '边界-无意义乱码',
    description: '完全无意义的输入',
    prompt: 'asdkjfhalksdjfhlkasjdf',
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '边界-无参数工具',
    description: '工具没有任何参数',
    prompt: '现在几点了？',
    tools: [NO_PARAM_TOOL],
  },
  {
    name: '边界-模糊工具描述',
    description: '工具描述非常模糊，测试模型是否能处理',
    prompt: '帮我处理一下这个数据',
    tools: [AMBIGUOUS_TOOL],
  },
  {
    name: '边界-prompt与工具无关',
    description: 'prompt 内容与所有工具都无关，测试是否仍强制调用',
    prompt: '请给我讲一个关于太空探险的故事',
    tools: [CALCULATOR_TOOL, WEATHER_TOOL],
  },
  {
    name: '边界-超长prompt',
    description: '超长 prompt，测试模型处理能力',
    prompt: '请计算以下数字的总和：' + Array.from({ length: 100 }, (_, i) => i + 1).join(' + '),
    tools: [CALCULATOR_TOOL],
  },
  {
    name: '边界-多工具无关prompt',
    description: '多个工具，prompt 与所有工具都无关',
    prompt: '你喜欢什么颜色？',
    tools: [CALCULATOR_TOOL, WEATHER_TOOL, FILE_READ_TOOL, SEARCH_TOOL],
  },
];
