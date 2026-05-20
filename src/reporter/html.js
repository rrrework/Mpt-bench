import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

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

export function generateHtmlReport(stats, options, outputPath) {
  const totalRequests = stats.getTotalRequests();
  const successRate = stats.getSuccessRate();
  const actualRpm = stats.getActualRpm();
  const actualRps = stats.getActualRps();
  const completionTps = stats.getCompletionTps();
  const tokenTps = stats.getTokenTps();
  const maxTps = stats.getMaxTpsPerSecond();

  let avgResp = 0, medResp = 0, p90Resp = 0, p95Resp = 0, p99Resp = 0, maxResp = 0, minResp = 0, stdResp = 0;
  if (stats.responseTimes.length > 0) {
    const arr = stats.responseTimes;
    avgResp = mean(arr) * 1000;
    medResp = median(arr) * 1000;
    p90Resp = percentile(arr, 0.90) * 1000;
    p95Resp = percentile(arr, 0.95) * 1000;
    p99Resp = percentile(arr, 0.99) * 1000;
    maxResp = Math.max(...arr) * 1000;
    minResp = Math.min(...arr) * 1000;
    stdResp = stdDev(arr) * 1000;
  }

  let avgTtft = 0, medTtft = 0, p90Ttft = 0, p95Ttft = 0, p99Ttft = 0;
  if (stats.ttftTimes.length > 0) {
    const arr = stats.ttftTimes;
    avgTtft = mean(arr) * 1000;
    medTtft = median(arr) * 1000;
    p90Ttft = percentile(arr, 0.90) * 1000;
    p95Ttft = percentile(arr, 0.95) * 1000;
    p99Ttft = percentile(arr, 0.99) * 1000;
  }

  const scenario = options?.scenario || 'N/A';
  const datasetPath = options?.dataset?.path || 'N/A';
  const datasetCount = options?.dataset?.count ?? 'N/A';
  const datasetCorpus = options?.dataset?.corpus || 'N/A';

  // TPS 时序数据
  const tpsLabels = [];
  const tpsValues = [];
  for (const sec of Object.keys(stats.completionTokensBySecond).sort((a, b) => a - b)) {
    tpsLabels.push(parseInt(sec) - Math.floor(stats.startTime));
    tpsValues.push(stats.completionTokensBySecond[sec]);
  }

  // 错误列表
  const errorItems = stats.errorMessages.slice(-20).map(e =>
    `<div class="error-item">${e.replace(/</g, '&lt;')}</div>`,
  ).join('');
  const errorCodesTable = [...stats.errorCodes.entries()].map(([k, v]) =>
    `<tr><td>${k}</td><td>${v}</td></tr>`,
  ).join('');

  const targetInterval = (60 / (options.targetRpm || 60)) * 1000;
  const actualInterval = stats.getActualInterval() * 1000;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LLM压测报告 - ${options.modelName} - ${new Date().toISOString()}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;color:#333}
.container{max-width:1400px;margin:0 auto;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center}
.header h1{font-size:2.5em;margin-bottom:10px}
.summary-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;padding:30px;background:#f8f9fa}
.card{background:white;border-radius:15px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.1);transition:transform 0.3s}
.card:hover{transform:translateY(-5px)}
.card-title{font-size:0.9em;color:#666;margin-bottom:10px;text-transform:uppercase}
.card-value{font-size:2em;font-weight:bold;color:#667eea}
.section{padding:30px;border-bottom:1px solid #e0e0e0}
.section-title{font-size:1.5em;margin-bottom:20px;color:#667eea;border-left:4px solid #667eea;padding-left:15px}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.stat-item{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0}
.stat-label{font-weight:500;color:#666}
.stat-value{font-weight:bold;color:#333}
.chart-container{margin-top:30px;padding:20px;background:#f8f9fa;border-radius:10px}
canvas{max-height:400px}
.error-list{max-height:300px;overflow-y:auto;background:#f8f9fa;border-radius:10px;padding:15px}
.error-item{padding:10px;margin:5px 0;background:white;border-left:3px solid #dc3545;border-radius:5px;font-size:0.9em;font-family:monospace}
table{width:100%;border-collapse:collapse}
th,td{padding:8px 12px;border:1px solid #e0e0e0;text-align:left}
th{background:#667eea;color:white}
.footer{background:#f8f9fa;padding:20px;text-align:center;color:#666}
.success-color{color:#28a745}.danger-color{color:#dc3545}.warning-color{color:#ffc107}
@media(max-width:768px){.summary-cards{grid-template-columns:1fr}.stats-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
<div class="header">
  <h1>LLM 压力测试报告</h1>
  <div>模型: ${options.modelName} | 场景: ${scenario} | 目标: ${options.targetRpm} RPM | 时长: ${options.duration}s</div>
  <div class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
</div>
<div class="summary-cards">
  <div class="card"><div class="card-title">总请求数</div><div class="card-value">${totalRequests.toLocaleString()}</div></div>
  <div class="card"><div class="card-title">成功率</div><div class="card-value ${successRate > 95 ? 'success-color' : successRate > 80 ? 'warning-color' : 'danger-color'}">${successRate.toFixed(2)}%</div></div>
  <div class="card"><div class="card-title">实际 RPM</div><div class="card-value">${actualRpm.toFixed(0)}<span style="font-size:0.8em;color:#999"> / ${options.targetRpm}</span></div></div>
  <div class="card"><div class="card-title">输出 TPS</div><div class="card-value">${completionTps.toFixed(0)}<span style="font-size:0.8em;color:#999"> tok/s</span></div></div>
</div>
<div class="section">
  <div class="section-title">吞吐量指标</div>
  <div class="stats-grid">
    <div>
      <div class="stat-item"><span class="stat-label">实际 RPS</span><span class="stat-value">${actualRps.toFixed(2)} req/s</span></div>
      <div class="stat-item"><span class="stat-label">RPM 达成率</span><span class="stat-value">${(actualRpm / options.targetRpm * 100).toFixed(1)}%</span></div>
      <div class="stat-item"><span class="stat-label">实际间隔</span><span class="stat-value">${actualInterval.toFixed(1)} ms</span></div>
      <div class="stat-item"><span class="stat-label">目标间隔</span><span class="stat-value">${targetInterval.toFixed(1)} ms</span></div>
    </div>
    <div>
      <div class="stat-item"><span class="stat-label">总 Token</span><span class="stat-value">${stats.totalTokens.toLocaleString()}</span></div>
      <div class="stat-item"><span class="stat-label">总 Completion Token</span><span class="stat-value">${stats.totalCompletionTokens.toLocaleString()}</span></div>
      <div class="stat-item"><span class="stat-label">平均 TPS</span><span class="stat-value">${completionTps.toFixed(2)} tok/s</span></div>
      <div class="stat-item"><span class="stat-label">最大 TPS/秒</span><span class="stat-value">${maxTps.toFixed(2)} tok/s</span></div>
    </div>
  </div>
</div>
<div class="section">
  <div class="section-title">响应时间分析</div>
  <div class="stats-grid">
    <div>
      <div class="stat-item"><span class="stat-label">平均响应</span><span class="stat-value">${avgResp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">中位响应</span><span class="stat-value">${medResp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P90 响应</span><span class="stat-value">${p90Resp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P95 响应</span><span class="stat-value">${p95Resp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P99 响应</span><span class="stat-value">${p99Resp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">最大 / 最小</span><span class="stat-value">${maxResp.toFixed(0)} / ${minResp.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">标准差</span><span class="stat-value">${stdResp.toFixed(0)} ms</span></div>
    </div>
    <div>
      <div class="stat-item"><span class="stat-label">平均 TTFT</span><span class="stat-value">${avgTtft.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">中位 TTFT</span><span class="stat-value">${medTtft.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P90 TTFT</span><span class="stat-value">${p90Ttft.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P95 TTFT</span><span class="stat-value">${p95Ttft.toFixed(0)} ms</span></div>
      <div class="stat-item"><span class="stat-label">P99 TTFT</span><span class="stat-value">${p99Ttft.toFixed(0)} ms</span></div>
    </div>
  </div>
</div>
<div class="section">
  <div class="section-title">TPS 时序图</div>
  <div class="chart-container">
    <canvas id="tpsChart"></canvas>
  </div>
  <script>
    new Chart(document.getElementById('tpsChart'), {
      type: 'line',
      data: {
        labels: ${JSON.stringify(tpsLabels)},
        datasets: [{
          label: 'Completion Tokens/s',
          data: ${JSON.stringify(tpsValues)},
          borderColor: '#667eea',
          backgroundColor: 'rgba(102,126,234,0.1)',
          fill: true, tension: 0.3, pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: 'Seconds' } },
          y: { title: { display: true, text: 'Tokens/s' }, beginAtZero: true }
        }
      }
    });
  </script>
</div>
<div class="section">
  <div class="section-title">错误统计</div>
  <div class="stats-grid">
    <div>
      <h4>错误码分布</h4>
      <table>${errorCodesTable || '<tr><td>无</td><td>0</td></tr>'}</table>
    </div>
    <div>
      <h4>超时分类</h4>
      <div class="stat-item"><span class="stat-label">连接超时</span><span class="stat-value">${stats.connectTimeoutErrors}</span></div>
      <div class="stat-item"><span class="stat-label">读取超时</span><span class="stat-value">${stats.readTimeoutErrors}</span></div>
      <div class="stat-item"><span class="stat-label">总超时</span><span class="stat-value">${stats.totalTimeoutErrors}</span></div>
      <div class="stat-item"><span class="stat-label">服务端错误(5xx)</span><span class="stat-value">${stats.serverErrors}</span></div>
      <div class="stat-item"><span class="stat-label">限流(429)</span><span class="stat-value">${stats.rateLimitErrors}</span></div>
    </div>
  </div>
  ${errorItems ? `<h4 style="margin-top:20px">最近错误详情</h4><div class="error-list">${errorItems}</div>` : ''}
</div>
<div class="section">
  <div class="section-title">⚙️ 测试配置</div>
  <div class="stats-grid">
    <div>
      <div class="stat-item"><span class="stat-label">模型</span><span class="stat-value">${options.modelName}</span></div>
      <div class="stat-item"><span class="stat-label">场景</span><span class="stat-value">${scenario}</span></div>
      <div class="stat-item"><span class="stat-label">数据集</span><span class="stat-value">${datasetPath}</span></div>
      <div class="stat-item"><span class="stat-label">数据集条数</span><span class="stat-value">${datasetCount}</span></div>
      <div class="stat-item"><span class="stat-label">语料来源</span><span class="stat-value">${datasetCorpus}</span></div>
      <div class="stat-item"><span class="stat-label">目标 RPM</span><span class="stat-value">${options.targetRpm}</span></div>
      <div class="stat-item"><span class="stat-label">压测时长</span><span class="stat-value">${options.duration} 秒</span></div>
      <div class="stat-item"><span class="stat-label">最大并发</span><span class="stat-value">${options.config?.maxConcurrent ?? 'N/A'}</span></div>
    </div>
    <div>
      <div class="stat-item"><span class="stat-label">max_tokens</span><span class="stat-value">${options.config?.maxTokens ?? 'N/A'}</span></div>
      <div class="stat-item"><span class="stat-label">temperature</span><span class="stat-value">${options.config?.temperature ?? 'N/A'}</span></div>
      <div class="stat-item"><span class="stat-label">超时配置</span><span class="stat-value">连接${options.config?.connectTimeout ?? 100}s / 读取${options.config?.readTimeout ?? 180}s / 总${options.config?.totalTimeout ?? 300}s</span></div>
        <div class="stat-item"><span class="stat-label">实际耗时</span><span class="stat-value">${stats.endTime && stats.startTime ? (stats.endTime - stats.startTime).toFixed(1) : 'N/A'} 秒</span></div>
    </div>
  </div>
</div>
<div class="footer">MPT - Model Performance Test | 自动生成</div>
</div>
</body>
</html>`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf-8');
  if (!options?.silent) {
    console.log(`报告已生成: ${outputPath}`);
  }
}
