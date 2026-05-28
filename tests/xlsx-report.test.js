import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import XLSX from 'xlsx';
import { generateXlsxReport } from '../src/reporter/xlsx.js';

function createFakeStats(overrides = {}) {
  return {
    successCount: 2,
    failureCount: 1,
    responseTimes: [0.5, 1.0, 1.5],
    ttftTimes: [0.1, 0.2, 0.3],
    sentTimestamps: [1, 3, 5],
    errorMessages: [],
    errorCodes: new Map([['HTTP_200', 2], ['CONNECT_TIMEOUT', 1]]),
    requests: [
      { requestId: 's0-1', status: 'SUCCESS', elapsed: 500, ttft: 100, promptTokens: 16, completionTokens: 128, totalTokens: 144, httpStatus: 200 },
      { requestId: 's1-2', status: 'SUCCESS', elapsed: 1000, ttft: 200, promptTokens: 16, completionTokens: 256, totalTokens: 272, httpStatus: 200 },
      { requestId: 's2-3', status: 'FAILED', elapsed: 1500, ttft: null, promptTokens: 0, completionTokens: 0, totalTokens: 0, httpStatus: null, errorType: 'CONNECT_TIMEOUT', errorMsg: 'connection aborted' },
    ],
    connectTimeoutErrors: 1,
    readTimeoutErrors: 0,
    totalTimeoutErrors: 0,
    serverErrors: 0,
    rateLimitErrors: 0,
    totalTokens: 416,
    totalCompletionTokens: 384,
    totalPromptTokens: 32,
    completionTokensBySecond: { 1: 10, 2: 20, 3: 30 },
    promptTokensBySecond: { 1: 5, 2: 5, 3: 5 },
    startTime: 1,
    endTime: 13,
    ...overrides,
    getTotalRequests() { return this.successCount + this.failureCount; },
    getSuccessRate() { return this.successCount / (this.successCount + this.failureCount) * 100; },
    getActualRpm() { return (this.successCount + this.failureCount) / ((this.endTime - this.startTime) / 60); },
    getActualRps() { return (this.successCount + this.failureCount) / (this.endTime - this.startTime); },
    getCompletionTps() { return this.totalCompletionTokens / (this.endTime - this.startTime); },
    getTokenTps() { return this.totalTokens / (this.endTime - this.startTime); },
    getMaxTpsPerSecond() { return Math.max(...Object.values(this.completionTokensBySecond)); },
    getAvgTpsPerSecond() { return Object.values(this.completionTokensBySecond).reduce((a, b) => a + b, 0) / Object.keys(this.completionTokensBySecond).length; },
    getActualInterval() { return 2; },
  };
}

const baseOptions = {
  modelName: 'test-model',
  targetRpm: 60,
  duration: 120,
  scenario: 'short',
  dataset: {
    path: '/data/test.json',
    count: 500,
    corpus: 'builtin-wiki',
  },
  silent: true,
  config: {
    maxConcurrent: 100,
    connectTimeout: 100,
    readTimeout: 180,
    totalTimeout: 300,
    maxTokens: 2048,
    temperature: 0.7,
  },
  apiUrl: 'https://api.example.com/v1',
  timestamp: '2026-05-28T12:00:00.000Z',
  scheduleMode: 'adaptive',
  stream: true,
};

test('xlsx: generates file with correct 4-sheet structure', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    assert.ok(existsSync(output), 'xlsx file should exist');

    const wb = XLSX.readFile(output);
    assert.deepEqual(wb.SheetNames, ['指标汇总', '请求明细', '状态码分布', '错误详情']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: summary sheet contains all metric categories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['指标汇总'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const text = JSON.stringify(data);
    assert.match(text, /test-model/, 'should include model name');

    const categories = data.filter(row => row[0] && row[0].match(/^[A-E]\./));
    const catNames = categories.map(r => r[0]);
    assert.ok(catNames.some(c => c.startsWith('A.')), 'should have response time category');
    assert.ok(catNames.some(c => c.startsWith('B.')), 'should have TTFT category');
    assert.ok(catNames.some(c => c.startsWith('C.')), 'should have throughput category');
    assert.ok(catNames.some(c => c.startsWith('D.')), 'should have error analysis category');
    assert.ok(catNames.some(c => c.startsWith('E.')), 'should have test config category');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: summary sheet includes all input parameters in header', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['指标汇总'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerText = JSON.stringify(data.slice(0, 8));
    assert.match(headerText, /test-model/);
    assert.match(headerText, /short/);
    assert.match(headerText, /60/);
    assert.match(headerText, /100/);
    assert.match(headerText, /500/);
    assert.match(headerText, /builtin-wiki/);
    assert.match(headerText, /adaptive/);
    assert.match(headerText, /ON/);
    assert.match(headerText, /120s/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: request detail sheet contains per-request data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['请求明细'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    assert.ok(data.length >= 6, 'should have header rows + 3 data rows');
    const reqIds = data.slice(3).map(r => r[0]).filter(Boolean);
    assert.ok(reqIds.includes('s0-1'));
    assert.ok(reqIds.includes('s1-2'));
    assert.ok(reqIds.includes('s2-3'));

    const successRow = data.find(r => r[0] === 's1-2');
    assert.equal(successRow[1], 'SUCCESS');
    assert.equal(successRow[2], 200);
    assert.ok(Number(successRow[3]) > 0, 'should have response time');
    assert.ok(Number(successRow[4]) > 0, 'should have TTFT');

    const failRow = data.find(r => r[0] === 's2-3');
    assert.equal(failRow[1], 'FAILED');
    assert.equal(failRow[9], 'CONNECT_TIMEOUT');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: status code sheet counts correctly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['状态码分布'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const text = JSON.stringify(data);
    assert.match(text, /HTTP_200/);
    assert.match(text, /CONNECT_TIMEOUT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: error detail sheet logs failure requests', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['错误详情'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const text = JSON.stringify(data);
    assert.match(text, /CONNECT_TIMEOUT/);
    assert.match(text, /connection aborted/);
    assert.match(text, /s2-3/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('xlsx: summary reports correct response time and TTFT percentiles', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-xlsx-'));
  const output = join(dir, 'report.xlsx');
  try {
    generateXlsxReport(createFakeStats(), baseOptions, output);
    const wb = XLSX.readFile(output);
    const ws = wb.Sheets['指标汇总'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const text = JSON.stringify(data);
    assert.match(text, /P90/);
    assert.match(text, /P95/);
    assert.match(text, /P99/);
    assert.match(text, /TTFT/);
    assert.match(text, /成功率/);
    assert.match(text, /连接超时/);
    assert.match(text, /读取超时/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
