import { writeFileSync } from 'fs';

// 行业领域
const INDUSTRIES = ['金融科技', '医疗健康', '智能制造', '自动驾驶', '电子商务', '在线教育', '新能源', '半导体', '航空航天', '智慧农业', '元宇宙', '网络安全', '物流供应链'];
// 任务类型
const TASK_TYPES = ['深度分析报告', '系统性阐述', '详细可行性评估', '技术白皮书撰写', '全面风险评估', '核心架构设计说明', '战略规划与路线图制定'];
// 业务场景
const CONTEXT_TYPES = ['企业内部技术升级', '跨国项目合作', '政府监管合规要求', '初创公司融资路演', '学术研究与实验验证', '开源社区生态建设', '传统行业数字化转型'];

// 按技术领域分组的概念池（解决"张冠李戴"问题）
const TOPIC_CLUSTERS = {
  '大模型': {
    concepts: ['大语言模型(LLM)', '多模态大模型', '长上下文窗口', '检索增强生成(RAG)', '指令微调(SFT)', '人类反馈强化学习(RLHF)', '思维链推理(CoT)', 'Agent智能体'],
    challenges: ['幻觉问题与事实可靠性', '长文本理解能力不足', '推理成本居高不下', '中文能力有待加强', '多轮对话上下文丢失', '领域知识注入困难'],
    solutions: ['构建高质量指令数据集', '引入RAG结合外部知识库', '采用混合专家(MoE)降低推理成本', '实施多阶段对齐训练', '部署向量数据库增强检索'],
    impacts: ['重塑内容生产与知识管理方式', '推动人机交互范式革新', '加速企业数字化转型进程', '改变软件开发与测试模式'],
  },
  'AI架构': {
    concepts: ['Transformer架构', '混合专家架构(MoE)', '神经架构搜索(NAS)', '模型蒸馏与压缩', '1-bit量化部署', '分布式训练框架', '边缘推理优化'],
    challenges: ['模型参数爆炸与显存瓶颈', '训练稳定性与收敛速度', '边缘设备算力受限', '多卡通信开销巨大', '推理延迟难以满足实时需求'],
    solutions: ['采用张量并行与流水线并行策略', '引入Flash Attention优化注意力计算', '使用INT4/INT8量化压缩模型', '构建模型推理服务(MaaS)平台', '部署KV Cache与前缀缓存'],
    impacts: ['推动AI基础设施规模化发展', '催生专用AI芯片市场', '加速大模型平民化进程', '改变云计算资源分配模式'],
  },
  '多模态': {
    concepts: ['视觉语言模型(VLM)', '扩散模型与图像生成', '视频理解与生成', '语音识别与合成', '跨模态检索', '3D生成与理解', '多模态对齐'],
    challenges: ['多模态特征对齐困难', '高质量多模态数据稀缺', '生成内容可控性不足', '视频理解时序建模复杂', '实时多模态交互延迟高'],
    solutions: ['构建多模态预训练数据集', '采用对比学习对齐表征', '引入可控生成与编辑技术', '部署流式多模态处理管线', '实施人类偏好对齐'],
    impacts: ['革新创意设计与内容生产', '推动具身智能发展', '改变影视制作与娱乐方式', '加速医疗影像智能诊断普及'],
  },
  'AI安全与治理': {
    concepts: ['AI对齐与安全', '可解释AI(XAI)', '隐私计算与联邦学习', '对抗鲁棒性', '公平性与去偏见', 'AI伦理治理框架', '红队测试与安全评测'],
    challenges: ['模型黑盒与不可解释性', '数据隐私泄露风险', '对抗样本攻击威胁', '算法偏见与歧视', '滥用风险与安全边界模糊', '监管合规成本高'],
    solutions: ['引入可解释性技术(SHAP/LIME)', '实施差分隐私与数据脱敏', '建立AI安全评测基准', '构建AI伦理审查委员会', '推行安全开发全生命周期管理'],
    impacts: ['推动AI治理法规体系建设', '增强公众对AI技术的信任', '规范AI商业化应用边界', '促进负责任AI生态发展'],
  },
  '行业应用': {
    concepts: ['智能风控与反欺诈', 'AI辅助药物研发', '自动驾驶感知与规划', '个性化推荐引擎', '智能客服与对话系统', '工业质检与缺陷检测', '智慧城市与交通优化'],
    challenges: ['行业数据孤岛严重', '业务场景碎片化', 'ROI验证周期长', '传统系统集成困难', '终端用户接受度低', '监管政策不确定性'],
    solutions: ['构建行业数据中台', '采用MLOps标准化模型管理', '实施渐进式AI落地策略', '建立产学研联合创新中心', '部署低代码AI开发平台'],
    impacts: ['驱动行业效率革命性提升', '催生AI原生业务模式', '改变人才需求与技能结构', '加速传统产业数字化转型'],
  },
};

const TOPIC_KEYS = Object.keys(TOPIC_CLUSTERS);

function pick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成围绕同一主题的连贯列表项（不复读、不张冠李戴）
 */
