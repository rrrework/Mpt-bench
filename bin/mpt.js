#!/usr/bin/env node
/**
 * MPT CLI 入口
 * 用法: npx mpt [command] [options]
 *       不带参数时进入交互式菜单
 */
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getWorkspaceDir } from '../src/utils/workspace.js';
import { setLang, getLang } from '../src/utils/i18n.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// 确保工作目录初始化
getWorkspaceDir();

const program = new Command();

program
  .name('mpt')
  .description(
`Model Performance Test (MPT) — 多渠道 LLM 模型性能压测工具

用于对 OpenAI 兼容 API 的 LLM 模型进行标准化压力测试，生成详细性能报告（TTFT、TPS、P95/P99、成功率等）。

═══ Agent 使用说明 ═══

MPT 完全支持非交互式 CLI 操作，Agent 无需进入交互菜单即可完成所有任务。
所有配置持久化在 ~/.mpt/config.yaml 中，数据集和报告也集中存储在 ~/.mpt/ 下。

典型 Agent 工作流:
  1. 查看渠道:  mpt channel list
  2. 查看可用模型: mpt models --channel <渠道名>
  3. 生成数据集: mpt dataset gen -n 100 -s 10
  4. 执行单模型压测: mpt run --channel <渠道> --model <模型> --rpm 30 --duration 60
  5. 执行模型横评: mpt benchmark --channel <渠道> --models m1,m2 --rpm 30 --duration 60
  6. 查看报告: mpt report list && mpt report latest --open

═══ 存储路径 ═══

所有数据存储在用户目录: ~/.mpt/
  config.yaml           用户配置文件（渠道、超时、默认参数）
  datasets/             测试数据集（JSON 格式 Prompt 列表）
  results/              压测报告（带时间戳的 HTML 文件）
  logs/                 错误日志（每次压测生成一份）`
  )
  .version(pkg.version)
  .option('-l, --lang <lang>', 'Display language (zh-CN | en)', (v) => {
    if (v === 'en' || v === 'zh-CN') setLang(v);
    return v;
  }, getLang())
  .option('-c, --config <path>', 'Specify config file path (default ~/.mpt/config.yaml)')
  .addHelpText('after', `
═══ 快速开始示例 ═══

  # 交互式菜单（新手推荐）
  npx mpt

  # 查看版本
  npx mpt --version

  # 查看所有命令帮助
  npx mpt --help
  npx mpt run --help
  npx mpt benchmark --help

═══ 环境要求 ═══

  Node.js >= 18.0.0
  首次运行时自动创建 ~/.mpt/ 目录结构
`);

