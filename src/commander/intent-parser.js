/**
 * 战略层 - 消费意图拆解引擎（Commander / Intent Parser）
 * 将模糊的自然语言消费意图转化为结构化约束对象。
 *
 * 核心能力：
 * 1. 场景识别（露营 / 亲子游 / 通用购物）
 * 2. 消费语义理解：提取隐性约束（预算、时效、重量、亲疏关系等）
 * 3. 结合用户记忆补全未明说的约束（如尺码、忌口、车程容忍度）
 */

// ---------- 场景识别规则 ----------
const SCENE_RULES = [
  {
    scene: 'camping',
    label: '露营装备',
    keywords: ['露营', '野营', '帐篷', '营地', '户外过夜', 'camping'],
    defaultCategories: ['帐篷', '睡眠系统', '炊具', '照明', '背包']
  },
  {
    scene: 'family-trip',
    label: '亲子短途游',
    keywords: ['亲子游', '带孩子', '家庭游', '周末游', '短途游', '遛娃', '三口之家'],
    defaultCategories: ['交通', '住宿', '门票', '餐饮']
  },
  {
    scene: 'hiking',
    label: '徒步出行',
    keywords: ['徒步', '登山', '远足', 'hiking'],
    defaultCategories: ['鞋类', '背包', '服装']
  }
];

// ---------- 预算解析 ----------
function parseBudget(text) {
  const patterns = [
    /预算[不超过最多约]?\s*(\d+(?:\.\d+)?)\s*[千kK]/g,
    /(\d+(?:\.\d+)?)\s*[千kK]\s*[以内之内以下]/g,
    /预算\s*(\d+)/g,
    /(\d{3,5})\s*元?\s*[以内之内以下]/g
  ];
  for (const p of patterns) {
    const m = [...text.matchAll(p)];
    if (m.length) {
      let val = parseFloat(m[0][1]);
      if (/千|k|K/.test(m[0][0])) val *= 1000;
      return { total: Math.round(val), raw: m[0][0].trim() };
    }
  }
  return null;
}

// ---------- 时效解析 ----------
function parseDeadline(text) {
  const now = new Date('2026-10-26T00:00:00');
  if (/周五|这周五|星期五/.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
    return { date: d.toISOString().slice(0, 10), label: '本周五', urgency: 'high' };
  }
  if (/明天|明日/.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return { date: d.toISOString().slice(0, 10), label: '明天', urgency: 'critical' };
  }
  if (/下周/.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + 10);
    return { date: d.toISOString().slice(0, 10), label: '下周', urgency: 'medium' };
  }
  if (/这?周末/.test(text)) {
    const d = new Date(now); d.setDate(d.getDate() + 6);
    return { date: d.toISOString().slice(0, 10), label: '本周末', urgency: 'high' };
  }
  return null;
}

// ---------- 硬性约束解析（重量/人数/尺寸等） ----------
function parseHardConstraints(text) {
  const constraints = [];
  // 重量约束
  const weightM = text.match(/(?:别太重|轻便|轻量|不超过|控制在)\s*(\d+(?:\.\d+)?)\s*[kg公]?[斤克]?/);
  if (weightM || /别太重|越轻越好|轻便/.test(text)) {
    constraints.push({
      type: 'weight',
      label: '重量上限',
      value: weightM ? parseFloat(weightM[1]) : 8,
      unit: 'kg',
      strict: !!weightM
    });
  }
  // 人数约束（数字须紧跟人/个/口，避免误匹配预算金额）
  const peopleM = text.match(/(\d+)\s*[人个口]/);
  if (peopleM) {
    constraints.push({
      type: 'people', label: '使用人数',
      value: parseInt(peopleM[1]), unit: '人', strict: true
    });
  }
  // 季节/温度约束
  if (/冬天|冬季|低温|寒冷/.test(text)) {
    constraints.push({ type: 'season', label: '季节', value: 'winter', strict: true });
  } else if (/秋天|秋季|春秋/.test(text)) {
    constraints.push({ type: 'season', label: '季节', value: 'autumn', strict: false });
  }
  return constraints;
}

