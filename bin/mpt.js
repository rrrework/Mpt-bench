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

对 OpenAI 兼容 API 的 LLM 模型进行标准化压力测试，支持场景化专项测试（短请求/长综述），
生成包含 P50/P90/P95/P99、TTFT、TPS、成功率等完整指标的性能报告。

═══ 场景化专项测试（核心能力） ═══

MPT 支持按测试场景分层执行压测，当前内置 3 种预设:

  预设              说明                       典型参数
  ─────────────────────────────────────────────────────────────
  default          通用技术分析型长 Prompt      -n 100 -s 10
  short            短请求（问候/问答/指令）     -n 200
  long-summary     长文本综述（真实语料截断）   --target-kb 64/128/256

完整工作流（3 步）:

  # 第 1 步: 添加渠道（首次使用）
  mpt channel add --name MY_API --url https://api.example.com/v1 --key sk-xxx --model my-model

  # 第 2 步: 按场景生成数据集
  mpt dataset gen --preset short -n 200 -o short.json
  mpt dataset gen --preset long-summary --target-kb 128 -n 20 -o long-summary.json
  mpt dataset gen --preset long-summary --target-kb 256 --corpus en -n 10 -o long-en.json

  # 第 3 步: 执行场景化压测 → 查看报告
  mpt run --channel MY_API --dataset short.json --scenario short --rpm 30 --duration 60
  mpt run --channel MY_API --dataset long-summary.json --scenario long-summary --rpm 10 --duration 120
  mpt report latest --open

  # 模型横评（同一渠道多个模型对比）
  mpt benchmark --channel MY_API --models model-a,model-b --rpm 30 --duration 60

  # 工具调用正确性测试
  mpt tool-test --channel MY_API --mode all

═══ 语料与数据源说明 ═══

long-summary 预设使用内置真实语料随机截断（而非 AI 生成废话文本）:
  内置语料: 中英双语 462KB（zh 120KB + en 342KB），来自维基百科科技教育类文章
  语料选择: --corpus zh (仅中文) | en (仅英文) | all (中英混合，默认)
  自定义:   --corpus /path/to/your-corpus.txt（指定外部语料文件）
  长度控制: --target-kb <KB>（字节级近似，满足 64K/128K/256K 场景需求）

═══ 报告能力 ═══

HTML 报告包含完整指标:
  响应时间: Avg / P50 / P90 / P95 / P99 / Min / Max / Std
  TTFT:     Avg / P50 / P90 / P95 / P99
  吞吐:     TPS / Token TPS / 实际 RPM
  其他:     成功率 / 错误分类 / TPS 时序图 / 场景元信息

═══ 存储路径 ═══

所有数据存储在用户目录: ~/.mpt/
  config.yaml           用户配置文件（渠道、超时、默认参数）
  datasets/             测试数据集（JSON 格式 Prompt 列表）
  results/              压测报告（带时间戳的 HTML 文件，含场景标签）
  logs/                 错误日志（每次压测生成一份）`
  )
  .version(pkg.version)
  .option('-l, --lang <lang>', 'Display language (zh-CN | en)', (v) => {
    if (v === 'en' || v === 'zh-CN') setLang(v);
    return v;
  }, getLang())
  .option('-c, --config <path>', 'Specify config file path (default ~/.mpt/config.yaml)')
  .addHelpText('after', `
═══ 完整命令速查 ═══

  mpt                              交互式菜单（新手推荐）
  mpt run --channel X --rpm 30     单模型压测
  mpt benchmark --channel X        模型横评
  mpt models --channel X           查看可用模型
  mpt tool-test --channel X        工具调用正确性测试
  mpt channel list                 管理渠道
  mpt dataset gen --preset ...     生成数据集
  mpt report latest --open         查看报告

  查看子命令详细帮助: mpt run --help | mpt dataset gen --help | mpt benchmark --help