// ===================================================================
// mpt run — 单模型/单渠道压测
// ===================================================================
program.command('run')
  .description('执行 LLM 模型压力测试')
  .option('--channel <name>', '渠道名称（必填，除非配置文件只有一个渠道）')
  .option('-a, --all', '对所有启用的渠道执行压测（与 --channel 互斥）')
  .option('-m, --model <id>', '覆盖渠道的模型ID，用于测试同一渠道下的不同模型')
  .option('-r, --rpm <number>', '目标 RPM（每分钟请求数），默认取配置文件或 60')
  .option('-d, --duration <seconds>', '压测持续时间（秒），默认取配置文件或 120')
  .option('--concurrent <number>', '最大并发连接数，默认 1000')
  .option('--dataset <path>', '数据集文件路径，默认 ~/.mpt/datasets/default.json')
  .option('-o, --output <dir>', '报告输出目录，默认 ~/.mpt/results/')
  .option('-f, --format <type>', '输出格式: text (终端表格) | json (JSON)', 'text')
  .addHelpText('after', `
═══ 详细参数说明 ═══

--channel    指定要测试的渠道名称，必须与配置文件中的 name 字段一致。
             若不指定且仅有一个渠道，则自动选择该渠道。

--model      临时覆盖渠道的 model 字段。不修改配置文件，仅本次压测生效。
             适用于: 同一渠道有多个模型时，快速切换测试目标。

--rpm        目标请求速率（Requests Per Minute）。
             低 RPM (< 10): 使用概率发送，保证精确度。
             高 RPM (>=600): 自动切换微秒级调度模式。
             建议范围: 10-600。

--duration   压测持续时间（秒）。调度器在此时间内按 RPM 速率发送请求。
             调度结束后会等待所有未完成的请求返回（不设硬超时）。
             单请求超时由配置文件 timeout 段控制（默认 connect:100s, read:180s, total:300s）。

--concurrent 允许同时进行的最大请求数。超过此数量后新请求进入等待队列。

--dataset    测试用 Prompt 数据集。JSON 数组格式，每个元素为字符串或 {content: "..."} 对象。
             可通过 mpt dataset gen 生成。

═══ 使用示例 ═══

  # 基础压测（使用配置文件的默认渠道和参数）
  npx mpt run

  # 指定渠道和参数
  npx mpt run --channel SHENYUAN --rpm 30 --duration 60 --concurrent 50

  # 覆盖模型ID（不修改配置文件）
  npx mpt run --channel SHENYUAN --model t_wz_glm-5 --rpm 20 --duration 30

  # 指定数据集
  npx mpt run --dataset my_prompts.json --rpm 60

  # 批量测试所有启用渠道
  npx mpt run --all --rpm 30 --duration 120

═══ 输出说明 ═══

压测过程实时显示进度条:
  已发: N     — 已发送的请求总数
  完成: N(成功/失败) — 已完成（含成功和失败）的请求数
  并发: N     — 当前正在执行的请求数
  RPM: N      — 当前实际 RPM
  响应: Nms   — 最近 50 个请求的平均响应时间
  TTFT: Nms   — 最近 50 个请求的首 Token 延迟
  TPS: N      — 每秒输出的 Token 数

压测结束后自动生成 HTML 报告和错误日志。
`)
  .action(async (opts) => {
    const { runCommand } = await import('../src/cli/run.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try {
      await runCommand(opts);
    } catch (e) {
      console.error(`错误: ${e.message}`);
      process.exit(1);
    }
  });

// ===================================================================
// mpt benchmark — 模型横评
// ===================================================================
program.command('benchmark')
  .description('模型横评 — 对同一渠道下的多个模型逐个压测，生成对比报告')
  .option('--channel <name>', '渠道名称（必填）')
  .option('--models <ids>', '逗号分隔的模型ID列表，如 "m1,m2,m3"。省略则自动拉取全部可用模型')
  .option('-r, --rpm <number>', '目标 RPM', '30')
  .option('-d, --duration <seconds>', '持续时间（秒）', '60')
  .option('--concurrent <number>', '最大并发数', '50')
  .option('--dataset <path>', '数据集文件路径')
  .addHelpText('after', `
═══ 详细说明 ═══

模型横评用于对比同一 API 服务商下不同模型的性能表现。
系统会逐个调用 mpt run，每次临时覆盖 --model 参数，不修改配置文件。

每个模型都会生成独立的带时间戳的 HTML 报告和错误日志。
测试结束后输出汇总结果。

═══ 使用示例 ═══

  # 指定模型列表
  npx mpt benchmark --channel SHENYUAN --models t_wz_deepseek-v4-pro,t_wz_glm-5,t_wz_glm-5.1 --rpm 30 --duration 60

  # 自动拉取全部可用模型（需渠道支持 /v1/models 端点）
  npx mpt benchmark --channel SHENYUAN --rpm 20 --duration 30
`)
  .action(async (opts) => {
    const { benchmarkCommand } = await import('../src/cli/benchmark.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try {
      await benchmarkCommand(opts);
    } catch (e) {
      console.error(`错误: ${e.message}`);
      process.exit(1);
    }
  });

// ===================================================================
// mpt models — 查看渠道可用模型
// ===================================================================
program.command('models')
  .description('拉取渠道的可用模型列表（调用 /v1/models 端点）')
  .option('--channel <name>', '渠道名称（必填）')
  .addHelpText('after', `
═══ 详细说明 ═══

调用渠道的 GET /v1/models 端点，列出该 API 服务商提供的所有可用模型ID。

支持的 API: OpenAI 兼容接口
不支持的 API: 该端点返回 404，提示手动指定模型

═══ 使用示例 ═══

  npx mpt models --channel SHENYUAN
`)
  .action(async (opts) => {
    const { modelsCommand } = await import('../src/cli/models.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try {
      await modelsCommand(opts);
    } catch (e) {
      console.error(`错误: ${e.message}`);
      process.exit(1);
    }
  });

