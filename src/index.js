import chalk from 'chalk';
import prompts from 'prompts';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { getConfigPath, getDatasetsDir, getDefaultDatasetPath, getWorkspaceDir } from './utils/workspace.js';
import { loadConfig, getEnabledChannels } from './utils/config.js';
import { t, getLang, setLang } from './utils/i18n.js';

const BANNER = `
╔════════════════════════════════════════════════════════════════╗
║   ███╗   ███╗██████╗ ████████╗                               ║
║   ████╗ ████║██╔══██╗╚══██╔══╝                               ║
║   ██╔████╔██║██████╔╝   ██║                                  ║
║   ██║╚██╔╝██║██╔═══╝    ██║                                  ║
║   ██║ ╚═╝ ██║██║        ██║                                  ║
║   ╚═╝     ╚═╝╚═╝        ╚═╝  for LLM Testing                 ║
║                                                                ║
║   Model Performance Test                                       ║
╚════════════════════════════════════════════════════════════════╝`;

function getMenu() {
  return `
${t('menu_title')}
  -------- ${t('menu_section_test')} --------
  1. ${t('menu_1')}
  2. ${t('menu_2')}
  3. ${t('menu_3')}

  -------- ${t('menu_section_config')} --------
  4. ${t('menu_4')}
  5. ${t('menu_5')}

  -------- ${t('menu_section_report')} --------
  6. ${t('menu_6')}
  7. ${t('menu_7')}

  ------------ ${t('menu_section_tools')} ------------
  0. ${t('menu_0')}
  Q. ${t('menu_q')}
`;}

/**
 * 暂停等待用户按回车
 */
async function pause() {
  await prompts({
    type: 'text',
    name: 'continue',
    message: t('prompt_enter'),
  }, { onCancel: () => {} });
}

/**
 * 交互式报告浏览器（选择式，直接打开）
 */
async function reportBrowse() {
  const { readdirSync, statSync } = await import('fs');
  const { resolve } = await import('path');
  const { getResultsDir, openFile } = await import('./utils/workspace.js');

  const dir = getResultsDir();
  if (!existsSync(dir)) {
    console.log(chalk.gray(t('rp_no_reports')));
    return;
  }

  while (true) {
    const files = readdirSync(dir).filter(f => f.endsWith('.html'));
    if (files.length === 0) {
      console.log(chalk.gray(t('rp_no_found')));
      return;
    }

    const sorted = files.map(f => ({
      name: f,
      path: resolve(dir, f),
      time: statSync(resolve(dir, f)).mtimeMs,
      size: statSync(resolve(dir, f)).size,
    })).sort((a, b) => b.time - a.time);

    console.log(chalk.cyan('\n--- Report History ---\n'));

    const choice = await prompts({
      type: 'select',
      name: 'selected',
      message: t('prompt_menu'),
      choices: [
        { title: `← ${t('back')}`, value: 'back' },
        ...sorted.map(f => {
          const date = new Date(f.time).toLocaleString('zh-CN');
          const size = (f.size / 1024).toFixed(1);
          const name = f.name.replace('_stress_test_report.html', '');
          return {
            title: `${name}  ${date}  ${size}KB`,
            value: f.path,
          };
        }),
      ],
    }, { onCancel: () => ({ selected: 'back' }) });

    if (!choice || choice.selected === 'back') break;

    console.log(`报告路径: ${choice.selected}`);
    openFile(choice.selected);
  }
}

/**
 * 直接打开最新报告（选项8）
 */
async function reportOpenLatest() {
  const { readdirSync, statSync } = await import('fs');
  const { resolve } = await import('path');
  const { getResultsDir, openFile } = await import('./utils/workspace.js');

  const dir = getResultsDir();
  if (!existsSync(dir)) {
    console.log(chalk.gray(t('rp_no_reports')));
    return;
  }
  const files = readdirSync(dir).filter(f => f.endsWith('.html'));
  if (files.length === 0) {
    console.log(chalk.gray(t('rp_no_found')));
    return;
  }
  const latest = files.map(f => ({
    name: f,
    path: resolve(dir, f),
    time: statSync(resolve(dir, f)).mtimeMs,
  })).sort((a, b) => b.time - a.time)[0];

  console.log(`最新报告: ${latest.path}`);
  openFile(latest.path);
}