═══ 环境要求 ═══

  Node.js >= 18.0.0
  首次运行时自动创建 ~/.mpt/ 目录结构
  版本: ${pkg.version}
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
  .option('--scenario <name>', '场景标签: default | short | long-summary')
  .option('-o, --output <dir>', '报告输出目录，默认 ~/.mpt/results/')
  .option('-f, --format <type>', '输出格式: text (终端表格) | json (JSON)', 'text')
  .addHelpText('after', `
═══ 场景化专项测试流程 ═══

  MPT 支持按场景（short / long-summary）分层执行压测:

  步骤 1: 生成场景数据集
    mpt dataset gen --preset short -n 200 -o short.json
    mpt dataset gen --preset long-summary --target-kb 128 -n 20 -o long-summary.json

  步骤 2: 执行场景化压测
    mpt run --dataset short.json --scenario short --rpm 60 --duration 60
    mpt run --dataset long-summary.json --scenario long-summary --rpm 10 --duration 120

  步骤 3: 查看报告（文件名自动带场景标签）
    mpt report latest --open
    # 报告文件名格式: {model}_{scenario}_{timestamp}_report.html
    # 例如: deepseek-v4-pro_short_2026-05-20T18-00-00_report.html

  注意: --scenario 可省略。若不传，会自动从数据集 meta 或文件名推断。

═══ 详细参数说明 ═══

--channel    指定要测试的渠道名称，必须与配置文件中的 name 字段一致。
             若不指定且仅有一个渠道，则自动选择该渠道。

--model      临时覆盖渠道的 model 字段。不修改配置文件，仅本次压测生效。
             适用于: 同一渠道有多个模型时，快速切换测试目标。

--rpm        目标请求速率（Requests Per Minute）。
             低 RPM (< 10): 使用概率发送，保证精确度。
             高 RPM (>=600): 自动切换微秒级调度模式。
             建议范围: 10-600。
             短请求建议: 30-120 RPM | 长综述建议: 5-20 RPM

--duration   压测持续时间（秒）。调度器在此时间内按 RPM 速率发送请求。
             调度结束后会等待所有未完成的请求返回（不设硬超时）。
             单请求超时由配置文件 timeout 段控制（默认 connect:100s, read:180s, total:300s）。

--concurrent 允许同时进行的最大请求数。超过此数量后新请求进入等待队列。

--dataset    测试用 Prompt 数据集。支持两种格式:
             - 旧格式: ["prompt1", "prompt2"]（纯字符串数组）
             - 新格式: {"meta": {...}, "items": [...]}（含场景元信息）
             可通过 mpt dataset gen 生成。

--scenario   场景标签，影响报告文件名与报告展示信息。
             可选值: default | short | long-summary
             优先级: CLI 参数 > 数据集 meta > 文件名推断 > 回退 default

--format     text: 终端表格输出（默认）
             json: 纯 JSON 输出（适合 Agent/脚本解析）

═══ 使用示例 ═══

  # 基础压测（使用配置文件的默认渠道和参数）
  npx mpt run

  # 指定渠道和参数
  npx mpt run --channel SHENYUAN --rpm 30 --duration 60 --concurrent 50

  # 覆盖模型ID（不修改配置文件）
  npx mpt run --channel SHENYUAN --model t_wz_glm-5 --rpm 20 --duration 30

  # 指定数据集
  npx mpt run --dataset my_prompts.json --rpm 60

  # 短请求专项测试
  npx mpt run --dataset short.json --scenario short --rpm 60 --duration 60

  # 长综述专项测试（低 RPM 适配长推理时间）
  npx mpt run --dataset long-summary.json --scenario long-summary --rpm 10 --duration 120

  # 批量测试所有启用渠道
  npx mpt run --all --rpm 30 --duration 120

  # JSON 格式输出（适合脚本解析）
  npx mpt run --channel MY_API --rpm 30 --duration 30 --format json

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
报告指标: Avg / P50 / P90 / P95 / P99 / Min / Max / Std（响应时间 + TTFT）
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
═══ 数据集预设说明 ═══

  MPT 提供三种数据集预设，满足不同测试场景:

  default        通用技术分析 Prompt（行业×任务×概念组合，每条数 KB）
  short          短请求 Prompt（问候/问答/分类/改写/短指令，极短输入）
  long-summary   长文本综述 Prompt（真实语料随机截断 + 总结指令）

  long-summary 使用内置中英双语语料（462KB），数据来自维基百科科技教育类文章。
  可通过 --corpus zh|en|all|<路径> 选择语料来源。

═══ 使用示例 ═══

  # 通用数据集
  npx mpt dataset gen -n 100 -s 10 -o default.json

  # 短请求数据集
  npx mpt dataset gen --preset short -n 200 -o short.json

  # 长综述数据集（128KB/条，中英混合）
  npx mpt dataset gen --preset long-summary --target-kb 128 -n 20 -o long-summary.json

  # 从外部文件导入
  npx mpt dataset import --file prompts.txt

  # 查看详细参数
  npx mpt dataset gen --help
`);

