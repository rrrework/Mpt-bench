import { readdirSync, statSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getResultsDir, openFile } from '../utils/workspace.js';

export async function reportLatest(options) {
  const dir = getResultsDir();
  if (!existsSync(dir)) {
    console.log('还没有生成过报告');
    return;
  }
  const files = readdirSync(dir).filter(f => f.endsWith('.html'));
  if (files.length === 0) {
    console.log('没有找到报告');
    return;
  }
  const latest = files.map(f => ({ name: f, time: statSync(resolve(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time)[0];
  const fullPath = resolve(dir, latest.name);
  console.log(`最新报告: ${fullPath}`);
  if (options?.open) {
    openFile(fullPath);
  }
}

export function reportList(options) {
  const dir = getResultsDir();
  if (!existsSync(dir)) {
    console.log('还没有生成过报告');
    return;
  }
  const files = readdirSync(dir).filter(f => f.endsWith('.html'));
  if (files.length === 0) {
    console.log('没有找到报告');
    return;
  }
  console.log(`报告目录: ${dir}\n`);
  for (const f of files) {
    const s = statSync(resolve(dir, f));
    const size = (s.size / 1024).toFixed(1);
    const time = s.mtime.toLocaleString('zh-CN');
    console.log(`${f.padEnd(50)} ${size}KB  ${time}`);
  }
}

export async function reportCompare(options) {
  const reports = options?.reports || [];
  if (reports.length < 2) {
    console.log('请提供至少两个报告文件进行对比');
    return;
  }
  console.log('对比功能开发中...');
}
