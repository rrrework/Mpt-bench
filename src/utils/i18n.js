import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getWorkspaceDir } from './workspace.js';

/**
 * 语言配置持久化文件: ~/.mpt/.lang
 */
const LANG_FILE = join(getWorkspaceDir(), '.lang');

let _lang = null;

/**
 * 获取当前语言: 'zh-CN' 或 'en'
 * 优先级: 环境变量 MPT_LANG > ~/.mpt/.lang > 默认 zh-CN
 */
export function getLang() {
  if (_lang) return _lang;
  if (process.env.MPT_LANG === 'en' || process.env.MPT_LANG === 'zh-CN') {
    _lang = process.env.MPT_LANG;
    return _lang;
  }
  if (existsSync(LANG_FILE)) {
    try {
      _lang = readFileSync(LANG_FILE, 'utf-8').trim();
      if (_lang === 'en' || _lang === 'zh-CN') return _lang;
    } catch {}
  }
  _lang = 'zh-CN';
  return _lang;
}

/**
 * 设置并持久化语言
 */
export function setLang(lang) {
  if (lang !== 'zh-CN' && lang !== 'en') lang = 'zh-CN';
  _lang = lang;
  writeFileSync(LANG_FILE, lang, 'utf-8');
}

// ============================================================
// 翻译字典
// ============================================================