// ---------- 品类分解 ----------
function parseCategories(text, scene) {
  const rule = SCENE_RULES.find(r => r.scene === scene);
  if (!rule) return [];
  const mentioned = [];
  const categoryKeywords = {
    '帐篷': ['帐篷', '天幕'], '睡眠系统': ['睡袋', '防潮垫', '床垫', '睡眠'],
    '炊具': ['炊具', '炉具', '锅', '气炉', '餐具'], '照明': ['灯', '照明', '手电'],
    '背包': ['背包', '登山包', '包'],
    '交通': ['高铁', '火车', '租车', '自驾', '机票', '交通'],
    '住宿': ['酒店', '民宿', '住宿', '住'], '门票': ['门票', '乐园', '景区', '票'],
    '餐饮': ['餐', '吃', '美食', '餐饮']
  };
  for (const [cat, kws] of Object.entries(categoryKeywords)) {
    if (kws.some(k => text.includes(k))) mentioned.push(cat);
  }
  // 未明确提及的品类，若场景默认包含则补全
  const result = mentioned.length ? mentioned : rule.defaultCategories;
  // 确保关键品类不遗漏（如露营必有帐篷）
  for (const must of rule.defaultCategories.slice(0, 2)) {
    if (!result.includes(must) && scene === 'camping') result.unshift(must);
  }
  return [...new Set(result)];
}

// ---------- 主函数：意图结构化 ----------
/**
 * @param {string} text - 用户原始意图文本
 * @param {object} memory - 用户记忆（事实+偏好），用于补全隐性约束
 * @returns {object} 结构化意图
 */
function parseIntent(text, memory = {}) {
  const sceneRule = SCENE_RULES.find(r => r.keywords.some(k => text.includes(k)));
  const scene = sceneRule ? sceneRule.scene : 'general';
  const sceneLabel = sceneRule ? sceneRule.label : '通用消费';

  const budget = parseBudget(text);
  const deadline = parseDeadline(text);
  const hardConstraints = parseHardConstraints(text);
  const categories = parseCategories(text, scene);

  // 结合记忆补全隐性约束
  const enrichedConstraints = [...hardConstraints];
  if (memory.facts) {
    if (memory.facts.childAge !== undefined) {
      enrichedConstraints.push({
        type: 'childAge', label: '孩子年龄',
        value: memory.facts.childAge, unit: '岁', source: 'memory', strict: true
      });
    }
    if (memory.facts.maxDriveHours) {
      enrichedConstraints.push({
        type: 'maxDriveHours', label: '车程容忍度',
        value: memory.facts.maxDriveHours, unit: '小时', source: 'memory', strict: false
      });
    }
    if (memory.facts.cleanlinessPreference) {
      enrichedConstraints.push({
        type: 'cleanliness', label: '卫生偏好',
        value: memory.facts.cleanlinessPreference, source: 'memory', strict: true
      });
    }
  }

  return {
    rawText: text,
    scene,
    sceneLabel,
    budget: budget ? budget.total : null,
    budgetRaw: budget ? budget.raw : null,
    deadline,
    categories,
    hardConstraints: enrichedConstraints,
    // 隐性消费语义标注（用于向用户解释"我理解了什么"）
    semanticNotes: buildSemanticNotes(text, scene, budget, deadline, memory)
  };
}

function buildSemanticNotes(text, scene, budget, deadline, memory) {
  const notes = [];
  if (scene === 'camping') notes.push('识别为露营场景：装备需兼顾轻量与功能完备');
  if (scene === 'family-trip') notes.push('识别为亲子游场景：将优先核验儿童友好度与卫生条件');
  if (budget) notes.push(`预算约束 ${budget.total} 元，将按品类智能分配`);
  if (deadline) notes.push(`时效约束：需 ${deadline.label}（${deadline.date}）前到位，物流时效为硬过滤条件`);
  if (memory.facts && memory.facts.childAge !== undefined) {
    notes.push(`[记忆] 已知孩子 ${memory.facts.childAge} 岁，将自动匹配儿童票/免票规则与适龄项目`);
  }
  if (memory.preferences && memory.preferences.priceSensitivity === 'high') {
    notes.push('[记忆] 检测到高价格敏感度，比价时将优先展示历史低价与可叠加优惠券');
  }
  if (/送礼|送/.test(text)) notes.push('送礼场景：将考虑关系亲疏与包装/面子因素');
  return notes;
}

module.exports = { parseIntent, SCENE_RULES };