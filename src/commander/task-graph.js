/**
 * 战略层 - 任务图（DAG）生成器
 * 将结构化意图拆解为可执行的子任务节点图，
 * 每个节点定义：类型、所属品类、成功标准、依赖关系。
 *
 * DAG 结构示例（露营场景）：
 *   [帐篷检索] ─┐
 *   [睡眠检索] ─┤──→ [跨平台比价] ──→ [时效核验] ──→ [组合优化] ──→ [授权下单]
 *   [炊具检索] ─┘
 */

let nodeSeq = 0;

function createNode(type, category, config = {}) {
  return {
    id: `node-${++nodeSeq}`,
    type, // search | compare | timing | bundle | checkout
    category,
    label: config.label || defaultLabel(type, category),
    status: 'pending', // pending | running | done | blocked | failed
    successCriteria: config.successCriteria || defaultCriteria(type),
    dependsOn: config.dependsOn || [],
    result: null,
    expert: config.expert || defaultExpert(type)
  };
}

function defaultLabel(type, category) {
  const map = {
    search: `${category}商品检索`,
    compare: `${category}跨平台比价`,
    timing: `${category}时效核验`,
    bundle: '跨品类组合优化',
    checkout: '授权下单'
  };
  return map[type] || type;
}

function defaultCriteria(type) {
  const map = {
    search: '返回 ≥3 个符合品类与硬约束的候选商品',
    compare: '输出各平台实时价格、历史低价位次与优惠券叠加后最优价',
    timing: '过滤出满足截止日期前可达的 SKU',
    bundle: '在预算约束下最大化需求覆盖度，输出最优组合与总价',
    checkout: '用户授权后完成下单，返回订单摘要'
  };
  return map[type] || '完成该步骤';
}

function defaultExpert(type) {
  const map = {
    search: '场景适配专家',
    compare: '跨平台比价专家',
    timing: '时效核验专家',
    bundle: '组合搭配专家',
    checkout: '交易执行专家'
  };
  return map[type] || '通用专家';
}

/**
 * 根据结构化意图构建任务图
 * @param {object} intent - parseIntent 的输出
 * @returns {object} { nodes, edges, budgetAllocation }
 */
function buildTaskGraph(intent) {
  const nodes = [];
  const edges = [];
  const categories = intent.categories.length ? intent.categories : ['通用'];

  // 1. 为每个品类生成检索节点
  const searchNodes = categories.map(cat =>
    createNode('search', cat, {
      successCriteria: `返回 ≥3 个${cat}候选，满足：${intent.hardConstraints.map(c => `${c.label}${c.strict ? '≤' : '≈'}${c.value}${c.unit || ''}`).join('、') || '基础品质要求'}`
    })
  );
  nodes.push(...searchNodes);

  // 2. 比价节点（依赖对应检索）
  const compareNodes = categories.map((cat, i) =>
    createNode('compare', cat, { dependsOn: [searchNodes[i].id] })
  );
  nodes.push(...compareNodes);
  searchNodes.forEach((n, i) => edges.push({ from: n.id, to: compareNodes[i].id }));

  // 3. 时效核验节点（若有截止日期）
  let timingNodes = [];
  if (intent.deadline) {
    timingNodes = categories.map((cat, i) =>
      createNode('timing', cat, {
        dependsOn: [compareNodes[i].id],
        successCriteria: `仅保留 ${intent.deadline.date} 前可达的 SKU`
      })
    );
    nodes.push(...timingNodes);
    compareNodes.forEach((n, i) => edges.push({ from: n.id, to: timingNodes[i].id }));
  }

  // 4. 组合优化节点（依赖所有前置）
  const upstream = timingNodes.length ? timingNodes : compareNodes;
  const bundleNode = createNode('bundle', '全部', {
    dependsOn: upstream.map(n => n.id),
    successCriteria: intent.budget
      ? `组合总价 ≤ ${intent.budget} 元，且覆盖全部 ${categories.length} 个品类`
      : `覆盖全部 ${categories.length} 个品类的最优组合`
  });
  nodes.push(bundleNode);
  upstream.forEach(n => edges.push({ from: n.id, to: bundleNode.id }));

  // 5. 授权下单节点
  const checkoutNode = createNode('checkout', '全部', {
    dependsOn: [bundleNode.id],
    successCriteria: '获得用户授权后完成下单'
  });
  nodes.push(checkoutNode);
  edges.push({ from: bundleNode.id, to: checkoutNode.id });

  // 6. 预算分配
  const budgetAllocation = allocateBudget(intent, categories);

  return {
    nodes,
    edges,
    budgetAllocation,
    categories,
    summary: {
      totalNodes: nodes.length,
      criticalPath: categories.length * (intent.deadline ? 3 : 2) + 2,
      estimatedSavings: '比价+优惠券预计节省 8%-20%'
    }
  };
}

/**
 * 预算智能分配：核心品类（帐篷/住宿）占大头，辅品类均分余量
 */
function allocateBudget(intent, categories) {
  if (!intent.budget) return null;
  const total = intent.budget;
  const weights = {
    '帐篷': 0.30, '住宿': 0.35, '交通': 0.15,
    '睡眠系统': 0.20, '炊具': 0.12, '门票': 0.15,
    '照明': 0.06, '背包': 0.18, '餐饮': 0.10
  };
  const known = categories.filter(c => weights[c]);
  const unknown = categories.filter(c => !weights[c]);
  let usedWeight = known.reduce((s, c) => s + weights[c], 0);
  const remainWeight = Math.max(0.05, 1 - usedWeight);
  const perUnknown = unknown.length ? remainWeight / unknown.length : 0;

  const allocation = {};
  for (const c of known) allocation[c] = Math.round(total * weights[c]);
  for (const c of unknown) allocation[c] = Math.round(total * perUnknown);
  return allocation;
}

module.exports = { buildTaskGraph, createNode };