# MPT (Model Performance Test)

MPT 是一个面向 OpenAI 兼容 API 的 LLM 压测工具，支持：

- 单模型压测（`mpt run`）
- 同渠道多模型横评（`mpt benchmark`）
- 数据集生成（`mpt dataset gen`）
- HTML 报告（响应/TTFT/TPS/成功率/分位数）

## 快速开始

```bash
npm install
npx mpt --help
```

> 若你在仓库内开发，也可以用：`node bin/mpt.js --help`

## 场景化专项测试（已实现）

### 1) 生成短请求数据集

```bash
npx mpt dataset gen --preset short -n 100 -o short.json
```

### 2) 生成长综述数据集（固定语料随机截断）

```bash
npx mpt dataset gen --preset long-summary --target-kb 256 -n 20 -o long-summary.json
```

可指定外部语料：

```bash
npx mpt dataset gen --preset long-summary --corpus ./my-corpus.txt --target-kb 128 -n 10 -o long-custom.json
```

### 3) 运行场景化压测

```bash
npx mpt run --dataset short.json --scenario short
npx mpt run --dataset long-summary.json --scenario long-summary
```

`run` 同时兼容两种数据集格式：

- 旧格式：`["prompt1", "prompt2"]`
- 新格式：`{ "meta": {...}, "items": [{"content":"..."}] }`

## 报告增强

HTML 报告已包含：

- `P90 响应`
- `P90 TTFT`
- 场景 / 数据集 / 数据集条数 / 语料来源信息

报告文件名包含场景标签：

```text
{model}_{scenario}_{timestamp}_report.html
```

## 帮助命令

```bash
npx mpt run -h
npx mpt dataset gen -h
```