function generateListFrom(pool, minN, maxN, suffixTemplates) {
  const k = Math.floor(Math.random() * (maxN - minN + 1)) + minN;
  const items = pick(pool, k);
  return items.map((item, i) => {
    const suffix = pickOne(suffixTemplates);
    return `${i + 1}. ${item}：${suffix}`;
  }).join('\n');
}

// 多样化的后缀模板（解决"复读机"问题）
const CONCEPT_SUFFIXES = [
  '请从技术原理、发展现状和未来趋势三个维度进行分析。',
  '重点讨论其核心技术机制、适用场景和当前局限性。',
  '结合最新的学术研究成果和工业界实践进行阐述。',
  '分析该技术的关键创新点、工程挑战和优化方向。',
  '从理论基础、实现路径和产业应用角度展开讨论。',
  '评估该技术方案的成熟度、可扩展性和商业可行性。',
  '梳理其技术演进脉络，指出当前阶段的突破方向。',
];

const CHALLENGE_SUFFIXES = [
  '请分析其根本原因、影响范围和可能的缓解策略。',
  '从技术和管理两个角度评估该挑战的严重程度。',
  '讨论该问题的行业现状和前沿应对方案。',
  '评估其对业务连续性和系统稳定性的潜在影响。',
  '分析该挑战在不同场景下的表现形式和差异。',
];

const SOLUTION_SUFFIXES = [
  '请详细说明实施路径、所需资源和预期效果。',
  '从技术可行性和成本效益两个角度进行评估。',
  '讨论该方案的适用条件、实施步骤和风险控制。',
  '分析其技术依赖、团队能力要求和迭代优化方向。',
  '结合行业最佳实践，给出具体的落地建议。',
];

const IMPACT_SUFFIXES = [
  '请从短期和长期两个维度分析其影响深度和广度。',
  '讨论其对产业链上下游的连锁反应和重塑效应。',
  '分析其对现有竞争格局和市场结构的改变。',
  '评估其对组织形态和人才能力模型的重构作用。',
  '从社会、经济和技术三个层面综合分析其影响。',
];

function generateSinglePrompt() {
  const industry = pickOne(INDUSTRIES);
  const task = pickOne(TASK_TYPES);
  const context = pickOne(CONTEXT_TYPES);
  const topicKey = pickOne(TOPIC_KEYS);
  const cluster = TOPIC_CLUSTERS[topicKey];
  const mainConcept = pickOne(cluster.concepts);

  return `请为${industry}领域撰写一份关于"${mainConcept}"的${task}。

背景：针对${context}场景，重点考察技术演进与业务影响。

============================================================================
一、核心概念与演进历程
============================================================================
请阐述"${mainConcept}"的定义、核心原理及关键里程碑。

${generateListFrom(cluster.concepts, 4, 6, CONCEPT_SUFFIXES)}

============================================================================
二、技术架构与实现
============================================================================
分析实现${mainConcept}所需的技术栈、核心算法和系统设计。

${generateListFrom(cluster.concepts, 3, 5, CONCEPT_SUFFIXES)}

============================================================================
三、应用场景与案例
============================================================================
在${industry}中的典型应用，含场景描述、解决方案、量化指标。

${generateListFrom(cluster.impacts, 3, 5, IMPACT_SUFFIXES)}

============================================================================
四、挑战与策略
============================================================================
关键挑战：
${generateListFrom(cluster.challenges, 4, 6, CHALLENGE_SUFFIXES)}

应对策略：
${generateListFrom(cluster.solutions, 4, 6, SOLUTION_SUFFIXES)}

============================================================================
五、未来展望
============================================================================
基于技术成熟度与市场趋势的3-5年预测。

要求：专业深入，逻辑严谨，总字数不少于3000字。`;
}

export function generateDataset({ count = 100, sizeKb = 10, output = 'default.json' } = {}) {
  const dataset = [];
  const targetBytes = sizeKb * 1024;

  for (let i = 0; i < count; i++) {
    const prompt = generateSinglePrompt();
    // 不再暴力填充——单次生成即足够大（约3-6KB）
    // 如果需要更大的 prompt，用户可以增大 sizeKb，但不再循环堆砌
    dataset.push(prompt);
    if ((i + 1) % 50 === 0 || i === count - 1) {
      const avg = dataset.reduce((s, p) => s + Buffer.byteLength(p, 'utf-8'), 0) / dataset.length / 1024;
      console.log(`已生成 ${i + 1}/${count} 条，平均大小: ${avg.toFixed(2)} KB`);
    }
  }

  writeFileSync(output, JSON.stringify(dataset, null, 2), 'utf-8');
  const sizeMb = Buffer.byteLength(JSON.stringify(dataset), 'utf-8') / (1024 * 1024);
  const avgKb = dataset.reduce((s, p) => s + Buffer.byteLength(p, 'utf-8'), 0) / dataset.length / 1024;
  console.log(`\n✅ 数据集生成完成！`);
  console.log(`文件: ${output}`);
  console.log(`条数: ${dataset.length}`);
  console.log(`平均大小: ${avgKb.toFixed(2)} KB/条`);
  console.log(`总大小: ${sizeMb.toFixed(2)} MB`);
  return dataset;
}
