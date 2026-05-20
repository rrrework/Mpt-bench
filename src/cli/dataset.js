import { generateDataset as gen } from '../dataset/generator.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { getDatasetsDir } from '../utils/workspace.js';

export async function datasetGen(options) {
  const datasetsDir = getDatasetsDir();
  mkdirSync(datasetsDir, { recursive: true });
  const outputName = options.output || 'default.json';
  const outputPath = resolve(datasetsDir, outputName);
  mkdirSync(dirname(outputPath), { recursive: true });

  const preset = options.preset || 'default';
  const targetKb = parseInt(options.targetKb || options.sizeKb, 10) || 10;
  const count = parseInt(options.count, 10) || 100;

  const dataset = gen({
    preset,
    count,
    targetKb,
    sizeKb: targetKb,
    corpus: options.corpus || null,
  });

  writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf-8');

  console.log(`\n数据集已保存到: ${outputPath}`);
  console.log(`preset=${preset}, count=${count}, targetKb=${targetKb}${dataset.meta?.corpus ? `, corpus=${dataset.meta.corpus}` : ''}`);
  console.log(`后续压测将自动使用此数据集`);
}

export function datasetImport(options) {
  const filePath = options.file;
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const text = readFileSync(filePath, 'utf-8');
  let prompts = null;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      prompts = parsed.map(item => (typeof item === 'string' ? item : item?.content)).filter(Boolean);
    } else if (parsed && Array.isArray(parsed.items)) {
      prompts = parsed.items.map(item => (typeof item === 'string' ? item : item?.content)).filter(Boolean);
    }
  } catch {
    // fallback to plain text lines
  }

  if (!prompts) {
    prompts = text.split('\n').filter(line => line.trim());
  }

  if (prompts.length === 0) {
    throw new Error('文件内容为空');
  }

  const datasetsDir = getDatasetsDir();
  mkdirSync(datasetsDir, { recursive: true });
  const baseName = filePath.replace(/\\|\/|:/g, '_').replace(/\.[^.]+$/, '.json');
  const outFile = resolve(datasetsDir, baseName);
  writeFileSync(outFile, JSON.stringify(prompts, null, 2), 'utf-8');
  console.log(`导入完成: ${prompts.length} 条 → ${outFile}`);
}
