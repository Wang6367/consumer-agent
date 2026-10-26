/**
 * 战略层 - 可授权边界声明（Authorization Boundary）
 * 在任务图生成阶段即明确：哪些动作可由智能体自主完成，
 * 哪些必须回到用户确认。这是"委托购物"可信性的关键设计。
 *
 * 授权分级：
 *  - auto    : 自主执行（检索、比价、核验、组合优化）
 *  - confirm : 需用户确认（支付、退换货等售后操作）
 *  - blocked : 禁止执行（超出预算阈值 120% 的支付）
 */

const DEFAULT_BUDGET_TOLERANCE = 1.2; // 预算上浮容忍度 120%

/**
 * 为任务图每个节点声明授权级别
 * @param {object} taskGraph - buildTaskGraph 的输出
 * @param {object} intent - 结构化意图
 * @returns {object} { boundary: {nodeId: level}, policy, summary }
 */
function declareBoundary(taskGraph, intent) {
  const boundary = {};
  const confirmActions = [];

  for (const node of taskGraph.nodes) {
    switch (node.type) {
      case 'search':
      case 'compare':
      case 'timing':
        boundary[node.id] = 'auto';
        break;
      case 'bundle':
        boundary[node.id] = 'auto';
        break;
      case 'checkout':
        boundary[node.id] = 'confirm';
        confirmActions.push({
          nodeId: node.id,
          action: '支付下单',
          reason: '涉及资金支出，必须获得用户明确授权',
          threshold: intent.budget ? Math.round(intent.budget * DEFAULT_BUDGET_TOLERANCE) : null
        });
        break;
      default:
        boundary[node.id] = 'confirm';
    }
  }

  return {
    boundary,
    confirmActions,
    policy: {
      autoScope: '商品检索、跨平台比价、时效核验、组合优化 —— 全程自主，无需打扰用户',
      confirmScope: '支付下单、超预算采购、退换货售后 —— 必须用户确认',
      blockedScope: `总价超出预算 ${Math.round(DEFAULT_BUDGET_TOLERANCE * 100)}% 的支付 —— 直接拦截，触发约束松弛协商`,
      budgetTolerance: DEFAULT_BUDGET_TOLERANCE,
      auditNote: '所有自主动作均记录工具调用轨迹，支持事后审计回溯'
    }
  };
}

/**
 * 运行时授权校验：给定动作与金额，判断是否放行
 */
function checkAuthorization(action, amount, boundary, intent, userAuthorized) {
  const level = boundary[action.nodeId] || 'confirm';
  const budgetCap = intent.budget ? intent.budget * DEFAULT_BUDGET_TOLERANCE : Infinity;

  if (level === 'auto') {
    return { allowed: true, level, reason: '该动作在自主授权范围内' };
  }
  if (amount && amount > budgetCap) {
    return {
      allowed: false, level: 'blocked',
      reason: `金额 ${amount} 元超出预算容忍上限 ${Math.round(budgetCap)} 元，触发约束松弛协商`,
      suggestion: 'constraint-relax'
    };
  }
  if (userAuthorized) {
    return { allowed: true, level, reason: '用户已授权' };
  }
  return {
    allowed: false, level: 'confirm',
    reason: '该动作需要用户确认（涉及支付）',
    suggestion: 'request-user-confirm'
  };
}

module.exports = { declareBoundary, checkAuthorization, DEFAULT_BUDGET_TOLERANCE };