import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { datasetImport } from '../src/cli/dataset.js';
import { getDatasetsDir } from '../src/utils/workspace.js';

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      cwd: projectRoot,
      windowsHide: true,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

test('run help should expose scenario option for scenario-tagged reports', async () => {
  const result = await runNode(['bin/mpt.js', 'run', '--help']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /--scenario <name>/);
});

test('dataset gen help should expose preset, target-kb and corpus options', async () => {
  const result = await runNode(['bin/mpt.js', 'dataset', 'gen', '--help']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /--preset <name>/);
  assert.match(result.stdout, /--target-kb <number>/);
  assert.match(result.stdout, /--corpus <path>/);
});

test('dataset gen short preset should produce object dataset with short scenario metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-short-'));
  const output = join(dir, 'short.json');

  try {
    const result = await runNode(['bin/mpt.js', 'dataset', 'gen', '--preset', 'short', '-n', '5', '-o', output]);
    assert.equal(result.code, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);

    const raw = JSON.parse(readFileSync(output, 'utf-8'));
    assert.equal(raw.meta.scenario, 'short');
    assert.equal(raw.items.length, 5);
    assert.ok(raw.items.every(item => typeof item.content === 'string'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dataset gen long-summary should support external corpus and preserve corpus metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-long-'));
  const corpusFile = join(dir, 'corpus.txt');
  const output = join(dir, 'long-summary.json');
  writeFileSync(corpusFile, '第一段测试语料。\n\n第二段测试语料。\n\n第三段测试语料。', 'utf-8');

  try {
    const result = await runNode([
      'bin/mpt.js',
      'dataset',
      'gen',
      '--preset',
      'long-summary',
      '--corpus',
      corpusFile,
      '--target-kb',
      '4',
      '-n',
      '2',
      '-o',
      output,
    ]);

    assert.equal(result.code, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);

    const raw = JSON.parse(readFileSync(output, 'utf-8'));
    assert.equal(raw.meta.scenario, 'long-summary');
    assert.equal(raw.meta.corpus, corpusFile);
    assert.equal(raw.items.length, 2);
    assert.match(raw.items[0].content, /请.*综述|请.*总结|请.*提炼|请.*概括|请.*分析|请.*提取|请.*比较|请.*评述|请.*改写|Summarize|Provide|Extract/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('dataset import should support JSON array and plain text files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mpt-import-'));
  const jsonFile = join(dir, 'json-prompts.json');
  const txtFile = join(dir, 'text-prompts.txt');
  writeFileSync(jsonFile, JSON.stringify(['第一条', '第二条'], null, 2), 'utf-8');
  writeFileSync(txtFile, '第三条\n第四条\n', 'utf-8');

  try {
    datasetImport({ file: jsonFile });
    datasetImport({ file: txtFile });

    const jsonOut = join(getDatasetsDir(), jsonFile.replace(/\\|\/|:/g, '_').replace(/\.[^.]+$/, '.json'));
    const txtOut = join(getDatasetsDir(), txtFile.replace(/\\|\/|:/g, '_').replace(/\.[^.]+$/, '.json'));

    const importedJson = JSON.parse(readFileSync(jsonOut, 'utf-8'));
    const importedTxt = JSON.parse(readFileSync(txtOut, 'utf-8'));

    assert.deepEqual(importedJson, ['第一条', '第二条']);
    assert.deepEqual(importedTxt, ['第三条', '第四条']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