/**
 * 模型横评 — 选择渠道，自动拉取或手动输入模型列表，逐个压测对比性能
 */
async function modelBenchmark() {
  const { datasetGen } = await import('./cli/dataset.js');
  const { runCommand } = await import('./cli/run.js');
  const { fetchModels } = await import('./cli/run.js');
  const configPath = getConfigPath();
  const config = loadConfig(configPath);
  const channels = config.channels || [];

  console.log(chalk.cyan('\n=== 模型横评 ===\n'));
  console.log(chalk.gray('选择一个渠道，自动拉取该渠道下所有可用模型，逐个压测对比性能。\n'));

  // Step 1: 选择渠道
  if (channels.length === 0) {
    console.log(chalk.yellow('没有配置任何渠道。请先通过「渠道管理」添加渠道。'));
    return;
  }
  let selectedChannel = channels[0];
  if (channels.length > 1) {
    const chChoice = await prompts({
      type: 'select',
      name: 'channel',
      message: '选择测试渠道',
      choices: channels.map(ch => ({
        title: `${ch.name} — ${ch.base_url || ch.baseUrl}`,
        value: ch.name,
      })),
    });
    if (!chChoice.channel) { console.log(chalk.gray('已取消。')); return; }
    selectedChannel = channels.find(ch => ch.name === chChoice.channel);
  }
  console.log(chalk.green(`已选择渠道: ${selectedChannel.name} (${selectedChannel.base_url || selectedChannel.baseUrl})`));

  // Step 2: 拉取模型列表
  console.log(chalk.cyan('\n正在拉取可用模型列表...'));
  let modelIds = await fetchModels(selectedChannel);

  if (modelIds && modelIds.length > 0) {
    console.log(chalk.green(`发现 ${modelIds.length} 个可用模型:\n`));
    modelIds.forEach(m => console.log(chalk.white(`  • ${m}`)));

    // 用户勾选要测试的模型
    const selectChoice = await prompts({
      type: 'select',
      name: 'action',
      message: '如何选择模型？',
      choices: [
        { title: `全部测试 (${modelIds.length} 个)`, value: 'all' },
        { title: '手动选择要测试的模型', value: 'select' },
        { title: '手动输入模型ID（逗号分隔）', value: 'manual' },
      ],
    });
    if (!selectChoice.action) { console.log(chalk.gray('已取消。')); return; }

    if (selectChoice.action === 'select') {
      const modelChoice = await prompts({
        type: 'multiselect',
        name: 'models',
        message: '选择要测试的模型（空格选择，回车确认）',
        choices: modelIds.map(m => ({ title: m, value: m })),
        min: 1,
      });
      if (!modelChoice.models || modelChoice.models.length === 0) { console.log(chalk.gray('已取消。')); return; }
      modelIds = modelChoice.models;
    } else if (selectChoice.action === 'manual') {
      const manualInput = await prompts({
        type: 'text',
        name: 'models',
        message: '请输入模型ID（逗号分隔）',
        validate: v => v.trim() ? true : '请输入至少一个模型ID',
      });
      if (!manualInput.models) { console.log(chalk.gray('已取消。')); return; }
      modelIds = manualInput.models.split(',').map(s => s.trim()).filter(Boolean);
    }
    // 'all' 保持 modelIds 不变
  } else {
    console.log(chalk.yellow('无法自动拉取模型列表（API 不支持 /v1/models）。'));
    const manualInput = await prompts({
      type: 'text',
      name: 'models',
      message: '请手动输入要测试的模型ID（逗号分隔）',
      validate: v => v.trim() ? true : '请输入至少一个模型ID',
    });
    if (!manualInput.models) { console.log(chalk.gray('已取消。')); return; }
    modelIds = manualInput.models.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (modelIds.length === 0) { console.log(chalk.yellow('没有选择任何模型。')); return; }
  console.log(chalk.cyan(`\n将测试 ${modelIds.length} 个模型:\n`));
  modelIds.forEach(m => console.log(chalk.white(`  • ${m}`)));

  // Step 3: 检查数据集
  const defaultDataset = getDefaultDatasetPath();
  if (!existsSync(defaultDataset)) {
    console.log(chalk.yellow('\n未找到测试数据集，自动生成中...'));
    await datasetGen({ count: '100', sizeKb: '10', output: 'default.json' });
  } else {
    console.log(chalk.green(`\n数据集就绪: ${defaultDataset}`));
  }

  // Step 4: 压测参数
  const params = await prompts([
    { type: 'number', name: 'rpm', message: '目标 RPM', initial: 30 },
    { type: 'number', name: 'duration', message: '持续时间（秒）', initial: 60 },
    { type: 'number', name: 'concurrent', message: '最大并发数', initial: 50 },
  ]);
  if (!params.rpm || !params.duration) { console.log(chalk.gray('已取消。')); return; }

  // Step 5: 逐个模型测试（通过 --model 覆盖，不碰配置文件）
  console.log(chalk.cyan(`\n开始模型横评: 渠道 ${selectedChannel.name}, ${modelIds.length} 个模型\n`));

  const results = [];
  for (const modelId of modelIds) {
    console.log(chalk.cyan(`\n${'═'.repeat(50)}`));
    console.log(chalk.cyan(`[${modelIds.indexOf(modelId) + 1}/${modelIds.length}] 测试模型: ${modelId}`));
    console.log(chalk.cyan(`${'═'.repeat(50)}\n`));

    try {
      await runCommand({
        channel: selectedChannel.name,
        model: modelId,
        rpm: params.rpm,
        duration: params.duration,
        concurrent: params.concurrent,
        config: configPath,
      });
      results.push({ model: modelId, status: 'success' });
    } catch (e) {
      console.log(chalk.red(`模型 ${modelId} 测试失败: ${e.message}`));
      results.push({ model: modelId, status: 'failed', error: e.message });
    }
  }

  // Step 6: 输出汇总
  console.log(chalk.cyan(`\n${'═'.repeat(50)}`));
  console.log(chalk.cyan(`模型横评完成: 渠道 ${selectedChannel.name}, ${modelIds.length} 个模型`));
  console.log(chalk.cyan(`${'═'.repeat(50)}\n`));
  for (const r of results) {
    const icon = r.status === 'success' ? '✅' : '❌';
    console.log(`  ${icon} ${r.model}${r.error ? ` — ${r.error}` : ''}`);
  }
  console.log(chalk.gray(`\n详细报告请在「查看历史报告」中查看。`));
}

/**
 * 工具调用测试交互入口
 */
async function toolTestMenu() {
  const configPath = getConfigPath();
  const config = loadConfig(configPath);
  const channels = config.channels || [];
  if (channels.length === 0) { console.log(chalk.yellow('没有可用渠道')); return; }
  const channelName = channels.length === 1 ? channels[0].name : (await prompts({
    type: 'select', name: 'ch', message: '选择渠道',
    choices: channels.map(c => ({ title: c.name, value: c.name })),
  })).ch;
  if (!channelName) return;
  const cfg = await prompts([
    { type: 'select', name: 'mode', message: '测试模式', choices: [
      { title: 'All (全部)', value: 'all' },
      { title: 'Simple (简单验证)', value: 'simple' },
      { title: 'Multi (多场景)', value: 'multi' },
      { title: 'Boundary (边界测试)', value: 'boundary' },
    ]},
    { type: 'number', name: 'simpleIters', message: '简单验证迭代次数', initial: 5 },
    { type: 'number', name: 'multiIters', message: '多场景迭代次数', initial: 5 },
    { type: 'number', name: 'boundaryIters', message: '边界测试迭代次数', initial: 5 },
  ]);
  if (!cfg.mode) return;
  const { toolTestCommand } = await import('./cli/tooltest.js');
  await toolTestCommand({ channel: channelName, mode: cfg.mode, simpleIters: cfg.simpleIters, multiIters: cfg.multiIters, boundaryIters: cfg.boundaryIters, config: configPath });
}

/**
 * 一键引导压测
 */
async function guidedTest() {
  const { datasetGen } = await import('./cli/dataset.js');
  const { runCommand } = await import('./cli/run.js');
  const { channelList, channelAdd } = await import('./cli/channel.js');
  const configPath = getConfigPath();

  console.log(chalk.cyan('\n=== 一键压测引导 ===\n'));

  // Step 1: 检查数据集
  const defaultDataset = getDefaultDatasetPath();
  if (!existsSync(defaultDataset)) {
    console.log(chalk.yellow('未找到测试数据集。'));
    const genChoice = await prompts({
      type: 'confirm',
      name: 'generate',
      message: '是否自动生成测试数据集？（100条，每条10KB）',
      initial: true,
    });
    if (!genChoice.generate) {
      console.log(chalk.gray('已取消。您可以通过菜单选项6手动生成数据集。'));
      return;
    }
    await datasetGen({ count: '100', sizeKb: '10', output: 'default.json' });
  } else {
    console.log(chalk.green(`数据集就绪: ${defaultDataset}`));
  }

  // Step 2: 检查渠道
  const config = loadConfig(configPath);
  let enabledChannels = getEnabledChannels(config);

  if (enabledChannels.length === 0) {
    console.log(chalk.yellow('\n没有已启用的渠道。'));
    const addChoice = await prompts({
      type: 'confirm',
      name: 'add',
      message: '是否添加一个测试渠道？',
      initial: true,
    });
    if (!addChoice.add) {
      console.log(chalk.gray('已取消。您可以通过菜单选项5管理渠道。'));
      return;
    }

    const channelInfo = await prompts([
      { type: 'text', name: 'name', message: '渠道名称', initial: 'my-model' },
      { type: 'text', name: 'url', message: 'API Base URL', initial: 'https://api.openai.com/v1' },
      { type: 'password', name: 'key', message: 'API Key' },
      { type: 'text', name: 'model', message: '模型名称', initial: 'gpt-4o' },
    ]);
    if (!channelInfo.name || !channelInfo.url || !channelInfo.key) {
      console.log(chalk.gray('已取消。'));
      return;
    }
    channelAdd({ name: channelInfo.name, url: channelInfo.url, key: channelInfo.key, model: channelInfo.model, config: configPath });
    enabledChannels = getEnabledChannels(loadConfig(configPath));
  } else {
    console.log(chalk.green(`已有 ${enabledChannels.length} 个启用渠道`));
  }

  // Step 3: 选择渠道和参数
  let selectedChannel = enabledChannels[0].name;
  if (enabledChannels.length > 1) {
    const chChoice = await prompts({
      type: 'select',
      name: 'channel',
      message: '选择要测试的渠道',
      choices: enabledChannels.map(ch => ({
        title: `${ch.name} (${ch.model})`,
        value: ch.name,
      })),
    });
    if (!chChoice.channel) { console.log(chalk.gray('已取消。')); return; }
    selectedChannel = chChoice.channel;
  }

  const params = await prompts([
    { type: 'number', name: 'rpm', message: '目标 RPM（每分钟请求数，建议10-120）', initial: 30 },
    { type: 'number', name: 'duration', message: '持续时间（秒，建议30-300）', initial: 60 },
    { type: 'number', name: 'concurrent', message: '最大并发数', initial: 50 },
  ]);
  if (!params.rpm || !params.duration) { console.log(chalk.gray('已取消。')); return; }

  // Step 4: 执行
  console.log(chalk.cyan(`\n开始压测: ${selectedChannel} @ ${params.rpm} RPM, ${params.duration}s, 并发${params.concurrent || 50}\n`));
  await runCommand({
    channel: selectedChannel,
    rpm: params.rpm,
    duration: params.duration,
    concurrent: params.concurrent,
    config: configPath,
  });
}

/**
 * 交互式渠道管理子菜单（循环）
 * 核心: 所有渠道操作都是选择式的，不需要手动输入名称
 */
async function channelManagement() {
  const { channelAdd, channelRemove, channelEnable, channelDisable } = await import('./cli/channel.js');
  const configPath = getConfigPath();

  while (true) {
    // 每次循环重新加载配置
    const config = loadConfig(configPath);
    const channels = config.channels || [];

    console.log(chalk.cyan(`\n--- ${t('ch_menu_title')} ---\n`));
    if (channels.length === 0) {
      console.log(chalk.gray(t('ch_menu_empty')));
    } else {
      for (const ch of channels) {
        const status = ch.enabled ? chalk.green('[启用]') : chalk.gray('[禁用]');
        console.log(`  ${status} ${chalk.bold(ch.name)} (${ch.model}) - ${ch.base_url || ch.baseUrl}`);
      }
    }
    console.log('');

    // 操作选择
    const action = await prompts({
      type: 'select',
      name: 'op',
      message: t('ch_menu_options'),
      choices: [
        { title: `← ${t('back')}`, value: 'back' },
        { title: t('ch_menu_add'), value: 'add' },
        ...channels.length > 0
          ? [
              { title: t('ch_menu_toggle'), value: 'toggle' },
              { title: t('ch_menu_remove'), value: 'remove' },
            ]
          : [],
      ],
    }, { onCancel: () => ({ op: 'back' }) });

    if (!action || action.op === 'back') break;

    try {
      switch (action.op) {
        case 'add': {
          const info = await prompts([
            { type: 'text', name: 'name', message: '渠道名称' },
            { type: 'text', name: 'url', message: 'API Base URL', initial: 'https://api.openai.com/v1' },
            { type: 'password', name: 'key', message: 'API Key' },
            { type: 'text', name: 'model', message: '模型名称' },
          ]);
          if (info.name && info.url && info.key && info.model) {
            channelAdd({ ...info, config: configPath });
          }
          break;
        }
        case 'toggle': {
          // 从列表中选择渠道
          const chChoice = await prompts({
            type: 'select',
            name: 'name',
            message: '选择要切换状态的渠道',
            choices: channels.map(ch => ({
              title: `${ch.enabled ? chalk.green('[启用]') : chalk.gray('[禁用]')} ${ch.name} (${ch.model})`,
              value: ch.name,
            })),
          }, { onCancel: () => ({}) });
          if (chChoice?.name) {
            const target = channels.find(ch => ch.name === chChoice.name);
            if (target) {
              if (target.enabled) {
                channelDisable({ name: chChoice.name, config: configPath });
              } else {
                channelEnable({ name: chChoice.name, config: configPath });
              }
            }
          }
          break;
        }
        case 'remove': {
          const chChoice = await prompts({
            type: 'select',
            name: 'name',
            message: '选择要删除的渠道',
            choices: channels.map(ch => ({
              title: `${ch.name} (${ch.model})`,
              value: ch.name,
            })),
          }, { onCancel: () => ({}) });
          if (chChoice?.name) {
            const confirm = await prompts({
              type: 'confirm',
              name: 'ok',
              message: `确认删除 "${chChoice.name}"？`,
              initial: false,
            });
            if (confirm.ok) channelRemove({ name: chChoice.name, config: configPath });
          }
          break;
        }
      }
    } catch (e) {
      console.error(chalk.red(`错误: ${e.message}`));
    }

    // 短暂暂停让用户看到操作结果
    await pause();
  }
}

export async function showMenu(options) {
  // 确保工作目录已初始化
  getWorkspaceDir();

  // 处理 -l 命令行参数（如果通过 CLI 启动）
  if (options?.lang && (options.lang === 'zh-CN' || options.lang === 'en')) {
    setLang(options.lang);
  }

  const lang = getLang();
  console.log(chalk.cyan(BANNER));
  console.log(chalk.gray(`  Version: 1.0.0  |  ${t('workspace')}: ${getWorkspaceDir()}`));
  console.log(getMenu());

  const response = await prompts({
    type: 'text',
    name: 'choice',
    message: t('prompt_menu'),
    validate: value => /^[0-7qQ]$/.test(value) ? true : t('prompt_invalid'),
  }, {
    onCancel: () => {
      console.log(chalk.cyan('\nBye! / 再见！'));
      process.exit(0);
    },
  });

  if (!response.choice) {
    console.log(chalk.cyan('\nBye! / 再见！'));
    process.exit(0);
  }

  const choice = response.choice.toUpperCase();
  if (choice === 'Q') {
    console.log(chalk.cyan('\nBye! / 再见！'));
    process.exit(0);
  }

  const configPath = getConfigPath();

  try {
    const { reportLatest, reportList } = await import('./cli/report.js');

    switch (choice) {
      case '1':
        await guidedTest();
        await pause();
        break;
      case '2':
        await modelBenchmark();
        await pause();
        break;
      case '3':
        await toolTestMenu();
        await pause();
        break;
      case '4':
        await channelManagement();
        break;
      case '5': {
        const ds = await prompts({
          type: 'select',
          name: 'action',
          message: t('ds_menu_title'),
          choices: [
            { title: t('ds_gen_option'), value: 'gen' },
            { title: t('ds_import_option'), value: 'import' },
          ],
        });
        if (ds.action === 'gen') {
          const genOpts = await prompts([
            { type: 'number', name: 'count', message: t('ds_gen_count'), initial: 100 },
            { type: 'number', name: 'sizeKb', message: t('ds_gen_size'), initial: 10 },
          ]);
          if (genOpts.count) {
            const { datasetGen } = await import('./cli/dataset.js');
            await datasetGen({ count: String(genOpts.count), sizeKb: String(genOpts.sizeKb || 10), output: 'default.json' });
          }
        } else {
          const filePath = await prompts({ type: 'text', name: 'file', message: t('ds_import_file') });
          if (filePath.file) {
            const { datasetImport } = await import('./cli/dataset.js');
            datasetImport({ file: filePath.file });
          }
        }
        await pause();
        break;
      }
      case '6':
        await reportOpenLatest();
        await pause();
        break;
      case '7':
        await reportBrowse();
        await pause();
        break;
      case '0': {
        const langChoice = await prompts({
          type: 'select',
          name: 'lang',
          message: t('lang_select_msg'),
          choices: [
            { title: t('lang_zh'), value: 'zh-CN' },
            { title: t('lang_en'), value: 'en' },
          ],
        });
        if (langChoice.lang) {
          setLang(langChoice.lang);
          console.log(chalk.green(langChoice.lang === 'zh-CN' ? t('lang_switched_zh') : t('lang_switched_en')));
          // 清除 --lang CLI 参数，避免递归回掉时被覆盖
          const nextOptions = { ...options, lang: undefined };
          console.log('\n');
          await showMenu(nextOptions);
          return; // 不继续当前循环
        }
        await pause();
        break;
      }
      default:
        console.log('无效选项');
    }
  } catch (e) {
    console.error(chalk.red(`\n${t('progress_total_error')}: ${e.message}`));
    console.log(chalk.gray(t('progress_back_to_menu')));
    await pause();
  }

  // 循环回到菜单
  console.log('\n');
  await showMenu(options);
}
