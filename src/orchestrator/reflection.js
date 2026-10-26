/**
 * 执行层 - 反射环与纠偏（Reflection Loop）
 * 每个子任务执行后设置 Checkpoint 核验。
 * 若组合结果超出预算，不直接失败，而是触发"约束松弛"子流程——
 * 向用户提出可操作的替代方案，展示协商能力。
 */

/**
 * Checkpoint：核验单个节点结果是否满足成功标准
 */
function checkpoint(node, result, intent) {
  const issues = [];
  switch (node.type) {
    case 'search': {
      const count = (result.candidates || []).length;
      if (count < 1) issues.push({ severity: 'critical', msg: `${node.category}无符合约束的候选` });
      else if (count < 3) issues.push({ severity: 'warning', msg: `${node.category}候选不足3个，约束可能过严` });
      break;
    }
    case 'compare': {
      const comps = result.comparisons || [];
      const budget = intent.budgetAllocation ? intent.budgetAllocation[node.category] : null;
      if (budget && comps.length && comps.every(c => c.bestPrice > budget)) {
        issues.push({
          severity: 'warning',
          msg: `${node.category}全部候选超出品类预算 ${budget} 元（最低 ${Math.min(...comps.map(c => c.bestPrice))} 元）`
        });
      }
      break;
    }
    case 'timing': {
      if ((result.passedCandidates || []).length === 0) {
        issues.push({ severity: 'critical', msg: `${node.category}无满足时效的 SKU，需放宽截止日期或更换品类` });
      }
      break;
    }
    case 'bundle': {
      if (result.overBudget) {
        issues.push({
          severity: 'critical',
          msg: `组合总价 ${result.totalPrice} 元超出预算 ${result.budget} 元（超出 ${result.budgetUtilization - 100}%）`
        });
      }
      break;
    }
  }
  return { passed: issues.filter(i => i.severity === 'critical').length === 0, issues };
}

/**
 * 约束松弛协商：当组合超预算时，生成可操作的替代方案
 * 每个方案都是"可量化权衡"而非"做不到"
 */
function constraintRelaxation(bundleResult, intent, categoryResults) {
  const over = bundleResult.totalPrice - bundleResult.budget;
  const overPct = Math.round((over / bundleResult.budget) * 100);
  const options = [];

  // 方案A：预算上浮
  const upliftNeeded = Math.ceil(over / bundleResult.budget * 100 + 5);
  options.push({
    id: 'opt-budget-up',
    type: 'budget-uplift',
    title: `预算上浮 ${upliftNeeded}%`,
    detail: `将预算从 ${bundleResult.budget} 元调整至 ${Math.ceil(bundleResult.budget * (1 + upliftNeeded / 100))} 元，即可锁定当前最优组合（总价 ${bundleResult.totalPrice} 元）`,
    tradeoff: '多花一点钱，换取最高匹配度的商品组合',
    impact: { newTotal: bundleResult.totalPrice, newBudget: Math.ceil(bundleResult.budget * (1 + upliftNeeded / 100)) }
  });

  // 方案B：品类降级——找每个品类中更便宜的替代
  const downgraded = [];
  const downgradedPicks = [];
  let downgradedTotal = 0;
  for (const pick of bundleResult.picks) {
    const catResult = categoryResults[pick.category];
    const pool = (catResult.passedCandidates || catResult.comparisons || []).slice();
    const cheaper = pool.filter(p => p.bestPrice < pick.bestPrice).sort((a, b) => a.bestPrice - b.bestPrice)[0];
    if (cheaper) {
      downgraded.push({ category: pick.category, from: pick.name, to: cheaper.name, save: pick.bestPrice - cheaper.bestPrice });
      downgradedPicks.push({ ...cheaper, category: pick.category });
      downgradedTotal += cheaper.bestPrice;
    } else {
      downgradedPicks.push(pick);
      downgradedTotal += pick.bestPrice;
    }
  }
  if (downgradedTotal <= bundleResult.budget) {
    options.push({
      id: 'opt-downgrade',
      type: 'category-downgrade',
      title: '部分品类降级替代',
      detail: downgraded.map(d => `${d.category}：${d.from.slice(0, 12)}… → ${d.to.slice(0, 12)}…（省 ${d.save} 元）`).join('；'),
      tradeoff: '在非核心品类上选择性价比款，核心品类保持不变',
      impact: { newTotal: downgradedTotal, saved: bundleResult.totalPrice - downgradedTotal, newPicks: downgradedPicks }
    });
  }

  // 方案C：裁剪非核心品类
  const coreCategories = intent.scene === 'camping' ? ['帐篷', '睡眠系统'] : ['住宿', '交通'];
  const trimmed = bundleResult.picks.filter(p => coreCategories.includes(p.category));
  const trimmedTotal = trimmed.reduce((s, p) => s + p.bestPrice, 0);
  if (trimmedTotal <= bundleResult.budget) {
    options.push({
      id: 'opt-trim',
      type: 'category-trim',
      title: '本期先购核心品类',
      detail: `先购买 ${coreCategories.join('、')}（合计 ${trimmedTotal} 元），其余品类下次补充`,
      tradeoff: '分两批完成，本期先解决核心需求',
      impact: { newTotal: trimmedTotal, newPicks: trimmed, deferred: bundleResult.picks.filter(p => !coreCategories.includes(p.category)).map(p => p.category) }
    });
  }

  return {
    triggered: true,
    reason: `组合总价超出预算 ${over} 元（${overPct}%）`,
    message: `当前最优组合总价 ${bundleResult.totalPrice} 元，略超预算 ${bundleResult.budget} 元。我为你准备了 ${options.length} 个可操作的替代方案，你可以选择接受其一，或告诉我调整方向：`,
    options,
    negotiationStyle: '提供可量化权衡而非简单拒绝——这是委托型消费代理的协商能力体现'
  };
}

module.exports = { checkpoint, constraintRelaxation };