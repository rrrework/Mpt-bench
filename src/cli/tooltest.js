/**
 * mpt tool-test — LLM 工具调用正确性测试
 *
 * 用法:
 *   mpt tool-test --channel <name> --mode all
 *   mpt tool-test --channel <name> --mode simple --simple-iters 100
 *   mpt tool-test --channel <name> --mode multi --multi-iters 50
 *   mpt tool-test --channel <name> --mode boundary --boundary-iters 10
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, getChannel } from '../utils/config.js';
import { getResultsDir } from '../utils/workspace.js';
import { errorLogger } from '../utils/logger.js';
import { executeToolTestCall } from '../engine/tooltest-worker.js';
import { SIMPLE_SCENARIOS, MULTI_SCENARIOS, BOUNDARY_SCENARIOS } from '../engine/tooltest-scenarios.js';

/**
 * Promise 并发池 — 最多 concurrency 个并发
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

/**
 * 生成 HTML 报告
 */
function generateToolTestHtml(resultsData) {
  const { channel, model, mode, groupSummaries, allResults, toolStats, timestamp } = resultsData;
  const total = allResults.length;
  const success = allResults.filter(r => r.success).length;
  const failed = total - success;
  const rate = total > 0 ? (success / total * 100) : 0;
  const avgTime = total > 0 ? allResults.reduce((s, r) => s + r.responseTimeMs, 0) / total : 0;

  // 场景表格
  const scenarioMap = new Map();
  for (const r of allResults) {
    if (!scenarioMap.has(r.scenarioName)) scenarioMap.set(r.scenarioName, []);
    scenarioMap.get(r.scenarioName).push(r);
  }
  const scenarioRows = [...scenarioMap.entries()].map(([name, results]) => {
    const s = results.filter(r => r.success).length, t = results.length;
    const sr = s / t * 100, at = results.reduce((a, r) => a + r.responseTimeMs, 0) / t;
    const color = sr >= 100 ? '#28a745' : '#dc3545';
    return `<tr><td>${name}</td><td>${t}</td><td>${s}</td><td>${t-s}</td><td style="color:${color};font-weight:bold">${sr.toFixed(1)}%</td><td>${at.toFixed(0)}ms</td></tr>`;
  }).join('');

  // 工具调用统计行
  const toolStatRows = toolStats && toolStats.length > 0
    ? toolStats.map(t => `<tr><td>${t.name}</td><td>${t.count}</td></tr>`).join('')
    : '<tr><td colspan="2">无</td></tr>';

  // 失败行
  const failures = allResults.filter(r => !r.success);
  const failureRows = failures.map(r =>
    `<tr><td>${r.scenarioName}</td><td style="color:#dc3545">${r.errorMessage || '无 tool_calls'}</td></tr>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tool Call Test Report - ${model}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;color:#333}
.container{max-width:1200px;margin:0 auto;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center}
.header h1{font-size:2em;margin-bottom:5px}
.header .sub{font-size:0.9em;opacity:0.9}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;padding:25px;background:#f8f9fa}
.card{background:white;border-radius:12px;padding:15px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.card .label{font-size:0.8em;color:#666;text-transform:uppercase;margin-bottom:6px}
.card .value{font-size:1.8em;font-weight:bold;color:#667eea}
.section{padding:25px;border-bottom:1px solid #e0e0e0}
.section h3{font-size:1.2em;color:#667eea;border-left:3px solid #667eea;padding-left:12px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{padding:9px 12px;border:1px solid #e0e0e0;text-align:left;font-size:0.9em}
th{background:#667eea;color:white}
tr:nth-child(even){background:#f8f9fa}
.badge{display:inline-block;padding:4px 14px;border-radius:5px;font-weight:bold}
.pass{background:#d4edda;color:#155724}.fail{background:#f8d7da;color:#721c24}
.footer{background:#f8f9fa;padding:20px;text-align:center;color:#999;font-size:0.85em}
@media(max-width:768px){.summary{grid-template-columns:1fr}}
</style>
</head>
<body><div class="container">
<div class="header">
  <h1>LLM Tool Call Test Report</h1>
  <div class="sub">tool_choice="required" · ${model} · ${channel} · ${mode}</div>
  <div class="sub">${new Date().toLocaleString('zh-CN')}</div>
</div>
<div class="summary">
  <div class="card"><div class="label">总请求</div><div class="value">${total}</div></div>
  <div class="card"><div class="label">成功</div><div class="value" style="color:#28a745">${success}</div></div>
  <div class="card"><div class="label">失败</div><div class="value" style="color:#dc3545">${failed}</div></div>
  <div class="card"><div class="label">成功率</div><div class="value" style="color:${rate >= 100 ? '#28a745' : '#dc3545'}">${rate.toFixed(1)}%</div></div>
  <div class="card"><div class="label">平均耗时</div><div class="value" style="font-size:1.4em">${avgTime.toFixed(0)}<span style="font-size:0.5em;color:#999"> ms</span></div></div>
</div>
<div class="section"><h3>分模式统计</h3>
<table><tr><th>模式</th><th>请求数</th><th>成功</th><th>失败</th><th>成功率</th></tr>
${groupSummaries.map(g => {
  const gr = g.total > 0 ? g.success / g.total * 100 : 0;
  return `<tr><td>${g.name}</td><td>${g.total}</td><td>${g.success}</td><td>${g.fail}</td><td style="color:${gr>=100?'#28a745':'#dc3545'};font-weight:bold">${gr.toFixed(1)}%</td></tr>`;
}).join('')}
</table></div>
<div class="section"><h3>场景明细</h3>
<table><tr><th>场景</th><th>请求数</th><th>成功</th><th>失败</th><th>成功率</th><th>平均耗时</th></tr>
${scenarioRows}
</table></div>
<div class="section"><h3>工具调用统计</h3>
<table><tr><th>工具名称</th><th>调用次数</th></tr>${toolStatRows}</table></div>
${failures.length > 0 ? `<div class="section"><h3>失败详情</h3><table><tr><th>场景</th><th>错误</th></tr>${failureRows}</table></div>` : ''}
<div class="section"><div style="text-align:center;padding:15px">
<span class="badge ${rate >= 100 ? 'pass' : 'fail'}" style="font-size:1.1em">
${rate >= 100 ? '✓ 通过 — tool_choice=required 100%' : '✗ 未通过 — 存在无 tool_calls 请求'}
</span></div></div>
<div class="footer">MPT - Model Performance Test | Tool Call Test</div>
</div></body></html>`;
}

export async function toolTestCommand(opts) {
  const config = loadConfig(opts.config);
  const channel = getChannel(config, opts.channel);
  if (!channel) throw new Error(`渠道 "${opts.channel}" 未找到。`);

  const effectiveChannel = opts.model ? { ...channel, model: opts.model } : channel;
  const mode = opts.mode || 'all';
  const simpleIters = parseInt(opts.simpleIters) || 5;
  const multiIters = parseInt(opts.multiIters) || 5;
  const boundaryIters = parseInt(opts.boundaryIters) || 5;
  const concurrency = parseInt(opts.concurrency) || 3;

  // --single 调试模式
  if (opts.single) {
    console.log(`\n单请求调试模式 — ${effectiveChannel.model}\n`);
    const result = await executeToolTestCall(effectiveChannel, SIMPLE_SCENARIOS[0], {
      timeout: config.timeout?.total || 60,
      temperature: config.request?.temperature ?? 0.7,
    });
    console.log(`  success: ${result.success}`);
    console.log(`  calledTools: [${result.calledTools.join(', ')}]`);
    console.log(`  modelOutput: ${result.modelOutput}`);
    console.log(`  responseTimeMs: ${result.responseTimeMs.toFixed(0)}`);
    if (result.rawResponse) {
      console.log(`\n完整 API 响应:`);
      console.log(JSON.stringify(result.rawResponse, null, 2));
    }
    return result.success ? 100 : 0;
  }

  const logPath = errorLogger.init(effectiveChannel.model || effectiveChannel.name);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`LLM 工具调用测试`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  渠道: ${effectiveChannel.name}  模型: ${effectiveChannel.model}`);
  console.log(`  模式: ${mode}  简单:${simpleIters}次/场景  多场景:${multiIters}次/场景  边界:${boundaryIters}次/场景  并发:${concurrency}`);
  console.log(`  错误日志: ${logPath}\n`);

  const options = { timeout: config.timeout?.total || 60, temperature: config.request?.temperature ?? 0.7 };

  const testGroups = [];
  if (mode === 'all' || mode === 'simple') testGroups.push({ name: '简单验证', scenarios: SIMPLE_SCENARIOS, iters: simpleIters });
  if (mode === 'all' || mode === 'multi') testGroups.push({ name: '多场景验证', scenarios: MULTI_SCENARIOS, iters: multiIters });
  if (mode === 'all' || mode === 'boundary') testGroups.push({ name: '边界测试', scenarios: BOUNDARY_SCENARIOS, iters: boundaryIters });

  const allResults = [];
  const groupSummaries = [];
  const toolCounter = new Map();  // 工具调用计数器

  for (const group of testGroups) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`[${group.name}] ${group.scenarios.length} 个场景, ${group.iters} 次/场景\n`);

    let groupSuccess = 0, groupTotal = 0;

    for (const scenario of group.scenarios) {
      console.log(`  ${scenario.name}`);

      // 分批并发执行（对齐 Python ThreadPoolExecutor）
      const batch = Array.from({ length: group.iters }, () => () =>
        executeToolTestCall(effectiveChannel, scenario, options));
      const results = await runWithConcurrency(batch, concurrency);

      const successCount = results.filter(r => r.success).length;
      const failCount = group.iters - successCount;
      const avgTime = results.reduce((s, r) => s + r.responseTimeMs, 0) / group.iters;
      const icon = successCount === group.iters ? '✓' : '✗';

      console.log(`  ${icon} ${successCount}/${group.iters} (${(successCount/group.iters*100).toFixed(1)}%) ${avgTime.toFixed(0)}ms`);

      for (let i = 0; i < Math.min(2, results.length); i++) {
        console.log(`    [${i+1}] ${results[i].success ? '✓' : '✗'} ${results[i].modelOutput.slice(0, 80)}`);
      }

      for (const r of results) {
        if (!r.success) {
          errorLogger.log(scenario.name, 'TOOL_CALL_FAIL', r.errorMessage || '无 tool_calls', {
            responseTimeMs: r.responseTimeMs, modelOutput: r.modelOutput,
          });
          console.log(`    错误: ${r.errorMessage || '无 tool_calls'}`);
        }
        // 工具调用计数
        for (const t of r.calledTools) {
          toolCounter.set(t, (toolCounter.get(t) || 0) + 1);
        }
      }

      allResults.push(...results);
      groupSuccess += successCount;
      groupTotal += group.iters;
    }
    groupSummaries.push({ name: group.name, total: groupTotal, success: groupSuccess, fail: groupTotal - groupSuccess });
  }

  errorLogger.close();

  const total = allResults.length;
  const success = allResults.filter(r => r.success).length;
  const rate = total > 0 ? (success / total * 100) : 0;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`最终汇总: 总 ${total}  成功 ${success}  失败 ${total-success}  成功率 ${rate.toFixed(2)}%`);
  const passed = rate >= 100;
  console.log(`判定: ${passed ? '✓ 100% 通过' : `✗ ${rate.toFixed(1)}% 未达标`}`);

  // 工具调用统计
  if (toolCounter.size > 0) {
    console.log(`\n工具调用统计:`);
    for (const [name, count] of [...toolCounter.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count} 次`);
    }
  }

  // 生成报告
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = (effectiveChannel.model || effectiveChannel.name).replace(/[/\\:*?"<>|]/g, '_');
  const resultsDir = getResultsDir();
  mkdirSync(resultsDir, { recursive: true });

  const toolStats = [...toolCounter.entries()].map(([name, count]) => ({ name, count }));

  const htmlPath = resolve(resultsDir, `${safeName}_tooltest_${timestamp}.html`);
  writeFileSync(htmlPath, generateToolTestHtml({
    channel: effectiveChannel.name, model: effectiveChannel.model,
    mode, groupSummaries, allResults, toolStats, timestamp,
  }), 'utf-8');
  console.log(`\nHTML: ${htmlPath}`);

  const jsonPath = resolve(resultsDir, `${safeName}_tooltest_${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    channel: effectiveChannel.name, model: effectiveChannel.model,
    mode, iterations: { simple: simpleIters, multi: multiIters, boundary: boundaryIters },
    concurrency, timestamp: new Date().toISOString(), passed,
    summary: { total, success, failed: total - success, successRate: rate.toFixed(2) + '%' },
    groups: groupSummaries,
    toolStats,
    results: allResults.map(r => ({
      scenario: r.scenarioName, success: r.success,
      calledTools: r.calledTools, modelOutput: r.modelOutput,
      responseTimeMs: Math.round(r.responseTimeMs),
      errorMessage: r.errorMessage || null,
    })),
  }, null, 2), 'utf-8');
  console.log(`JSON: ${jsonPath}`);

  return rate;
}