// ===================================================================
// mpt tool-test — 工具调用正确性测试
// ===================================================================
program.command('tool-test')
  .description('LLM 工具调用正确性测试 — 验证 tool_choice=required 时 tool_calls 返回率')
  .option('--channel <name>', '渠道名称（必填）')
  .option('-m, --model <id>', '覆盖渠道的模型ID')
  .option('--mode <type>', '测试模式: simple | multi | boundary | all', 'all')
  .option('--simple-iters <n>', '简单验证每个场景迭代次数', '5')
  .option('--multi-iters <n>', '多场景验证每个场景迭代次数', '5')
  .option('--boundary-iters <n>', '边界测试每个场景迭代次数', '5')
  .option('--concurrency <n>', '最大并发数', '3')
  .option('--single', '单请求调试模式：发送1个请求并打印完整 API 响应 JSON')
  .addHelpText('after', `
═══ 详细说明 ═══

测试 LLM API 在 tool_choice="required" 设置下，是否能 100% 返回 tool_calls。

3 种模式可分别设置迭代次数:
  --simple-iters   简单验证迭代次数（计算器+天气，默认5）
  --multi-iters    多场景迭代次数（7种业务场景，默认5）
  --boundary-iters 边界测试迭代次数（8种极端场景，默认5）

输出: HTML 报告 + JSON 详细结果 + 错误日志

═══ 使用示例 ═══

  # 快速验证
  npx mpt tool-test --channel SHENYUAN --mode all

  # 简单验证 100 次（对齐 Python 参考）
  npx mpt tool-test --channel SHENYUAN --mode simple --simple-iters 100

  # 全模式，不同迭代次数
  npx mpt tool-test --channel SHENYUAN --mode all --simple-iters 50 --multi-iters 30 --boundary-iters 10

  # 边界测试，指定模型
  npx mpt tool-test --channel SHENYUAN --mode boundary --boundary-iters 20 --model t_wz_glm-5
`)
  .action(async (opts) => {
    const { toolTestCommand } = await import('../src/cli/tooltest.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try {
      await toolTestCommand(opts);
    } catch (e) {
      console.error(`错误: ${e.message}`);
      process.exit(1);
    }
  });

// ===================================================================
// mpt channel — 渠道管理
// ===================================================================
const chCmd = program.command('channel')
  .description('管理待测渠道配置')
  .addHelpText('after', `
═══ 详细说明 ═══

渠道代表一个 LLM API 服务端点。每个渠道包含:
  name      渠道名称（唯一标识）
  base_url  API 基础地址（如 https://api.openai.com/v1）
  api_key   API 密钥
  model     默认模型ID（可在运行时用 --model 覆盖）
  enabled   是否启用（禁用后 mpt run --all 会跳过）

配置持久化在 ~/.mpt/config.yaml 的 channels 字段中。

═══ 使用示例 ═══

  # 列出所有渠道
  npx mpt channel list

  # 添加渠道
  npx mpt channel add --name MyAPI --url https://api.example.com/v1 --key sk-xxx --model my-model

  # 启用/禁用
  npx mpt channel enable --name MyAPI
  npx mpt channel disable --name MyAPI

  # 删除
  npx mpt channel remove --name MyAPI
`);

