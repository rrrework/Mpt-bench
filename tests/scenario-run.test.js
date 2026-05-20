import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../src/cli/run.js';

function makeConfig() {
  return {
    defaults: { rpm: 60, duration: 120, max_concurrent: 10, schedule_mode: 'adaptive', second_threshold: 600 },
    timeout: { connect: 100, read: 180, total: 300 },
    request: { max_tokens: 2048, temperature: 0.7 },
    channels: [{ name: 'base-channel', model: 'base-model', enabled: true }],
  };
}

function makeStats() {
  return {
    successCount: 2,
    failureCount: 0,
    responseTimes: [0.5, 1.0],
    ttftTimes: [0.1, 0.2],
    completionTokensBySecond: { 1: 10 },
    errorMessages: [],
    errorCodes: new Map(),
    connectTimeoutErrors: 0,
    readTimeoutErrors: 0,
    totalTimeoutErrors: 0,
    serverErrors: 0,
    rateLimitErrors: 0,
    totalTokens: 50,
    totalCompletionTokens: 20,
    startTime: 1,
    endTime: 5,
    getTotalRequests() { return 2; },
    getSuccessRate() { return 100; },
    getActualRpm() { return 30; },
    getActualRps() { return 0.5; },
    getCompletionTps() { return 5; },
    getTokenTps() { return 10; },
    getMaxTpsPerSecond() { return 10; },
    getActualInterval() { return 2; },
  };
}

test('runCommand should honor output dir and keep json stdout machine-safe', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-run-json-'));
  const datasetFile = join(dir, 'short.json');
  const outputDir = join(dir, 'reports');
  writeFileSync(datasetFile, JSON.stringify({ meta: { scenario: 'short' }, items: [{ content: '你好' }] }, null, 2), 'utf-8');

  const emitted = [];
  let generatedPath = null;

  try {
    await runCommand({
      channel: 'base-channel',
      dataset: datasetFile,
      output: outputDir,
      format: 'json',
      config: 'unused.yaml',
      model: 'override-model',
    }, {
      loadConfig: () => makeConfig(),
      getChannel: (config, name) => config.channels.find(ch => ch.name === name),
      getEnabledChannels: config => config.channels.filter(ch => ch.enabled !== false),
      runScheduler: async (channel, dataset, stats) => {
        Object.assign(stats, makeStats());
      },
      generateHtmlReport: (stats, options, reportPath) => {
        generatedPath = reportPath;
        writeFileSync(reportPath, '<html></html>', 'utf-8');
      },
      errorLogger: { init() {}, close() {} },
      emit: msg => emitted.push(String(msg)),
    });

    assert.equal(emitted.length, 1, `expected single JSON payload, got: ${emitted.join('\n')}`);
    const payload = JSON.parse(emitted[0]);
    assert.equal(payload[0].scenario, 'short');
    assert.equal(payload[0].model, 'override-model');
    assert.ok(generatedPath.startsWith(outputDir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
