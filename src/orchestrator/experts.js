/**
 * 执行层 - 上层专家智能体
 * 按子任务类型激活对应专家，每个专家封装领域逻辑并调用底层工具。
 *
 * 专家清单：
 *  - 场景适配专家   : 执行检索，结合场景与硬约束筛选候选
 *  - 跨平台比价专家 : 多平台实时价 + 历史低价位次 + 优惠券叠加
 *  - 时效核验专家   : 物流时效硬过滤，仅留截止日前可达 SKU
 *  - 组合搭配专家   : 跨品类组合优化，预算约束下最大化覆盖度
 *  - 售后策略专家   : 解析各平台售后政策，标注风险
 */

const tools = require('./tools');

// ========== 场景适配专家 ==========
function matchExpert(node, intent) {
  const candidates = tools.productSearch({
    category: node.category,
    constraints: intent.hardConstraints,
    scene: intent.scene
  });
  return {
    nodeId: node.id,
    expert: node.expert,
    category: node.category,
    candidates: candidates.map(p => ({
      id: p.id, name: p.name, price: p.price, rating: p.rating,
      weight: p.weight, tags: p.tags, platforms: p.platforms,
      matchScore: computeMatchScore(p, intent)
    })),
    reasoning: `结合「${intent.sceneLabel}」场景与 ${intent.hardConstraints.length} 项硬约束，从 ${candidates.length} 个候选中完成初筛`
  };
}

function computeMatchScore(product, intent) {
  let score = product.rating * 20; // 满分100基础
  for (const c of intent.hardConstraints) {
    if (c.type === 'weight' && product.weight && product.weight <= c.value) score += 15;
    if (c.type === 'people' && product.capacity && product.capacity >= c.value) score += 15;
    if (c.type === 'cleanliness' && product.cleanliness && product.cleanliness >= c.value) score += 15;
  }
  return Math.min(100, Math.round(score));
}

// ========== 跨平台比价专家 ==========
function compareExpert(node, intent, upstreamResult) {
  const candidates = (upstreamResult && upstreamResult.candidates) || [];
  const comparisons = candidates.map(p => {
    const platformPrices = [];
    for (const plat of p.platforms) {
      const coupon = tools.couponAggregator({ platform: plat, category: node.category, amount: p.price });
      const finalPrice = coupon ? p.price - coupon.amount : p.price;
      platformPrices.push({
        platform: plat,
        originalPrice: p.price,
        coupon: coupon ? `${coupon.amount}元券(满${coupon.threshold})` : null,
        finalPrice,
        belowHistoricalLow: finalPrice < (p.historicalLow || 0)
      });
    }
    const best = platformPrices.sort((a, b) => a.finalPrice - b.finalPrice)[0];
    const history = tools.priceHistory({ productId: p.id });
    const currentVsLow = history.length ?
      Math.round(((p.price - p.historicalLow) / p.historicalLow) * 100) : 0;
    return {
      id: p.id, name: p.name, matchScore: p.matchScore,
      platforms: platformPrices,
      bestPlatform: best.platform,
      bestPrice: best.finalPrice,
      historicalLow: p.historicalLow,
      pricePosition: currentVsLow <= 5 ? '接近历史低价' : currentVsLow <= 15 ? '中等价位' : '高于历史低价',
      premiumVsLow: currentVsLow
    };
  });
  return {
    nodeId: node.id,
    expert: node.expert,
    category: node.category,
    comparisons: comparisons.sort((a, b) => a.bestPrice - b.bestPrice),
    budgetHint: intent.budgetAllocation && intent.budgetAllocation[node.category]
      ? `本品类预算分配：${intent.budgetAllocation[node.category]} 元` : null,
    reasoning: `完成 ${candidates.length} 个候选 × ${candidates[0]?.platforms.length || 0} 平台的实时比价与优惠券叠加测算`
  };
}

// ========== 时效核验专家 ==========
function timingExpert(node, intent, upstreamResult) {
  const comparisons = (upstreamResult && upstreamResult.comparisons) || [];
  const checked = comparisons.map(c => {
    const logistics = tools.logisticsCheck({
      productId: c.id, platform: c.bestPlatform,
      deadline: intent.deadline ? intent.deadline.date : null
    });
    return { ...c, logistics };
  });
  const passed = checked.filter(c => c.logistics.available && c.logistics.meetDeadline);
  const filtered = checked.length - passed.length;
  return {
    nodeId: node.id,
    expert: node.expert,
    category: node.category,
    passedCandidates: passed,
    filteredOut: filtered,
    deadline: intent.deadline,
    reasoning: filtered > 0
      ? `${checked.length} 个候选中过滤掉 ${filtered} 个不满足「${intent.deadline?.label}」时效的 SKU`
      : `全部 ${checked.length} 个候选均满足时效要求`
  };
}

// ========== 组合搭配专家 ==========
function bundleExpert(node, intent, allCategoryResults) {
  // 从每个品类结果中取最优候选
  const picks = [];
  for (const [category, result] of Object.entries(allCategoryResults)) {
    const pool = result.passedCandidates || result.comparisons || [];
    if (pool.length) {
      const budget = intent.budgetAllocation ? intent.budgetAllocation[category] : Infinity;
      // 在预算内选 matchScore 最高的；若都超预算选最便宜的
      const withinBudget = pool.filter(p => p.bestPrice <= budget);
      const pick = (withinBudget.length ? withinBudget : pool)
        .sort((a, b) => withinBudget.length
          ? b.matchScore - a.matchScore
          : a.bestPrice - b.bestPrice)[0];
      picks.push({ category, ...pick, withinBudget: pick.bestPrice <= budget });
    }
  }

  const totalPrice = picks.reduce((s, p) => s + p.bestPrice, 0);
  const totalOriginal = picks.reduce((s, p) => s + (p.platforms?.[0]?.originalPrice || p.bestPrice), 0);
  const budget = intent.budget;
  const overBudget = budget && totalPrice > budget;

  return {
    nodeId: node.id,
    expert: node.expert,
    picks,
    totalPrice,
    totalSaved: totalOriginal - totalPrice,
    budget,
    overBudget,
    budgetUtilization: budget ? Math.round((totalPrice / budget) * 100) : null,
    reasoning: overBudget
      ? `组合总价 ${totalPrice} 元超出预算 ${budget} 元，需触发约束松弛协商`
      : `在预算 ${budget || '无限制'} 内完成 ${picks.length} 个品类组合，节省 ${totalOriginal - totalPrice} 元`
  };
}

// ========== 售后策略专家 ==========
function afterSalesExpert(node, bundleResult) {
  const policies = {};
  for (const pick of (bundleResult.picks || [])) {
    const policy = tools.afterSalesParser({ platform: pick.bestPlatform });
    policies[pick.category] = {
      product: pick.name, platform: pick.bestPlatform, policy,
      riskLevel: policy && policy.freightInsurance ? '低' : '中',
      advice: policy && policy.freightInsurance
        ? `${pick.bestPlatform}含运费险，7天无理由，可放心下单`
        : `${pick.bestPlatform}无运费险，退换货需自行承担运费，建议收货时验货`
    };
  }
  return { nodeId: node.id, expert: '售后策略专家', policies };
}

module.exports = { matchExpert, compareExpert, timingExpert, bundleExpert, afterSalesExpert };