chCmd.command('list')
  .description('列出所有渠道（含启用状态、模型、API地址）')
  .option('-f, --format <type>', '输出格式 (text|json)', 'text')
  .action(async (opts) => {
    const { channelList } = await import('../src/cli/channel.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try { channelList(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

chCmd.command('add')
  .description('添加新渠道')
  .requiredOption('--name <name>', '渠道名称')
  .requiredOption('--url <url>', 'API Base URL (https://api.example.com/v1)')
  .requiredOption('--key <key>', 'API Key')
  .requiredOption('--model <model>', '默认模型ID')
  .action(async (opts) => {
    const { channelAdd } = await import('../src/cli/channel.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try { channelAdd(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

chCmd.command('remove')
  .description('删除渠道')
  .requiredOption('--name <name>', '渠道名称')
  .action(async (opts) => {
    const { channelRemove } = await import('../src/cli/channel.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try { channelRemove(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

chCmd.command('enable')
  .description('启用渠道（使其参与 mpt run --all 批量测试）')
  .requiredOption('--name <name>', '渠道名称')
  .action(async (opts) => {
    const { channelEnable } = await import('../src/cli/channel.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try { channelEnable(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

chCmd.command('disable')
  .description('禁用渠道（使其不参与批量测试）')
  .requiredOption('--name <name>', '渠道名称')
  .action(async (opts) => {
    const { channelDisable } = await import('../src/cli/channel.js');
    const { getConfigPath } = await import('../src/utils/workspace.js');
    opts.config = program.opts().config || getConfigPath();
    try { channelDisable(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

// ===================================================================
// mpt dataset — 数据集管理
// ===================================================================
const dsCmd = program.command('dataset')
  .description('管理测试数据集（Prompt 集合）')
  .addHelpText('after', `
═══ 详细说明 ═══

数据集是 JSON 格式的 Prompt 列表，压测时随机抽取发送给模型。
生成器会围绕 AI 技术主题（大模型、多模态、AI架构等）创建结构化的技术分析Prompt。

═══ 使用示例 ═══

  # 生成 100 条 Prompt，每条约 10KB
  npx mpt dataset gen -n 100 -s 10

  # 生成小规模测试集
  npx mpt dataset gen -n 30 -s 5 -o quick_test.json

  # 从外部文件导入
  npx mpt dataset import --file prompts.txt
`);

dsCmd.command('gen')
  .description('生成动态 Prompt 数据集')
  .option('-n, --count <number>', '生成条数', '100')
  .option('-s, --size-kb <number>', '每条目标大小(KB)，实际值接近但不精确', '10')
  .option('-o, --output <file>', '输出文件名（存储在 ~/.mpt/datasets/ 下）', 'default.json')
  .action(async (opts) => {
    const { datasetGen } = await import('../src/cli/dataset.js');
    try { await datasetGen(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

dsCmd.command('import')
  .description('从文本文件导入 Prompt（每行一条或 JSON 数组）')
  .requiredOption('-f, --file <path>', '输入文件路径')
  .action(async (opts) => {
    const { datasetImport } = await import('../src/cli/dataset.js');
    try { datasetImport(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

// ===================================================================
// mpt report — 报告查看
// ===================================================================
const rpCmd = program.command('report')
  .description('查看压测报告')
  .addHelpText('after', `
═══ 详细说明 ═══

每次压测自动生成 HTML 报告（包含 Chart.js TPS 时序图、响应时间分布、错误分析等）
和错误日志文件。报告文件名格式: {模型名}_{时间戳}_report.html，不会互相覆盖。

═══ 使用示例 ═══

  # 列出所有报告
  npx mpt report list

  # 打开最新报告（浏览器）
  npx mpt report latest --open

  # 仅显示最新报告路径（不打开）
  npx mpt report latest
`);

rpCmd.command('latest')
  .description('显示最新报告路径，可选浏览器打开')
  .option('-o, --open', '用默认浏览器打开报告')
  .action(async (opts) => {
    const { reportLatest } = await import('../src/cli/report.js');
    try { await reportLatest(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

rpCmd.command('list')
  .description('列出所有历史报告（文件名、大小、生成时间）')
  .action(async (opts) => {
    const { reportList } = await import('../src/cli/report.js');
    try { reportList(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

rpCmd.command('compare')
  .description('对比多个报告（开发中）')
  .option('-r, --reports <files...>', '报告文件列表')
  .option('-f, --format <type>', '输出格式', 'text')
  .action(async (opts) => {
    const { reportCompare } = await import('../src/cli/report.js');
    try { await reportCompare(opts); } catch (e) { console.error(`错误: ${e.message}`); process.exit(1); }
  });

// ===================================================================
// 默认行为：无子命令时进入交互菜单
// ===================================================================
program.action(async (options) => {
  const { showMenu } = await import('../src/index.js');
  await showMenu(options);
});

program.parse(process.argv);
