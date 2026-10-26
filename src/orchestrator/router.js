/**
 * 执行层 - 动态路由与状态机（Orchestrator Core）
 * 按任务图 DAG 拓扑序调度执行：
 *   1. 解析依赖，找到当前可执行节点（依赖均已完成）
 *   2. 按节点类型激活对应专家智能体
 *   3. 每步执行后触发 Checkpoint 核验
 *   4. 组合超预算 → 触发约束松弛协商
 *   5. 下单节点 → 校验授权边界，未授权则挂起等待用户确认
 */

const experts = require('./experts');
const reflection = require('./reflection');
const tools = require('./tools');
const { checkAuthorization } = require('../commander/authorization');

/**
 * 执行完整任务图
 * @param {object} taskGraph - 任务图
 * @param {object} intent - 结构化意图
 * @param {object} boundary - 授权边界
 * @param {object} options - { authorized: bool, relaxOption: string }
 * @returns {object} 执行结果（含轨迹、各节点结果、最终组合、约束松弛、授权状态）
 */
function executeTaskGraph(taskGraph, intent, boundary, options = {}) {
  const { authorized = false, relaxOption = null } = options;
  tools.clearTrace();

  // 注入预算分配到 intent（任务图生成阶段的分配结果，供专家选品时使用）
  if (taskGraph.budgetAllocation && !intent.budgetAllocation) {
    intent.budgetAllocation = taskGraph.budgetAllocation;
  }

  const nodeMap = {};
  for (const n of taskGraph.nodes) nodeMap[n.id] = { ...n, status: 'pending' };

  const results = {};       // nodeId -> expert result
  const categoryResults = {}; // category -> last expert result (compare/timing)
  const executionLog = [];  // 执行日志（面向前端展示）
  let pendingAuthorization = null;
  let relaxation = null;
  let checkoutResult = null;

  // 拓扑序执行
  const maxIter = taskGraph.nodes.length * 2 + 10;
  for (let iter = 0; iter < maxIter; iter++) {
    const ready = Object.values(nodeMap).filter(n =>
      n.status === 'pending' &&
      n.dependsOn.every(d => nodeMap[d].status === 'done')
    );
    if (!ready.length) break;

    for (const node of ready) {
      // 授权校验
      const authCheck = checkAuthorization(
        { nodeId: node.id }, null, boundary.boundary, intent, authorized
      );
      if (!authCheck.allowed && node.type === 'checkout') {
        nodeMap[node.id].status = 'blocked';
        pendingAuthorization = {
          nodeId: node.id,
          action: '支付下单',
          reason: authCheck.reason,
          awaiting: 'user-confirm'
        };
        executionLog.push({ step: executionLog.length + 1, nodeId: node.id, action: node.label, status: 'blocked', detail: authCheck.reason });
        continue;
      }

      nodeMap[node.id].status = 'running';
      const t0 = Date.now();
      let result;

      // 动态路由：按节点类型激活专家
      switch (node.type) {
        case 'search':
          result = experts.matchExpert(node, intent);
          categoryResults[node.category] = { search: result };
          break;
        case 'compare': {
          const upstream = categoryResults[node.category]?.search;
          result = experts.compareExpert(node, intent, upstream);
          categoryResults[node.category] = { ...(categoryResults[node.category] || {}), compare: result };
          break;
        }
        case 'timing': {
          const upstream = categoryResults[node.category]?.compare;
          result = experts.timingExpert(node, intent, upstream);
          categoryResults[node.category] = { ...(categoryResults[node.category] || {}), timing: result };
          break;
        }
        case 'bundle': {
          // 取每个品类最新的有效结果
          const latest = {};
          for (const [cat, cr] of Object.entries(categoryResults)) {
            latest[cat] = cr.timing || cr.compare || cr.search;
          }
          result = experts.bundleExpert(node, intent, latest);
          // Checkpoint：超预算触发约束松弛
          const cp = reflection.checkpoint(node, result, intent);
          if (!cp.passed) {
            relaxation = reflection.constraintRelaxation(result, intent, latest);
            result.relaxation = relaxation;
            // 若用户已选择松弛方案，应用后继续
            if (relaxOption) {
              result = applyRelaxOption(result, relaxOption, intent);
            }
          }
          break;
        }
        case 'checkout': {
          const bundleResult = results[taskGraph.nodes.find(n => n.type === 'bundle').id];
          const afterSales = experts.afterSalesExpert(node, bundleResult);
          result = {
            nodeId: node.id,
            status: authorized ? 'completed' : 'awaiting-authorization',
            order: authorized ? buildOrderSummary(bundleResult, intent) : null,
            afterSales
          };
          checkoutResult = result;
          break;
        }
      }

      const duration = Date.now() - t0;
      results[node.id] = result;
      nodeMap[node.id].status = 'done';
      nodeMap[node.id].result = result;

      const cp = node.type !== 'bundle' ? reflection.checkpoint(node, result, intent) : { passed: true, issues: [] };
      executionLog.push({
        step: executionLog.length + 1,
        nodeId: node.id,
        action: node.label,
        expert: node.expert,
        status: 'done',
        durationMs: duration,
        detail: result.reasoning || result.status || '完成',
        checkpoint: cp
      });
    }
  }

  const bundleNode = taskGraph.nodes.find(n => n.type === 'bundle');
  const bundleResult = bundleNode ? results[bundleNode.id] : null;

  return {
    executionLog,
    toolTrace: tools.getTrace(),
    nodeStates: Object.fromEntries(Object.entries(nodeMap).map(([id, n]) => [id, n.status])),
    categoryResults,
    bundleResult,
    relaxation,
    pendingAuthorization,
    checkoutResult,
    finalStatus: pendingAuthorization ? 'awaiting-authorization'
      : (checkoutResult && checkoutResult.status === 'completed') ? 'completed'
      : relaxation ? 'needs-negotiation' : 'executed'
  };
}

/**
 * 应用用户选择的约束松弛方案
 */
function applyRelaxOption(bundleResult, optionId, intent) {
  const opt = (bundleResult.relaxation?.options || []).find(o => o.id === optionId);
  if (!opt) return bundleResult;
  const updated = {
    ...bundleResult,
    appliedRelaxOption: opt,
    totalPrice: opt.impact.newTotal,
    reasoning: `已应用「${opt.title}」方案，调整后总价 ${opt.impact.newTotal} 元`
  };
  // 降级/裁剪方案：替换为调整后的商品列表
  if (opt.impact.newPicks) updated.picks = opt.impact.newPicks;
  // 预算上浮方案：同步更新预算基准，使超预算状态正确翻转
  if (opt.impact.newBudget) updated.budget = opt.impact.newBudget;
  updated.overBudget = updated.totalPrice > updated.budget;
  updated.budgetUtilization = updated.budget ? Math.round((updated.totalPrice / updated.budget) * 100) : null;
  return updated;
}

function buildOrderSummary(bundleResult, intent) {
  const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
  return {
    orderId,
    createdAt: new Date().toISOString(),
    items: bundleResult.picks.map(p => ({
      category: p.category, product: p.name, platform: p.bestPlatform,
      price: p.bestPrice, coupon: p.platforms?.find(pl => pl.platform === p.bestPlatform)?.coupon || null
    })),
    totalAmount: bundleResult.totalPrice,
    budget: bundleResult.budget,
    saved: bundleResult.totalSaved,
    note: '订单已提交，各平台发货与物流信息将同步至你的待办'
  };
}

module.exports = { executeTaskGraph, applyRelaxOption };