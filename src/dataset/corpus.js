import { existsSync, readFileSync } from 'fs';
import { resolve, isAbsolute, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTIN_CORPUS_ZH_PATH = join(__dirname, 'corpus', 'wiki-lite-zh.txt');
const BUILTIN_CORPUS_EN_PATH = join(__dirname, 'corpus', 'wiki-lite-en.txt');
export const BUILTIN_CORPUS_NAME = 'builtin-wiki-lite';

/**
 * 解析语料路径，支持 'zh'/'en'/'all' 快捷值和自定义文件路径
 */
export function resolveCorpusPath(inputPath) {
  if (!inputPath || inputPath === 'zh') {
    return BUILTIN_CORPUS_ZH_PATH;
  }
  if (inputPath === 'en') {
    return BUILTIN_CORPUS_EN_PATH;
  }
  if (inputPath === 'all') {
    return 'combined:zh+en';
  }

  const resolved = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);
  if (!existsSync(resolved)) {
    throw new Error(`语料文件不存在: ${inputPath}`);
  }
  return resolved;
}

export function loadCorpus(corpusPath) {
  // 支持组合语料
  if (corpusPath === 'combined:zh+en') {
    const zh = loadCorpusFile(BUILTIN_CORPUS_ZH_PATH);
    const en = loadCorpusFile(BUILTIN_CORPUS_EN_PATH);
    return zh + '\n\n' + en;
  }
  return loadCorpusFile(corpusPath);
}

function loadCorpusFile(filePath) {
  const text = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').trim();
  if (!text) {
    throw new Error(`语料文件为空: ${filePath}`);
  }
  return text;
}

function trimToTargetBytes(text, targetBytes) {
  if (Buffer.byteLength(text, 'utf-8') <= targetBytes) {
    return text;
  }

  let end = text.length;
  while (end > 0 && Buffer.byteLength(text.slice(0, end), 'utf-8') > targetBytes) {
    end = Math.floor(end * 0.92);
    if (end < 10) break;
  }

  let candidate = text.slice(0, end);
  while (candidate.length > 1 && Buffer.byteLength(candidate, 'utf-8') > targetBytes) {
    candidate = candidate.slice(0, -1);
  }
  return candidate;
}

export function sliceCorpusRandomly(text, targetBytes) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  if (Buffer.byteLength(normalized, 'utf-8') <= targetBytes) {
    return normalized;
  }

  const approxChars = Math.max(200, Math.floor(targetBytes / 1.8));
  const maxStart = Math.max(0, normalized.length - approxChars);
  const start = Math.floor(Math.random() * (maxStart + 1));
  const rough = normalized.slice(start, Math.min(normalized.length, start + approxChars + 300));
  return trimToTargetBytes(rough, targetBytes);
}
