import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import XLSX from 'xlsx';

function mean(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = p * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function stdDev(arr) {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function buildSummarySheet(stats, options, modelName) {
  const totalRequests = stats.getTotalRequests();
  const successRate = stats.getSuccessRate();
  const actualRpm = stats.getActualRpm();
  const actualRps = stats.getActualRps();
  const completionTps = stats.getCompletionTps();
  const tokenTps = stats.getTokenTps();
  const maxTps = stats.getMaxTpsPerSecond();
  const actualInterval = stats.getActualInterval() * 1000;
  const targetInterval = (60 / (options.targetRpm || 60)) * 1000;
  const isEstimated = stats.totalCompletionTokens > 0
    && (stats.requests || []).filter(r => r.status === 'SUCCESS').every(r => r.promptTokens >= 1024);

  const respArr = stats.responseTimes;
  const ttftArr = stats.ttftTimes;

  const rows = [];

  rows.push([`${modelName} 压力测试 - 指标汇总`, '', '', '', '', '']);
  rows.push(['生成时间', options.timestamp || new Date().toISOString(), '模型', modelName, '请求地址', options.apiUrl || 'N/A']);
  rows.push(['场景 (scenario)', options.scenario || 'default', '目标 RPM', options.targetRpm, '最大并发 (maxConcurrent)', options.config?.maxConcurrent || 'N/A']);
  rows.push(['数据集路径', options.dataset?.path || 'N/A', '数据集条数', options.dataset?.count ?? 'N/A', '语料来源', options.dataset?.corpus || 'N/A']);
  rows.push(['调度模式 (scheduleMode)', options.scheduleMode || 'N/A', '流式传输 (stream)', options.stream ? 'ON' : 'OFF', '压测时长', `${options.duration}s`]);
  rows.push(['', '', '', '', '', '']);
  rows.push(['类别', '指标', '值', '单位', '说明', '']);

  // A. 响应时间
  if (respArr.length > 0) {
    const sorted = [...respArr].sort((a, b) => a - b);
    const avg = mean(respArr) * 1000;
    const p50 = median(respArr) * 1000;
    const p90 = percentile(respArr, 0.90) * 1000;
    const p95 = percentile(respArr, 0.95) * 1000;
    const p99 = percentile(respArr, 0.99) * 1000;
    const max = Math.max(...respArr) * 1000;
    const min = Math.min(...respArr) * 1000;
    const std = stdDev(respArr) * 1000;

    rows.push(['A. 响应时间', '平均响应 (Mean)', round(avg), 'ms', '所有请求响应时间的算术平均', '']);
    rows.push(['A. 响应时间', '中位响应 (P50)', round(p50), 'ms', '50% 请求的响应时间', '']);
    rows.push(['A. 响应时间', 'P90 响应', round(p90), 'ms', '90% 请求的响应时间', '']);
    rows.push(['A. 响应时间', 'P95 响应', round(p95), 'ms', '95% 请求的响应时间', '']);
    rows.push(['A. 响应时间', 'P99 响应', round(p99), 'ms', '99% 请求的响应时间', '']);
    rows.push(['A. 响应时间', '最大响应', round(max), 'ms', '最大响应时间', '']);
    rows.push(['A. 响应时间', '最小响应', round(min), 'ms', '最小响应时间', '']);
    rows.push(['A. 响应时间', '标准差 (Std)', round(std), 'ms', '响应时间总体标准差', '']);
  }

  // B. TTFT
  if (ttftArr.length > 0) {
    const avgT = mean(ttftArr) * 1000;
    const p50T = median(ttftArr) * 1000;
    const p90T = percentile(ttftArr, 0.90) * 1000;
    const p95T = percentile(ttftArr, 0.95) * 1000;
    const p99T = percentile(ttftArr, 0.99) * 1000;

    rows.push(['B. TTFT', '平均 TTFT', round(avgT), 'ms', '发送请求到收到第一个流式 token', '']);
    rows.push(['B. TTFT', '中位 TTFT (P50)', round(p50T), 'ms', '50% 请求的首 token 延迟', '']);
    rows.push(['B. TTFT', 'P90 TTFT', round(p90T), 'ms', '90% 请求的首 token 延迟', '']);
    rows.push(['B. TTFT', 'P95 TTFT', round(p95T), 'ms', '95% 请求的首 token 延迟', '']);
    rows.push(['B. TTFT', 'P99 TTFT', round(p99T), 'ms', '99% 请求的首 token 延迟', '']);
  }

  // C. 吞吐量
  rows.push(['C. 吞吐量', '总请求数', totalRequests, 'requests', '实际发出的 HTTP 请求数', '']);
  rows.push(['C. 吞吐量', '成功请求数', stats.successCount, 'requests', '返回成功的请求数', '']);
  rows.push(['C. 吞吐量', '失败请求数', stats.failureCount, 'requests', '失败的请求数', '']);
  rows.push(['C. 吞吐量', '成功率 (%)', round(successRate, 2), '%', '成功请求数/总请求数', '']);
  rows.push(['C. 吞吐量', '实际 RPM', round(actualRpm, 3), 'requests/min', '测试期间发出的请求速率', '']);
  rows.push(['C. 吞吐量', 'RPM 达成率 (%)', round(actualRpm / options.targetRpm * 100, 1), '%', '实际 RPM/目标 RPM', '']);
  rows.push(['C. 吞吐量', '实际 RPS', round(actualRps, 3), 'requests/s', '测试期间发出的请求速率', '']);
  rows.push(['C. 吞吐量', '实际间隔', round(actualInterval, 2), 'ms', '相邻请求发起时间的平均间隔', '']);
  rows.push(['C. 吞吐量', '目标间隔', round(targetInterval, 0), 'ms', '目标请求间隔', '']);
  rows.push(['C. 吞吐量', '总 Token', stats.totalTokens, 'tokens', '所有请求的 prompt + completion token 合计', '']);
  rows.push(['C. 吞吐量', '总 Prompt Token', stats.totalPromptTokens, 'tokens', '所有请求的 prompt token 合计', '']);
  rows.push(['C. 吞吐量', '总 Completion Token', stats.totalCompletionTokens, 'tokens', '所有请求的输出 token 合计', '']);
  rows.push(['C. 吞吐量', '输出 TPS', round(completionTps, 3), 'tokens/s', 'completion token/测试总时长', '']);
  rows.push(['C. 吞吐量', '平均 TPS' + (isEstimated ? ' (估算)' : ''), round(stats.getAvgTpsPerSecond(), 3), 'tokens/s', '测试总时长内平均输出吞吐', '']);
  rows.push(['C. 吞吐量', '最大 TPS/秒', round(maxTps, 0), 'tokens/s', '单秒最高 token 产出', '']);
  rows.push(['C. 吞吐量', 'Token TPS', round(tokenTps, 3), 'tokens/s', '测试总时长内总 token 吞吐', '']);

  // D. 错误分析
  rows.push(['D. 错误分析', '连接超时', stats.connectTimeoutErrors, 'count', 'CONNECT_TIMEOUT 次数', '']);
  rows.push(['D. 错误分析', '读取超时', stats.readTimeoutErrors, 'count', 'READ_TIMEOUT 次数', '']);
  rows.push(['D. 错误分析', '总超时', stats.totalTimeoutErrors, 'count', 'TOTAL_TIMEOUT 次数', '']);
  rows.push(['D. 错误分析', '服务端错误', stats.serverErrors, 'count', '5xx HTTP 状态码次数', '']);
  rows.push(['D. 错误分析', '限流错误', stats.rateLimitErrors, 'count', '429 Too Many Requests 次数', '']);

  // E. 测试配置
  rows.push(['E. 测试配置', '最大并发', options.config?.maxConcurrent || 'N/A', '', '并发连接上限', '']);
  rows.push(['E. 测试配置', 'max_tokens', options.config?.maxTokens || 'N/A', 'tokens', '单请求最大输出 token', '']);
  rows.push(['E. 测试配置', 'temperature', options.config?.temperature ?? 'N/A', '', '温度参数', '']);
  rows.push(['E. 测试配置', '连接超时', `${options.config?.connectTimeout || 100}s`, '', '连接阶段超时', '']);
  rows.push(['E. 测试配置', '读取超时', `${options.config?.readTimeout || 180}s`, '', '读取阶段超时', '']);
  rows.push(['E. 测试配置', '总超时', `${options.config?.totalTimeout || 300}s`, '', '请求全生命周期超时', '']);
  rows.push(['E. 测试配置', '实际耗时', `${stats.endTime && stats.startTime ? (stats.endTime - stats.startTime).toFixed(1) : 'N/A'}s`, '', '测试实际总耗时', '']);

  return rows;
}

function buildRequestDetailSheet(stats, modelName) {
  const rows = [];
  rows.push([`${modelName} 压力测试 - 请求明细`, '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['生成时间', new Date().toISOString(), '总请求数', stats.getTotalRequests(), '', '', '', '', '', '', '', '']);
  rows.push(['请求 ID', '状态', 'HTTP 状态码', '响应时间 ms', 'TTFT ms', 'Prompt Token', 'Completion Token', 'Total Token', '输出 TPS', '错误类型', '错误详情', '']);

  for (const req of stats.requests) {
    if (req.status === 'SUCCESS') {
      const tps = req.elapsed > 0 ? (req.completionTokens / (req.elapsed / 1000)) : 0;
      rows.push([
        req.requestId, req.status, req.httpStatus,
        round(req.elapsed, 3), round(req.ttft || 0, 3),
        req.promptTokens, req.completionTokens, req.totalTokens,
        round(tps, 3), '', '',
      ]);
    } else {
      rows.push([
        req.requestId, req.status, req.httpStatus || '',
        round(req.elapsed, 3), '',
        '', '', '',
        '', req.errorType || '', (req.errorMsg || '').slice(0, 200),
      ]);
    }
  }

  return rows;
}

function buildStatusCodeSheet(stats, modelName) {
  const rows = [];
  rows.push([`${modelName} 压力测试 - 状态码分布`, '', '', '']);
  rows.push(['生成时间', new Date().toISOString(), '总请求数', stats.getTotalRequests()]);
  rows.push(['HTTP 状态码/错误类型', '数量', '', '']);

  for (const [key, count] of stats.errorCodes.entries()) {
    rows.push([key, count, '', '']);
  }
  if (stats.errorCodes.size === 0) {
    const okCount = stats.requests.filter(r => r.status === 'SUCCESS').length;
    rows.push(['200 (OK)', okCount, '', '']);
  }

  return rows;
}

function buildErrorDetailSheet(stats, modelName) {
  const rows = [];
  const errors = stats.requests.filter(r => r.status === 'FAILED');

  rows.push([`${modelName} 压力测试 - 错误详情`, '', '', '', '', '', '']);
  rows.push(['生成时间', new Date().toISOString(), '错误数量', errors.length, '', '', '']);
  rows.push(['请求 ID', '状态', 'HTTP 状态码', '响应时间 ms', '错误类型', '错误详情', '']);

  for (const req of errors.slice(-100)) {
    rows.push([
      req.requestId, req.status, req.httpStatus || '',
      round(req.elapsed, 3), req.errorType || '', (req.errorMsg || '').slice(0, 200),
    ]);
  }

  return rows;
}

function round(v, d = 2) {
  return Number(v.toFixed(d || 0));
}

function autoFitColumns(ws, data) {
  const colWidths = [];
  for (const row of data) {
    for (let i = 0; i < row.length; i++) {
      const cell = String(row[i] ?? '');
      const w = Math.min(60, Math.max(8, cell.length * 1.3 + 2));
      colWidths[i] = Math.max(colWidths[i] || 0, w);
    }
  }
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
}

function sheetFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoFitColumns(ws, rows);
  return ws;
}

export function generateXlsxReport(stats, options, outputPath) {
  const modelName = options.modelName || 'unknown';

  const summaryRows = buildSummarySheet(stats, options, modelName);
  const detailRows = buildRequestDetailSheet(stats, modelName);
  const statusRows = buildStatusCodeSheet(stats, modelName);
  const errorRows = buildErrorDetailSheet(stats, modelName);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheetFromRows(summaryRows), '指标汇总');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(detailRows), '请求明细');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(statusRows), '状态码分布');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(errorRows), '错误详情');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  if (!options?.silent) {
    console.log(`XLSX 报告已生成: ${outputPath}`);
  }
}