const T = {
  'zh-CN': {
    // --- 通用 ---
    version: '版本',
    workspace: '工作目录',
    ok: '确定',
    cancel: '取消',
    exit: '退出',
    back: '返回',
    done: '完成',
    error: '错误',
    success: '成功',
    failed: '失败',
    tip: '提示',

    // --- bin/mpt.js help 顶层 ---
    help_title: 'Model Performance Test (MPT) — 多渠道 LLM 模型性能压测工具',
    help_desc: '用于对 OpenAI 兼容 API 的 LLM 模型进行标准化压力测试，生成详细性能报告（TTFT、TPS、P95/P99、成功率等）。',
    help_agent_title: 'Agent 使用说明',
    help_agent_desc: 'MPT 完全支持非交互式 CLI 操作，Agent 无需进入交互菜单即可完成所有任务。所有配置持久化在 ~/.mpt/config.yaml 中，数据集和报告也集中存储在 ~/.mpt/ 下。',
    help_agent_workflow: '典型 Agent 工作流',
    help_agent_step1: '查看渠道',
    help_agent_step2: '查看可用模型',
    help_agent_step3: '生成数据集',
    help_agent_step4: '执行单模型压测',
    help_agent_step5: '执行模型横评',
    help_agent_step6: '查看报告',
    help_storage_title: '存储路径',
    help_storage_desc: '所有数据存储在用户目录',
    help_config: '用户配置文件（渠道、超时、默认参数）',
    help_datasets: '测试数据集（JSON 格式 Prompt 列表）',
    help_results: '压测报告（带时间戳的 HTML 文件）',
    help_logs: '错误日志（每次压测生成一份）',
    help_options_lang: '显示语言 (zh-CN, en)',
    help_options_config: '指定配置文件路径（默认 ~/.mpt/config.yaml）',
    help_quick_title: '快速开始示例',
    help_quick_menu: '交互式菜单（新手推荐）',
    help_quick_version: '查看版本',
    help_quick_help: '查看所有命令帮助',
    help_quick_env: '环境要求',
    help_quick_node: '首次运行时自动创建 ~/.mpt/ 目录结构',

    // --- bin/mpt.js run --help ---
    run_cmd_desc: '执行 LLM 模型压力测试',
    run_opt_channel: '渠道名称（必填，除非配置文件只有一个渠道）',
    run_opt_all: '对所有启用的渠道执行压测（与 --channel 互斥）',
    run_opt_model: '覆盖渠道的模型ID，用于测试同一渠道下的不同模型',
    run_opt_rpm: '目标 RPM（每分钟请求数），默认取配置文件或 60',
    run_opt_duration: '压测持续时间（秒），默认取配置文件或 120',
    run_opt_concurrent: '最大并发连接数，默认 1000',
    run_opt_dataset: '数据集文件路径，默认 ~/.mpt/datasets/default.json',
    run_opt_output: '报告输出目录，默认 ~/.mpt/results/',
    run_opt_format: '输出格式: text (终端表格) | json (JSON)',
    run_detail_title: '详细参数说明',
    run_detail_channel: '指定要测试的渠道名称，必须与配置文件中的 name 字段一致。若不指定且仅有一个渠道，则自动选择该渠道。',
    run_detail_model: '临时覆盖渠道的 model 字段。不修改配置文件，仅本次压测生效。适用于: 同一渠道有多个模型时，快速切换测试目标。',
    run_detail_rpm: '目标请求速率（Requests Per Minute）。低 RPM (< 10): 使用概率发送，保证精确度。高 RPM (>=600): 自动切换微秒级调度模式。建议范围: 10-600。',
    run_detail_duration: '压测持续时间（秒）。调度器在此时间内按 RPM 速率发送请求。调度结束后会等待所有未完成的请求返回（不设硬超时）。单请求超时由配置文件 timeout 段控制（默认 connect:100s, read:180s, total:300s）。',
    run_detail_concurrent: '允许同时进行的最大请求数。超过此数量后新请求进入等待队列。',
    run_detail_dataset: '测试用 Prompt 数据集。JSON 数组格式，每个元素为字符串或 {content: "..."} 对象。可通过 mpt dataset gen 生成。',
    run_examples_title: '使用示例',
    run_example1: '基础压测（使用配置文件的默认渠道和参数）',
    run_example2: '指定渠道和参数',
    run_example3: '覆盖模型ID（不修改配置文件）',
    run_example4: '指定数据集',
    run_example5: '批量测试所有启用渠道',
    run_output_title: '输出说明',
    run_output_desc: '压测过程实时显示进度条:',
    run_output_sent: '已发: N     — 已发送的请求总数',
    run_output_done: '完成: N(成功/失败) — 已完成（含成功和失败）的请求数',
    run_output_concurrent: '并发: N     — 当前正在执行的请求数',
    run_output_rpm: 'RPM: N      — 当前实际 RPM',
    run_output_resp: '响应: Nms   — 最近 50 个请求的平均响应时间',
    run_output_ttft: 'TTFT: Nms   — 最近 50 个请求的首 Token 延迟',
    run_output_tps: 'TPS: N      — 每秒输出的 Token 数',
    run_output_final: '压测结束后自动生成 HTML 报告和错误日志。',

    // --- benchmark --help ---
    bm_cmd_desc: '模型横评 — 对同一渠道下的多个模型逐个压测，生成对比报告',
    bm_opt_channel: '渠道名称（必填）',
    bm_opt_models: '逗号分隔的模型ID列表，如 "m1,m2,m3"。省略则自动拉取全部可用模型',
    bm_detail_title: '详细说明',
    bm_detail_desc: '模型横评用于对比同一 API 服务商下不同模型的性能表现。系统会逐个调用 mpt run，每次临时覆盖 --model 参数，不修改配置文件。每个模型都会生成独立的带时间戳的 HTML 报告和错误日志。测试结束后输出汇总结果。',
    bm_example1: '指定模型列表',
    bm_example2: '自动拉取全部可用模型（需渠道支持 /v1/models 端点）',

    // --- models --help ---
    ml_cmd_desc: '拉取渠道的可用模型列表（调用 /v1/models 端点）',
    ml_opt_channel: '渠道名称（必填）',
    ml_detail_desc: '调用渠道的 GET /v1/models 端点，列出该 API 服务商提供的所有可用模型ID。支持的 API: OpenAI 兼容接口。不支持的 API: 该端点返回 404，提示手动指定模型。',

    // --- channel --help ---
    ch_cmd_desc: '管理待测渠道配置',
    ch_detail_desc: '渠道代表一个 LLM API 服务端点。每个渠道包含: name（唯一标识）、base_url（API基础地址）、api_key（密钥）、model（默认模型ID）、enabled（是否启用）。配置持久化在 ~/.mpt/config.yaml 的 channels 字段中。',
    ch_list_desc: '列出所有渠道（含启用状态、模型、API地址）',
    ch_add_desc: '添加新渠道',
    ch_remove_desc: '删除渠道',
    ch_enable_desc: '启用渠道（使其参与 mpt run --all 批量测试）',
    ch_disable_desc: '禁用渠道（使其不参与批量测试）',

    // --- dataset --help ---
    ds_cmd_desc: '管理测试数据集（Prompt 集合）',
    ds_detail_desc: '数据集是 JSON 格式的 Prompt 列表，压测时随机抽取发送给模型。生成器会围绕 AI 技术主题（大模型、多模态、AI架构等）创建结构化的技术分析Prompt。',
    ds_gen_example1: '生成 100 条 Prompt，每条约 10KB',
    ds_gen_example2: '生成小规模测试集',

    // --- report --help ---
    rp_cmd_desc: '查看压测报告',
    rp_detail_desc: '每次压测自动生成 HTML 报告（包含 Chart.js TPS 时序图、响应时间分布、错误分析等）和错误日志文件。报告文件名格式: {模型名}_{时间戳}_report.html，不会互相覆盖。',
    rp_latest_desc: '显示最新报告路径，可选浏览器打开',
    rp_list_desc: '列出所有历史报告（文件名、大小、生成时间）',

    // --- src/index.js 交互菜单 ---
    menu_title: '请选择功能',
    menu_section_test: '压测执行',
    menu_section_config: '配置管理',
    menu_section_report: '报告查看',
    menu_section_tools: '工具',
    menu_1: '一键压测 - 自动引导：检查数据集→配置渠道→执行测试（推荐）',
    menu_2: '模型横评 - 选择渠道，自动拉取模型，逐个压测对比性能',
    menu_3: '渠道管理 - 查看/添加/删除/启用/禁用渠道',
    menu_4: '数据集管理 - 生成/导入测试数据集',
    menu_5: '查看最近报告 - 打开最新的压测报告',
    menu_6: '历史报告列表 - 查看所有历史报告',
    menu_0: '更改显示语言 / Switch Language',
    menu_q: '退出 / Quit',
    prompt_menu: '请输入选项，回车确认',
    prompt_invalid: '无效选项，请重新输入（0-6, Q退出）',
    prompt_enter: '按回车键返回...',
    prompt_enter_en: 'Press Enter to return...',
    lang_select_title: '选择语言 / Select Language',
    lang_select_msg: '请选择界面语言 / Please select display language',
    lang_zh: '中文',
    lang_en: 'English',
    lang_switched_zh: '语言已切换为中文 ✓',
    lang_switched_en: 'Language switched to English ✓',
    lang_switch_hint: '重新进入菜单即可查看效果',

    // --- guidedTest ---
    guide_title: '一键压测引导',
    guide_title_en: 'Guided Stress Test',
    guide_no_dataset: '未找到测试数据集。',
    guide_gen_confirm: '是否自动生成测试数据集？（100条，每条10KB）',
    guide_gen_cancelled: '已取消。您可以通过菜单选项4手动生成数据集。',
    guide_dataset_ready: '数据集就绪',
    guide_no_channel: '没有已启用的渠道。',
    guide_add_confirm: '是否添加一个测试渠道？',
    guide_add_cancelled: '已取消。您可以通过菜单选项3管理渠道。',
    guide_channel_name: '渠道名称',
    guide_channel_url: 'API Base URL',
    guide_channel_key: 'API Key',
    guide_channel_model: '模型名称',
    guide_has_channels: '个启用渠道',
    guide_select_channel: '选择要测试的渠道',
    guide_rpm: '目标 RPM（每分钟请求数，建议10-120）',
    guide_duration: '持续时间（秒，建议30-300）',
    guide_concurrent: '最大并发数',
    guide_start: '开始压测',

    // --- modelBenchmark ---
    bm_menu_title: '模型横评',
    bm_menu_desc: '选择一个渠道，自动拉取该渠道下所有可用模型，逐个压测对比性能。',
    bm_menu_no_channel: '没有配置任何渠道。请先通过「渠道管理」添加渠道。',
    bm_menu_select_channel: '选择测试渠道',
    bm_menu_selected: '已选择渠道',
    bm_menu_fetching: '正在拉取可用模型列表...',
    bm_menu_found: '发现 N 个可用模型',
    bm_menu_select_action: '如何选择模型？',
    bm_menu_all: '全部测试 (N 个)',
    bm_menu_select: '手动选择要测试的模型',
    bm_menu_manual: '手动输入模型ID（逗号分隔）',
    bm_menu_select_models: '选择要测试的模型（空格选择，回车确认）',
    bm_menu_cancelled: '已取消。',
    bm_menu_no_models: '没有有效的模型ID。',
    bm_menu_will_test: '将测试 N 个模型',
    bm_menu_no_fetch: '无法自动拉取模型列表（API 不支持 /v1/models）。',
    bm_menu_manual_input: '请手动输入要测试的模型ID（逗号分隔）',
    bm_menu_testing: '测试模型',
    bm_menu_failed: '模型 N 测试失败',
    bm_menu_done: '模型横评完成',
    bm_menu_report_hint: '详细报告请在「查看历史报告」中查看。',

    // --- channelManagement ---
    ch_menu_title: '渠道管理',
    ch_menu_empty: '还没有配置任何渠道。',
    ch_menu_options: '选择操作',
    ch_menu_add: '添加新渠道',
    ch_menu_toggle: '切换启用/禁用',
    ch_menu_remove: '删除渠道',
    ch_menu_select_target: '选择要操作的渠道',
    ch_menu_add_name: '渠道名称（如 SHENYUAN）',
    ch_menu_add_url: 'API Base URL (如 https://api.openai.com/v1)',
    ch_menu_add_key: 'API Key',
    ch_menu_add_model: '默认模型ID',

    // --- 报告查看 ---
    rp_no_reports: '还没有生成过报告',
    rp_no_found: '没有找到报告',
    rp_latest: '最新报告',
    rp_dir: '报告目录',

    // --- 数据集 ---
    ds_menu_title: '数据集操作',
    ds_gen_option: '生成数据集',
    ds_import_option: '导入数据集',
    ds_gen_count: '生成条数',
    ds_gen_size: '每条目标大小(KB)',
    ds_import_file: '请输入要导入的文件路径',

    // --- CLI 输出 ---
    cli_config: '配置文件',
    cli_channel_header: '渠道名称',
    cli_channel_model: '模型',
    cli_channel_url: 'API URL',
    cli_channel_status: '状态',
    cli_channel_enabled: '启用',
    cli_channel_disabled: '禁用',
    cli_channel_total: '共 N 个渠道，N 个已启用',
    cli_dataset_generating: '已生成 N/总数 条，近期平均大小: N KB',
    cli_dataset_done: '数据集生成完成！',
    cli_dataset_file: '文件',
    cli_dataset_count: '条数',
    cli_dataset_avg: '平均大小',
    cli_dataset_total: '总大小',
    cli_dataset_saved: '数据集已保存到',
    cli_dataset_will_use: '后续压测将自动使用此数据集',
    cli_loading_dataset: '加载数据集: N 条 Prompt',
    cli_no_dataset: '数据集文件不存在',
    cli_no_dataset_hint: '提示: 请先运行「菜单选项4」生成数据集，或使用 --dataset 指定路径',
    cli_empty_dataset: '数据集为空',
    cli_no_channel: '没有可用的渠道。请先通过菜单选项3添加并启用渠道。',

    // --- 压测输出 ---
    run_separator: '═',
    run_start: '开始压测',
    run_complete: '压测完成',
    run_total: '总请求',
    run_success: '成功',
    run_fail: '失败',
    run_rate: '成功率',
    run_actual_rpm: '实际 RPM',
    run_avg_resp: '平均响应',
    run_avg_ttft: '平均 TTFT',
    run_tps: '输出 TPS',
    run_report: '报告',
    run_report_generated: '报告已生成',
    run_error_log: '错误日志',
    run_waiting: '压测调度完成，等待 N 个请求返回...',
    run_phase_running: '压测中',
    run_phase_waiting: '等待返回',

    // --- 进度条 ---
    progress_sent: '已发',
    progress_done: '完成',
    progress_ok: 'OK',
    progress_fail: 'FAIL',
    progress_concurrent: '并发',
    progress_rpm: 'RPM',
    progress_resp: '响应',
    progress_ttft: 'TTFT',
    progress_tps: 'TPS',
    progress_total_error: '操作失败',
    progress_back_to_menu: '将返回主菜单...',
  },

  en: {
    version: 'Version',
    workspace: 'Workspace',
    ok: 'OK',
    cancel: 'Cancel',
    exit: 'Exit',
    back: 'Back',
    done: 'Done',
    error: 'Error',
    success: 'Success',
    failed: 'Failed',
    tip: 'Tip',

    help_title: 'Model Performance Test (MPT) — Multi-channel LLM Stress Testing Tool',
    help_desc: 'Standardized stress testing for OpenAI-compatible LLM APIs, generating detailed performance reports (TTFT, TPS, P95/P99, success rate, etc.).',
    help_agent_title: 'Agent Usage Guide',
    help_agent_desc: 'MPT fully supports non-interactive CLI operations. Agents can complete all tasks without entering the interactive menu. All configuration is persisted in ~/.mpt/config.yaml, with datasets and reports stored under ~/.mpt/.',
    help_agent_workflow: 'Typical Agent Workflow',
    help_agent_step1: 'Check channels',
    help_agent_step2: 'Check available models',
    help_agent_step3: 'Generate dataset',
    help_agent_step4: 'Run single-model test',
    help_agent_step5: 'Run model benchmark',
    help_agent_step6: 'View reports',
    help_storage_title: 'Storage Paths',
    help_storage_desc: 'All data stored under user home directory',
    help_config: 'User config (channels, timeouts, defaults)',
    help_datasets: 'Test datasets (JSON Prompt arrays)',
    help_results: 'Test reports (timestamped HTML files)',
    help_logs: 'Error logs (one per test run)',
    help_options_lang: 'Display language (zh-CN, en)',
    help_options_config: 'Config file path (default ~/.mpt/config.yaml)',
    help_quick_title: 'Quick Start',
    help_quick_menu: 'Interactive menu (recommended for beginners)',
    help_quick_version: 'Check version',
    help_quick_help: 'View all command help',
    help_quick_env: 'Requirements',
    help_quick_node: '~/.mpt/ directory auto-created on first run',

    run_cmd_desc: 'Run LLM stress test',
    run_opt_channel: 'Channel name (required unless only one channel exists)',
    run_opt_all: 'Test all enabled channels (mutually exclusive with --channel)',
    run_opt_model: 'Override channel model ID (for testing different models on same channel)',
    run_opt_rpm: 'Target RPM (requests per minute), default from config or 60',
    run_opt_duration: 'Test duration (seconds), default from config or 120',
    run_opt_concurrent: 'Max concurrent connections, default 1000',
    run_opt_dataset: 'Dataset file path, default ~/.mpt/datasets/default.json',
    run_opt_output: 'Report output directory, default ~/.mpt/results/',
    run_opt_format: 'Output format: text (table) | json (JSON)',
    run_detail_title: 'Detailed Parameter Guide',
    run_detail_channel: 'Specify the channel name matching the name field in config. Auto-selects if only one channel exists.',
    run_detail_model: 'Temporarily overrides the channel model field without modifying config file. Useful for testing different models on the same API endpoint.',
    run_detail_rpm: 'Target request rate. Low RPM (< 10): probabilistic dispatch for precision. High RPM (>=600): auto-switch to micro-second scheduler. Recommended range: 10-600.',
    run_detail_duration: 'Test duration in seconds. The scheduler dispatches requests at the target RPM during this period. After scheduling ends, waits for all pending requests to complete (no hard timeout). Individual request timeouts are controlled by the config timeout section (default: connect=100s, read=180s, total=300s).',
    run_detail_concurrent: 'Maximum concurrent requests allowed. Excess requests wait in queue.',
    run_detail_dataset: 'Test Prompt dataset. JSON array format, each element is a string or {content: "..."} object. Generate via mpt dataset gen.',
    run_examples_title: 'Examples',
    run_example1: 'Basic test (using config defaults)',
    run_example2: 'Specify channel and parameters',
    run_example3: 'Override model ID (no config modification)',
    run_example4: 'Specify custom dataset',
    run_example5: 'Batch test all enabled channels',
    run_output_title: 'Output Guide',
    run_output_desc: 'Real-time progress bar during test:',
    run_output_sent: 'Sent: N     — Total requests dispatched',
    run_output_done: 'Done: N(OK/FAIL) — Completed requests',
    run_output_concurrent: 'Active: N   — Currently running requests',
    run_output_rpm: 'RPM: N      — Current actual RPM',
    run_output_resp: 'Resp: Nms   — Avg response time (last 50)',
    run_output_ttft: 'TTFT: Nms   — Avg first-token latency (last 50)',
    run_output_tps: 'TPS: N      — Tokens per second',
    run_output_final: 'HTML report and error log are auto-generated after test completes.',

    bm_cmd_desc: 'Model Benchmark — test multiple models sequentially on one channel',
    bm_opt_channel: 'Channel name (required)',
    bm_opt_models: 'Comma-separated model IDs, e.g. "m1,m2,m3". Omit to auto-fetch all.',
    bm_detail_title: 'Details',
    bm_detail_desc: 'Compare performance of different models on the same API endpoint. Runs mpt run for each model with --model override, without touching config file. Each model generates an independent timestamped HTML report and error log. Summary displayed at the end.',
    bm_example1: 'Specify model list',
    bm_example2: 'Auto-fetch all available models (requires /v1/models endpoint)',

    ml_cmd_desc: 'Fetch available models from a channel (calls /v1/models)',
    ml_opt_channel: 'Channel name (required)',
    ml_detail_desc: 'Calls GET /v1/models to list all available model IDs from the API provider. Supported: OpenAI-compatible APIs. Unsupported: endpoint returns 404, manual model specification required.',

    ch_cmd_desc: 'Manage test channel configuration',
    ch_detail_desc: 'A channel represents an LLM API endpoint. Each channel has: name (unique ID), base_url (API base URL), api_key (secret), model (default model ID), enabled (participation in batch tests). Persisted in ~/.mpt/config.yaml under channels.',
    ch_list_desc: 'List all channels (with status, model, API URL)',
    ch_add_desc: 'Add a new channel',
    ch_remove_desc: 'Remove a channel',
    ch_enable_desc: 'Enable a channel (include in batch tests)',
    ch_disable_desc: 'Disable a channel (exclude from batch tests)',

    ds_cmd_desc: 'Manage test datasets (Prompt collections)',
    ds_detail_desc: 'Datasets are JSON arrays of Prompts, randomly sampled during tests. The generator creates structured technical analysis prompts around AI topics (LLMs, multimodal, AI architecture, etc.).',
    ds_gen_example1: 'Generate 100 prompts, ~10KB each',
    ds_gen_example2: 'Generate small test set',

    rp_cmd_desc: 'View stress test reports',
    rp_detail_desc: 'Each test auto-generates an HTML report (with Chart.js TPS timeline, response time distribution, error analysis) and an error log file. Report filename format: {model}_{timestamp}_report.html — no overwriting.',
    rp_latest_desc: 'Show latest report path, optionally open in browser',
    rp_list_desc: 'List all historical reports (name, size, timestamp)',

    menu_title: 'Select Function',
    menu_section_test: 'Stress Testing',
    menu_section_config: 'Configuration',
    menu_section_report: 'Reports',
    menu_section_tools: 'Tools',
    menu_1: 'Quick Test - guided: check dataset→configure channel→run (recommended)',
    menu_2: 'Model Benchmark - select channel, auto-fetch models, test sequentially',
    menu_3: 'Channel Management - view/add/remove/enable/disable channels',
    menu_4: 'Dataset Management - generate/import test datasets',
    menu_5: 'Latest Report - open most recent report',
    menu_6: 'Report History - list all reports',
    menu_0: 'Switch Language / 切换语言',
    menu_q: 'Quit / 退出',
    prompt_menu: 'Enter option, press Enter to confirm',
    prompt_invalid: 'Invalid option, please enter 0-6 or Q to quit',
    prompt_enter: 'Press Enter to return...',
    prompt_enter_en: 'Press Enter to return...',
    lang_select_title: 'Select Language / 选择语言',
    lang_select_msg: 'Please select display language / 请选择界面语言',
    lang_zh: '中文 (Chinese)',
    lang_en: 'English',
    lang_switched_zh: '语言已切换为中文 ✓',
    lang_switched_en: 'Language switched to English ✓',
    lang_switch_hint: 'Re-enter menu to see changes',

    guide_title: 'Guided Stress Test',
    guide_title_en: 'Guided Stress Test',
    guide_no_dataset: 'No test dataset found.',
    guide_gen_confirm: 'Auto-generate test dataset? (100 prompts, ~10KB each)',
    guide_gen_cancelled: 'Cancelled. Use menu option 4 to manually generate.',
    guide_dataset_ready: 'Dataset ready',
    guide_no_channel: 'No enabled channels.',
    guide_add_confirm: 'Add a test channel?',
    guide_add_cancelled: 'Cancelled. Use menu option 3 to manage channels.',
    guide_channel_name: 'Channel name',
    guide_channel_url: 'API Base URL',
    guide_channel_key: 'API Key',
    guide_channel_model: 'Model name',
    guide_has_channels: 'enabled channel(s)',
    guide_select_channel: 'Select channel to test',
    guide_rpm: 'Target RPM (10-120 recommended)',
    guide_duration: 'Duration (seconds, 30-300 recommended)',
    guide_concurrent: 'Max concurrency',
    guide_start: 'Starting test',

    bm_menu_title: 'Model Benchmark',
    bm_menu_desc: 'Select a channel, auto-fetch available models, test sequentially to compare performance.',
    bm_menu_no_channel: 'No channels configured. Add one via Channel Management.',
    bm_menu_select_channel: 'Select channel',
    bm_menu_selected: 'Selected channel',
    bm_menu_fetching: 'Fetching available models...',
    bm_menu_found: 'Found N models',
    bm_menu_select_action: 'How to select models?',
    bm_menu_all: 'Test all (N models)',
    bm_menu_select: 'Pick models manually',
    bm_menu_manual: 'Enter model IDs (comma-separated)',
    bm_menu_select_models: 'Select models (space to pick, enter to confirm)',
    bm_menu_cancelled: 'Cancelled.',
    bm_menu_no_models: 'No valid model IDs.',
    bm_menu_will_test: 'Will test N models',
    bm_menu_no_fetch: 'Cannot auto-fetch models (API does not support /v1/models).',
    bm_menu_manual_input: 'Enter model IDs (comma-separated)',
    bm_menu_testing: 'Testing model',
    bm_menu_failed: 'Model N test failed',
    bm_menu_done: 'Model benchmark complete',
    bm_menu_report_hint: 'See detailed reports in Report History.',

    ch_menu_title: 'Channel Management',
    ch_menu_empty: 'No channels configured yet.',
    ch_menu_options: 'Select action',
    ch_menu_add: 'Add new channel',
    ch_menu_toggle: 'Toggle enable/disable',
    ch_menu_remove: 'Remove channel',
    ch_menu_select_target: 'Select channel to operate on',
    ch_menu_add_name: 'Channel name (e.g. SHENYUAN)',
    ch_menu_add_url: 'API Base URL (e.g. https://api.openai.com/v1)',
    ch_menu_add_key: 'API Key',
    ch_menu_add_model: 'Default model ID',

    rp_no_reports: 'No reports generated yet',
    rp_no_found: 'No reports found',
    rp_latest: 'Latest report',
    rp_dir: 'Report directory',

    ds_menu_title: 'Dataset Operations',
    ds_gen_option: 'Generate dataset',
    ds_import_option: 'Import dataset',
    ds_gen_count: 'Number of prompts',
    ds_gen_size: 'Target size per prompt (KB)',
    ds_import_file: 'Enter file path to import',

    cli_config: 'Config',
    cli_channel_header: 'Channel',
    cli_channel_model: 'Model',
    cli_channel_url: 'API URL',
    cli_channel_status: 'Status',
    cli_channel_enabled: 'Enabled',
    cli_channel_disabled: 'Disabled',
    cli_channel_total: 'Total: N channels, N enabled',
    cli_dataset_generating: 'Generated N/total, recent avg: N KB',
    cli_dataset_done: 'Dataset generation complete!',
    cli_dataset_file: 'File',
    cli_dataset_count: 'Count',
    cli_dataset_avg: 'Avg Size',
    cli_dataset_total: 'Total Size',
    cli_dataset_saved: 'Dataset saved to',
    cli_dataset_will_use: 'Subsequent tests will auto-use this dataset',
    cli_loading_dataset: 'Loaded dataset: N prompts',
    cli_no_dataset: 'Dataset file not found',
    cli_no_dataset_hint: 'Tip: Generate a dataset via menu option 4, or use --dataset to specify path',
    cli_empty_dataset: 'Dataset is empty',
    cli_no_channel: 'No available channels. Add one via menu option 3.',

    run_separator: '═',
    run_start: 'Starting stress test',
    run_complete: 'Test complete',
    run_total: 'Total requests',
    run_success: 'Success',
    run_fail: 'Failed',
    run_rate: 'Success rate',
    run_actual_rpm: 'Actual RPM',
    run_avg_resp: 'Avg response',
    run_avg_ttft: 'Avg TTFT',
    run_tps: 'Output TPS',
    run_report: 'Report',
    run_report_generated: 'Report generated',
    run_error_log: 'Error log',
    run_waiting: 'Scheduling complete, waiting for N pending requests...',
    run_phase_running: 'Running',
    run_phase_waiting: 'Waiting',

    progress_sent: 'Sent',
    progress_done: 'Done',
    progress_ok: 'OK',
    progress_fail: 'FAIL',
    progress_concurrent: 'Active',
    progress_rpm: 'RPM',
    progress_resp: 'Resp',
    progress_ttft: 'TTFT',
    progress_tps: 'TPS',
    progress_total_error: 'Operation failed',
    progress_back_to_menu: 'Returning to menu...',
  },
};

/**
 * 获取翻译文本
 * @param {string} key - 翻译键
 * @param {object} [replacements] - 替换变量 {key: value}
 */
export function t(key, replacements) {
  const lang = getLang();
  let text = T[lang][key] || T['zh-CN'][key] || key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(new RegExp(k, 'g'), String(v));
    }
  }
  return text;
}

export default { t, getLang, setLang };