dsCmd.command('gen')
  .description('生成动态 Prompt 数据集')
  .option('-n, --count <number>', '生成条数', '100')
  .option('-s, --size-kb <number>', '每条目标大小(KB)，实际值接近但不精确', '10')
  .option('--preset <name>', '数据集预设: default | short | long-summary', 'default')
  .option('--target-kb <number>', 'long-summary 单条目标正文大小(KB)')
  .option('--corpus <path>', 'long-summary 语料来源: zh | en | all | <自定义路径>', 'all')
  .option('-o, --output <file>', '输出文件名（存储在 ~/.mpt/datasets/ 下）', 'default.json')
  .addHelpText('after', `
═══ 预设类型详解 ═══

  default        通用技术分析型 Prompt（行业×任务×概念组合）
                 适用于: 通用压测基线
                 参数: -n <条数> -s <每条KB>

  short          短请求 Prompt（问候/单句问答/极短分类/简单改写/短指令）
                 适用于: 测试低延迟场景下的 TTFT 和快速响应能力
                 参数: -n <条数>（无需 -s 和 --target-kb）

  long-summary   长文本综述 Prompt（真实语料随机截断 + 总结指令）
                 适用于: 测试长上下文场景下的 TTFT、TPS、稳定性
                 参数: --target-kb <KB>（必填，建议 64/128/256）

═══ 语料选项 (--corpus) ═══

  仅 long-summary 预设生效。内置中英双语语料共 462KB:

  zh             仅中文语料（120KB，7 篇维基科技教育文章）
  en             仅英文语料（342KB，7 篇维基科技教育文章）
  all            中英混合（默认，462KB 全部可用）
  <文件路径>     使用自定义外部语料文件（txt 格式，建议 >= 100KB）

  长文本数据来源为真实百科文本随机截断，不使用 AI 生成式堆砌。
  这确保 TTFT / TPOT / TPS 等指标更贴近真实推理负载。

═══ 使用示例 ═══

  # 通用数据集
  npx mpt dataset gen --preset default -n 100 -s 10 -o default.json

  # 短请求数据集（200 条）
  npx mpt dataset gen --preset short -n 200 -o short.json

  # 长综述数据集（128KB/条，中英混合）
  npx mpt dataset gen --preset long-summary --target-kb 128 -n 20 -o long-summary.json

  # 长综述数据集（64KB/条，仅中文）
  npx mpt dataset gen --preset long-summary --target-kb 64 --corpus zh -n 10 -o long-zh.json

  # 长综述数据集（256KB/条，仅英文）
  npx mpt dataset gen --preset long-summary --target-kb 256 --corpus en -n 5 -o long-en.json

  # 使用自定义语料
  npx mpt dataset gen --preset long-summary --corpus ./my-data.txt --target-kb 128 -n 10
`)
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
