import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateHtmlReport } from '../src/reporter/html.js';

function createFakeStats() {
  return {
    successCount: 2,
    failureCount: 1,
    responseTimes: [0.5, 1.0, 1.5],
    ttftTimes: [0.1, 0.2, 0.3],
    completionTokensBySecond: { 1: 10, 2: 20 },
    errorMessages: [],
    errorCodes: new Map(),
    connectTimeoutErrors: 0,
    readTimeoutErrors: 0,
    totalTimeoutErrors: 0,
    serverErrors: 0,
    rateLimitErrors: 0,
    totalTokens: 120,
    totalCompletionTokens: 60,
    startTime: 1,
    endTime: 13,
    getTotalRequests() { return 3; },
    getSuccessRate() { return 66.67; },
    getActualRpm() { return 30; },
    getActualRps() { return 0.5; },
    getCompletionTps() { return 5; },
    getTokenTps() { return 10; },
    getMaxTpsPerSecond() { return 20; },
    getActualInterval() { return 2; },
  };
}

test('generated report should include P90 metrics and scenario dataset metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-report-'));
  const output = join(dir, 'report.html');

  try {
    generateHtmlReport(createFakeStats(), {
      modelName: 'demo-model',
      targetRpm: 60,
      duration: 120,
      scenario: 'short',
      dataset: {
        path: 'demo.json',
        count: 3,
        corpus: 'builtin-wiki-lite',
      },
      config: {
        maxConcurrent: 10,
        connectTimeout: 100,
        readTimeout: 180,
        totalTimeout: 300,
        maxTokens: 2048,
        temperature: 0.7,
      },
    }, output);

    const html = readFileSync(output, 'utf-8');
    assert.match(html, /P90 响应/);
    assert.match(html, /P90 TTFT/);
    assert.match(html, /场景/);
    assert.match(html, /数据集/);
    assert.match(html, /数据集条数/);
    assert.match(html, /语料来源/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
