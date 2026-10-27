/**
 * 消费智能体 - 浏览器端核心引擎
 * 将后端全部逻辑(Commander/Orchestrator/Memory)打包为纯前端运行,
 * 部署到 GitHub Pages 等静态托管即可 24 小时在线,无需服务器。
 */
(function () {
  'use strict';

  // ============================================================
  // 数据层:模拟商品目录与消费数据
  // ============================================================
  const campingProducts = [
    { id: 'tent-001', name: '牧高笛 冷山2 Air 自动帐篷', category: '帐篷', price: 599, historicalLow: 489, weight: 2.1, capacity: 2, platforms: ['京东', '天猫', '拼多多'], tags: ['轻量', '自动搭建', '防水2000mm'], rating: 4.7, reviews: 12800, stock: { '京东': true, '天猫': true, '拼多多': false }, deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 4 } },
    { id: 'tent-002', name: '挪客 Cloud Up 2 云层帐篷', category: '帐篷', price: 469, historicalLow: 399, weight: 1.7, capacity: 2, platforms: ['京东', '天猫'], tags: ['超轻', '徒步友好', '防水3000mm'], rating: 4.6, reviews: 8600, stock: { '京东': true, '天猫': true }, deliveryDays: { '京东': 1, '天猫': 3 } },
    { id: 'tent-003', name: '探险者 全自动液压帐篷 4人', category: '帐篷', price: 359, historicalLow: 299, weight: 3.8, capacity: 4, platforms: ['京东', '拼多多'], tags: ['家庭', '液压自动', '防水1500mm'], rating: 4.4, reviews: 21000, stock: { '京东': true, '拼多多': true }, deliveryDays: { '京东': 2, '拼多多': 5 } },
    { id: 'sleep-001', name: '黑冰 B700 睡袋', category: '睡眠系统', price: 428, historicalLow: 368, weight: 0.95, tempRating: '-5℃', platforms: ['京东', '天猫'], tags: ['羽绒', '轻量', '保暖'], rating: 4.8, reviews: 5400, stock: { '京东': true, '天猫': true }, deliveryDays: { '京东': 1, '天猫': 2 } },
    { id: 'sleep-002', name: '挪客 信封式棉睡袋', category: '睡眠系统', price: 129, historicalLow: 99, weight: 1.4, tempRating: '5℃', platforms: ['京东', '天猫', '拼多多'], tags: ['棉质', '经济', '春秋季'], rating: 4.3, reviews: 18000, stock: { '京东': true, '天猫': true, '拼多多': true }, deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 3 } },
    { id: 'mat-001', name: 'Therm-a-Rest Z Lite SOL 防潮垫', category: '睡眠系统', price: 248, historicalLow: 198, weight: 0.41, rValue: 2.0, platforms: ['京东', '天猫'], tags: ['蛋槽', '超轻', '多季节'], rating: 4.7, reviews: 3200, stock: { '京东': true, '天猫': false }, deliveryDays: { '京东': 1 } },
    { id: 'stove-001', name: '火枫 野火2 分体式气炉', category: '炊具', price: 168, historicalLow: 138, weight: 0.35, platforms: ['京东', '天猫'], tags: ['高效', '防风', '便携'], rating: 4.6, reviews: 7600, stock: { '京东': true, '天猫': true }, deliveryDays: { '京东': 1, '天猫': 2 } },
    { id: 'stove-002', name: '牧高笛 套锅炊具套装', category: '炊具', price: 199, historicalLow: 159, weight: 0.85, platforms: ['京东', '拼多多'], tags: ['套装', '铝制', '2-3人'], rating: 4.5, reviews: 9200, stock: { '京东': true, '拼多多': true }, deliveryDays: { '京东': 1, '拼多多': 4 } },
    { id: 'lamp-001', name: '山力士 灵狐营地灯', category: '照明', price: 89, historicalLow: 69, weight: 0.12, platforms: ['京东', '天猫', '拼多多'], tags: ['充电', '调光', '防水'], rating: 4.5, reviews: 15000, stock: { '京东': true, '天猫': true, '拼多多': true }, deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 3 } },
    { id: 'backpack-001', name: 'Osprey Stratos 云层34L 登山包', category: '背包', price: 899, historicalLow: 749, weight: 1.32, platforms: ['京东', '天猫'], tags: ['透气背板', '轻量', '防雨罩'], rating: 4.8, reviews: 4100, stock: { '京东': true, '天猫': true }, deliveryDays: { '京东': 2, '天猫': 2 } }
  ];

  const familyTripProducts = [
    { id: 'hotel-001', name: '莫干山亲子度假酒店（含儿童乐园）', category: '住宿', price: 688, historicalLow: 588, type: '酒店', platforms: ['携程', '美团'], tags: ['亲子房', '室内乐园', '含早'], rating: 4.6, reviews: 3400, cleanliness: 4.8, distance: '杭州1.5h车程', stock: { '携程': true, '美团': true } },
    { id: 'hotel-002', name: '安吉帐篷客度假酒店', category: '住宿', price: 928, historicalLow: 798, type: '酒店', platforms: ['携程', '飞猪'], tags: ['自然风光', '帐篷主题', '亲子活动'], rating: 4.7, reviews: 2100, cleanliness: 4.9, distance: '杭州2h车程', stock: { '携程': true, '飞猪': false } },
    { id: 'ticket-001', name: '莫干山奇幻谷亲子乐园门票', category: '门票', price: 128, historicalLow: 99, type: '门票', platforms: ['美团', '携程'], tags: ['儿童免票', '周末可用'], rating: 4.5, reviews: 8800, stock: { '美团': true, '携程': true } },
    { id: 'ticket-002', name: '安吉竹博园+熊猫馆联票', category: '门票', price: 88, historicalLow: 68, type: '门票', platforms: ['美团', '携程'], tags: ['1.2m以下免票', '联票优惠'], rating: 4.4, reviews: 12000, stock: { '美团': true, '携程': true } },
    { id: 'trans-001', name: '杭州东→德清 高铁往返（2大1小）', category: '交通', price: 156, historicalLow: 156, type: '交通', platforms: ['12306'], tags: ['儿童半价', '30分钟直达'], rating: 4.9, reviews: 0, stock: { '12306': true } },
    { id: 'trans-002', name: '自驾租车 5座SUV 周末2日', category: '交通', price: 329, historicalLow: 269, type: '交通', platforms: ['神州', '一嗨'], tags: ['儿童座椅可租', '无限里程'], rating: 4.3, reviews: 5600, stock: { '神州': true, '一嗨': true } }
  ];

  function genPriceHistory(base, low) {
    const points = [];
    for (let i = 29; i >= 0; i--) {
      const wave = Math.sin(i / 4) * (base - low) * 0.25;
      const noise = ((i * 37) % 11 - 5) * (base - low) * 0.03;
      const cur = Math.round(low + (base - low) * 0.5 + wave + noise);
      points.push({ day: i, price: Math.max(low, Math.min(base + 50, cur)) });
    }
    return points;
  }

  let coupons = [
    { id: 'cp-1', platform: '京东', scope: '户外运动', amount: 60, threshold: 300, expire: '2026-11-15' },
    { id: 'cp-2', platform: '京东', scope: '全品类', amount: 20, threshold: 100, expire: '2026-11-30' },
    { id: 'cp-3', platform: '天猫', scope: '户外露营', amount: 100, threshold: 500, expire: '2026-11-11' },
    { id: 'cp-4', platform: '美团', scope: '酒店民宿', amount: 50, threshold: 400, expire: '2026-11-20' },
    { id: 'cp-5', platform: '携程', scope: '门票', amount: 30, threshold: 200, expire: '2026-11-25' }
  ];

  const afterSalesPolicies = {
    '京东': { returnDays: 7, exchangeDays: 15, freightInsurance: true, notes: '支持上门取件' },
    '天猫': { returnDays: 7, exchangeDays: 15, freightInsurance: true, notes: '运费险自动理赔' },
    '拼多多': { returnDays: 7, exchangeDays: 0, freightInsurance: false, notes: '需自行寄回' },
    '携程': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '酒店预订取消政策以房型为准，通常提前24h免费取消' },
    '美团': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '未消费随时退，过期自动退' },
    '12306': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '开车前8天免费退改' }
  };

  // 数据可被本地数据库动态覆盖(见 AgentAPI.loadData);初始值作为离线回退
  let allProducts = [...campingProducts, ...familyTripProducts];

  // __END_BATCH_1__

  // ============================================================
  // 工具层:底层工具生态(商品检索/价格历史/优惠券/物流/售后)
  // ============================================================
  const toolTrace = [];

  function recordTrace(tool, input, output, durationMs) {
    const entry = { tool, input, output: summarize(output), durationMs, timestamp: new Date().toISOString() };
    toolTrace.push(entry);
    return entry;
  }

  function summarize(output) {
    if (Array.isArray(output)) return `${output.length} 条结果`;
    if (output && typeof output === 'object') return Object.keys(output).slice(0, 5).join(',');
    return String(output).slice(0, 80);
  }

  function productSearch({ category, constraints = [], scene }) {
    const t0 = Date.now();
    let pool = allProducts.filter(p => p.category === category);
    for (const c of constraints) {
      if (c.type === 'weight' && c.value) pool = pool.filter(p => !p.weight || p.weight <= c.value * 1.5);
      if (c.type === 'people' && c.value) pool = pool.filter(p => !p.capacity || p.capacity >= c.value);
      if (c.type === 'cleanliness' && c.value) pool = pool.filter(p => !p.cleanliness || p.cleanliness >= c.value);
    }
    if (scene === 'family-trip') {
      pool = pool.sort((a, b) => {
        const aKid = /亲子|儿童|免票/.test(a.tags.join('')) ? 1 : 0;
        const bKid = /亲子|儿童|免票/.test(b.tags.join('')) ? 1 : 0;
        return bKid - aKid || b.rating - a.rating;
      });
    } else {
      pool = pool.sort((a, b) => b.rating - a.rating);
    }
    const result = pool.slice(0, 5);
    recordTrace('product-search', { category, constraints: constraints.length }, result, Date.now() - t0);
    return result;
  }

  function priceHistory({ productId }) {
    const t0 = Date.now();
    const product = allProducts.find(p => p.id === productId);
    if (!product) return [];
    const history = genPriceHistory(product.price, product.historicalLow);
    recordTrace('price-history', { productId }, history, Date.now() - t0);
    return history;
  }

  function couponAggregator({ platform, category, amount }) {
    const t0 = Date.now();
    const matched = coupons.filter(cp =>
      cp.platform === platform &&
      amount >= cp.threshold &&
      (cp.scope === '全品类' || cp.scope.includes(category) || category.includes(cp.scope))
    );
    const best = matched.sort((a, b) => b.amount - a.amount)[0] || null;
    recordTrace('coupon-aggregator', { platform, category, amount }, best ? [best] : [], Date.now() - t0);
    return best;
  }

  function logisticsCheck({ productId, platform, deadline }) {
    const t0 = Date.now();
    const product = allProducts.find(p => p.id === productId);
    if (!product) return { available: false, reason: '商品不存在' };
    const inStock = product.stock[platform];
    if (!inStock) return { available: false, reason: `${platform} 无库存` };
    const days = product.deliveryDays ? product.deliveryDays[platform] : 1;
    const arriveBy = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const meetDeadline = !deadline || arriveBy <= deadline;
    recordTrace('logistics-check', { productId, platform, deadline }, { inStock, days, meetDeadline }, Date.now() - t0);
    return { available: true, platform, deliveryDays: days, arriveBy, meetDeadline };
  }

  function afterSalesParser({ platform }) {
    const t0 = Date.now();
    const policy = afterSalesPolicies[platform] || null;
    recordTrace('after-sales-parser', { platform }, policy ? [policy] : [], Date.now() - t0);
    return policy;
  }

  function getTrace() { return [...toolTrace]; }
  function clearTrace() { toolTrace.length = 0; }

  // ============================================================
  // 执行层:上层专家智能体
  // ============================================================
  function matchExpert(node, intent) {
    const candidates = productSearch({ category: node.category, constraints: intent.hardConstraints, scene: intent.scene });
    return {
      nodeId: node.id, expert: node.expert, category: node.category,
      candidates: candidates.map(p => ({
        id: p.id, name: p.name, price: p.price, rating: p.rating,
        weight: p.weight, tags: p.tags, platforms: p.platforms,
        matchScore: computeMatchScore(p, intent)
      })),
      reasoning: `结合「${intent.sceneLabel}」场景与 ${intent.hardConstraints.length} 项硬约束，从 ${candidates.length} 个候选中完成初筛`
    };
  }

  function computeMatchScore(product, intent) {
    let score = product.rating * 20;
    for (const c of intent.hardConstraints) {
      if (c.type === 'weight' && product.weight && product.weight <= c.value) score += 15;
      if (c.type === 'people' && product.capacity && product.capacity >= c.value) score += 15;
      if (c.type === 'cleanliness' && product.cleanliness && product.cleanliness >= c.value) score += 15;
    }
    return Math.min(100, Math.round(score));
  }

  function compareExpert(node, intent, upstreamResult) {
    const candidates = (upstreamResult && upstreamResult.candidates) || [];
    const comparisons = candidates.map(p => {
      const platformPrices = [];
      for (const plat of p.platforms) {
        const coupon = couponAggregator({ platform: plat, category: node.category, amount: p.price });
        const finalPrice = coupon ? p.price - coupon.amount : p.price;
        platformPrices.push({
          platform: plat, originalPrice: p.price,
          coupon: coupon ? `${coupon.amount}元券(满${coupon.threshold})` : null,
          finalPrice, belowHistoricalLow: finalPrice < (p.historicalLow || 0)
        });
      }
      const best = platformPrices.sort((a, b) => a.finalPrice - b.finalPrice)[0];
      const history = priceHistory({ productId: p.id });
      const currentVsLow = history.length ? Math.round(((p.price - p.historicalLow) / p.historicalLow) * 100) : 0;
      return {
        id: p.id, name: p.name, matchScore: p.matchScore,
        platforms: platformPrices, bestPlatform: best.platform, bestPrice: best.finalPrice,
        historicalLow: p.historicalLow,
        pricePosition: currentVsLow <= 5 ? '接近历史低价' : currentVsLow <= 15 ? '中等价位' : '高于历史低价',
        premiumVsLow: currentVsLow
      };
    });
    return {
      nodeId: node.id, expert: node.expert, category: node.category,
      comparisons: comparisons.sort((a, b) => a.bestPrice - b.bestPrice),
      budgetHint: intent.budgetAllocation && intent.budgetAllocation[node.category] ? `本品类预算分配：${intent.budgetAllocation[node.category]} 元` : null,
      reasoning: `完成 ${candidates.length} 个候选 × ${candidates[0]?.platforms.length || 0} 平台的实时比价与优惠券叠加测算`
    };
  }

  function timingExpert(node, intent, upstreamResult) {
    const comparisons = (upstreamResult && upstreamResult.comparisons) || [];
    const checked = comparisons.map(c => {
      const logistics = logisticsCheck({ productId: c.id, platform: c.bestPlatform, deadline: intent.deadline ? intent.deadline.date : null });
      return { ...c, logistics };
    });
    const passed = checked.filter(c => c.logistics.available && c.logistics.meetDeadline);
    const filtered = checked.length - passed.length;
    return {
      nodeId: node.id, expert: node.expert, category: node.category,
      passedCandidates: passed, filteredOut: filtered, deadline: intent.deadline,
      reasoning: filtered > 0 ? `${checked.length} 个候选中过滤掉 ${filtered} 个不满足「${intent.deadline?.label}」时效的 SKU` : `全部 ${checked.length} 个候选均满足时效要求`
    };
  }

  function bundleExpert(node, intent, allCategoryResults) {
    const picks = [];
    for (const [category, result] of Object.entries(allCategoryResults)) {
      const pool = result.passedCandidates || result.comparisons || [];
      if (pool.length) {
        const budget = intent.budgetAllocation ? intent.budgetAllocation[category] : Infinity;
        const withinBudget = pool.filter(p => p.bestPrice <= budget);
        const pick = (withinBudget.length ? withinBudget : pool)
          .sort((a, b) => withinBudget.length ? b.matchScore - a.matchScore : a.bestPrice - b.bestPrice)[0];
        picks.push({ category, ...pick, withinBudget: pick.bestPrice <= budget });
      }
    }
    const totalPrice = picks.reduce((s, p) => s + p.bestPrice, 0);
    const totalOriginal = picks.reduce((s, p) => s + (p.platforms?.[0]?.originalPrice || p.bestPrice), 0);
    const budget = intent.budget;
    const overBudget = budget && totalPrice > budget;
    return {
      nodeId: node.id, expert: node.expert, picks, totalPrice,
      totalSaved: totalOriginal - totalPrice, budget, overBudget,
      budgetUtilization: budget ? Math.round((totalPrice / budget) * 100) : null,
      reasoning: overBudget ? `组合总价 ${totalPrice} 元超出预算 ${budget} 元，需触发约束松弛协商` : `在预算 ${budget || '无限制'} 内完成 ${picks.length} 个品类组合，节省 ${totalOriginal - totalPrice} 元`
    };
  }

  function afterSalesExpert(node, bundleResult) {
    const policies = {};
    for (const pick of (bundleResult.picks || [])) {
      const policy = afterSalesParser({ platform: pick.bestPlatform });
      policies[pick.category] = {
        product: pick.name, platform: pick.bestPlatform, policy,
        riskLevel: policy && policy.freightInsurance ? '低' : '中',
        advice: policy && policy.freightInsurance ? `${pick.bestPlatform}含运费险，7天无理由，可放心下单` : `${pick.bestPlatform}无运费险，退换货需自行承担运费，建议收货时验货`
      };
    }
    return { nodeId: node.id, expert: '售后策略专家', policies };
  }

  // __END_BATCH_2__

  // ============================================================
  // 执行层:反射环与纠偏(Checkpoint + 约束松弛协商)
  // ============================================================
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
          issues.push({ severity: 'warning', msg: `${node.category}全部候选超出品类预算 ${budget} 元（最低 ${Math.min(...comps.map(c => c.bestPrice))} 元）` });
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
          issues.push({ severity: 'critical', msg: `组合总价 ${result.totalPrice} 元超出预算 ${result.budget} 元（超出 ${result.budgetUtilization - 100}%）` });
        }
        break;
      }
    }
    return { passed: issues.filter(i => i.severity === 'critical').length === 0, issues };
  }

  function constraintRelaxation(bundleResult, intent, categoryResults) {
    const over = bundleResult.totalPrice - bundleResult.budget;
    const overPct = Math.round((over / bundleResult.budget) * 100);
    const options = [];

    const upliftNeeded = Math.ceil(over / bundleResult.budget * 100 + 5);
    options.push({
      id: 'opt-budget-up', type: 'budget-uplift',
      title: `预算上浮 ${upliftNeeded}%`,
      detail: `将预算从 ${bundleResult.budget} 元调整至 ${Math.ceil(bundleResult.budget * (1 + upliftNeeded / 100))} 元，即可锁定当前最优组合（总价 ${bundleResult.totalPrice} 元）`,
      tradeoff: '多花一点钱，换取最高匹配度的商品组合',
      impact: { newTotal: bundleResult.totalPrice, newBudget: Math.ceil(bundleResult.budget * (1 + upliftNeeded / 100)) }
    });

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
        id: 'opt-downgrade', type: 'category-downgrade',
        title: '部分品类降级替代',
        detail: downgraded.map(d => `${d.category}：${d.from.slice(0, 12)}… → ${d.to.slice(0, 12)}…（省 ${d.save} 元）`).join('；'),
        tradeoff: '在非核心品类上选择性价比款，核心品类保持不变',
        impact: { newTotal: downgradedTotal, saved: bundleResult.totalPrice - downgradedTotal, newPicks: downgradedPicks }
      });
    }

    const coreCategories = intent.scene === 'camping' ? ['帐篷', '睡眠系统'] : ['住宿', '交通'];
    const trimmed = bundleResult.picks.filter(p => coreCategories.includes(p.category));
    const trimmedTotal = trimmed.reduce((s, p) => s + p.bestPrice, 0);
    if (trimmedTotal <= bundleResult.budget) {
      options.push({
        id: 'opt-trim', type: 'category-trim',
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

  // ============================================================
  // 战略层:消费意图拆解引擎(Commander / Intent Parser)
  // ============================================================
  const SCENE_RULES = [
    { scene: 'camping', label: '露营装备', keywords: ['露营', '野营', '帐篷', '营地', '户外过夜', 'camping'], defaultCategories: ['帐篷', '睡眠系统', '炊具', '照明', '背包'] },
    { scene: 'family-trip', label: '亲子短途游', keywords: ['亲子游', '带孩子', '家庭游', '周末游', '短途游', '遛娃', '三口之家'], defaultCategories: ['交通', '住宿', '门票', '餐饮'] },
    { scene: 'hiking', label: '徒步出行', keywords: ['徒步', '登山', '远足', 'hiking'], defaultCategories: ['鞋类', '背包', '服装'] }
  ];

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

  function parseHardConstraints(text) {
    const constraints = [];
    const weightM = text.match(/(?:别太重|轻便|轻量|不超过|控制在)\s*(\d+(?:\.\d+)?)\s*[kg公]?[斤克]?/);
    if (weightM || /别太重|越轻越好|轻便/.test(text)) {
      constraints.push({ type: 'weight', label: '重量上限', value: weightM ? parseFloat(weightM[1]) : 8, unit: 'kg', strict: !!weightM });
    }
    const peopleM = text.match(/(\d+)\s*[人个口]/);
    if (peopleM) {
      constraints.push({ type: 'people', label: '使用人数', value: parseInt(peopleM[1]), unit: '人', strict: true });
    }
    if (/冬天|冬季|低温|寒冷/.test(text)) {
      constraints.push({ type: 'season', label: '季节', value: 'winter', strict: true });
    } else if (/秋天|秋季|春秋/.test(text)) {
      constraints.push({ type: 'season', label: '季节', value: 'autumn', strict: false });
    }
    return constraints;
  }

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
    const result = mentioned.length ? mentioned : rule.defaultCategories;
    for (const must of rule.defaultCategories.slice(0, 2)) {
      if (!result.includes(must) && scene === 'camping') result.unshift(must);
    }
    return [...new Set(result)];
  }

  function parseIntent(text, memory = {}) {
    const sceneRule = SCENE_RULES.find(r => r.keywords.some(k => text.includes(k)));
    const scene = sceneRule ? sceneRule.scene : 'general';
    const sceneLabel = sceneRule ? sceneRule.label : '通用消费';
    const budget = parseBudget(text);
    const deadline = parseDeadline(text);
    const hardConstraints = parseHardConstraints(text);
    const categories = parseCategories(text, scene);
    const enrichedConstraints = [...hardConstraints];
    if (memory.facts) {
      if (memory.facts.childAge !== undefined) {
        enrichedConstraints.push({ type: 'childAge', label: '孩子年龄', value: memory.facts.childAge, unit: '岁', source: 'memory', strict: true });
      }
      if (memory.facts.maxDriveHours) {
        enrichedConstraints.push({ type: 'maxDriveHours', label: '车程容忍度', value: memory.facts.maxDriveHours, unit: '小时', source: 'memory', strict: false });
      }
      if (memory.facts.cleanlinessPreference) {
        enrichedConstraints.push({ type: 'cleanliness', label: '卫生偏好', value: memory.facts.cleanlinessPreference, source: 'memory', strict: true });
      }
    }
    return {
      rawText: text, scene, sceneLabel,
      budget: budget ? budget.total : null, budgetRaw: budget ? budget.raw : null,
      deadline, categories, hardConstraints: enrichedConstraints,
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

  // __END_BATCH_3__

  // ============================================================
  // 战略层:任务图(DAG)生成器
  // ============================================================
  let nodeSeq = 0;

  function createNode(type, category, config = {}) {
    return {
      id: `node-${++nodeSeq}`, type, category,
      label: config.label || defaultLabel(type, category),
      status: 'pending',
      successCriteria: config.successCriteria || defaultCriteria(type),
      dependsOn: config.dependsOn || [],
      result: null,
      expert: config.expert || defaultExpert(type)
    };
  }

  function defaultLabel(type, category) {
    const map = { search: `${category}商品检索`, compare: `${category}跨平台比价`, timing: `${category}时效核验`, bundle: '跨品类组合优化', checkout: '授权下单' };
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
    const map = { search: '场景适配专家', compare: '跨平台比价专家', timing: '时效核验专家', bundle: '组合搭配专家', checkout: '交易执行专家' };
    return map[type] || '通用专家';
  }

  function buildTaskGraph(intent) {
    const nodes = [];
    const edges = [];
    const categories = intent.categories.length ? intent.categories : ['通用'];
    const searchNodes = categories.map(cat => createNode('search', cat, {
      successCriteria: `返回 ≥3 个${cat}候选，满足：${intent.hardConstraints.map(c => `${c.label}${c.strict ? '≤' : '≈'}${c.value}${c.unit || ''}`).join('、') || '基础品质要求'}`
    }));
    nodes.push(...searchNodes);
    const compareNodes = categories.map((cat, i) => createNode('compare', cat, { dependsOn: [searchNodes[i].id] }));
    nodes.push(...compareNodes);
    searchNodes.forEach((n, i) => edges.push({ from: n.id, to: compareNodes[i].id }));
    let timingNodes = [];
    if (intent.deadline) {
      timingNodes = categories.map((cat, i) => createNode('timing', cat, { dependsOn: [compareNodes[i].id], successCriteria: `仅保留 ${intent.deadline.date} 前可达的 SKU` }));
      nodes.push(...timingNodes);
      compareNodes.forEach((n, i) => edges.push({ from: n.id, to: timingNodes[i].id }));
    }
    const upstream = timingNodes.length ? timingNodes : compareNodes;
    const bundleNode = createNode('bundle', '全部', {
      dependsOn: upstream.map(n => n.id),
      successCriteria: intent.budget ? `组合总价 ≤ ${intent.budget} 元，且覆盖全部 ${categories.length} 个品类` : `覆盖全部 ${categories.length} 个品类的最优组合`
    });
    nodes.push(bundleNode);
    upstream.forEach(n => edges.push({ from: n.id, to: bundleNode.id }));
    const checkoutNode = createNode('checkout', '全部', { dependsOn: [bundleNode.id], successCriteria: '获得用户授权后完成下单' });
    nodes.push(checkoutNode);
    edges.push({ from: bundleNode.id, to: checkoutNode.id });
    return {
      nodes, edges,
      budgetAllocation: allocateBudget(intent, categories),
      categories,
      summary: {
        totalNodes: nodes.length,
        criticalPath: categories.length * (intent.deadline ? 3 : 2) + 2,
        estimatedSavings: '比价+优惠券预计节省 8%-20%'
      }
    };
  }

  function allocateBudget(intent, categories) {
    if (!intent.budget) return null;
    const total = intent.budget;
    const weights = { '帐篷': 0.30, '住宿': 0.35, '交通': 0.15, '睡眠系统': 0.20, '炊具': 0.12, '门票': 0.15, '照明': 0.06, '背包': 0.18, '餐饮': 0.10 };
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

  // ============================================================
  // 战略层:可授权边界声明(Authorization Boundary)
  // ============================================================
  const DEFAULT_BUDGET_TOLERANCE = 1.2;

  function declareBoundary(taskGraph, intent) {
    const boundary = {};
    const confirmActions = [];
    for (const node of taskGraph.nodes) {
      switch (node.type) {
        case 'search': case 'compare': case 'timing': case 'bundle':
          boundary[node.id] = 'auto'; break;
        case 'checkout':
          boundary[node.id] = 'confirm';
          confirmActions.push({ nodeId: node.id, action: '支付下单', reason: '涉及资金支出，必须获得用户明确授权', threshold: intent.budget ? Math.round(intent.budget * DEFAULT_BUDGET_TOLERANCE) : null });
          break;
        default:
          boundary[node.id] = 'confirm';
      }
    }
    return {
      boundary, confirmActions,
      policy: {
        autoScope: '商品检索、跨平台比价、时效核验、组合优化 —— 全程自主，无需打扰用户',
        confirmScope: '支付下单、超预算采购、退换货售后 —— 必须用户确认',
        blockedScope: `总价超出预算 ${Math.round(DEFAULT_BUDGET_TOLERANCE * 100)}% 的支付 —— 直接拦截，触发约束松弛协商`,
        budgetTolerance: DEFAULT_BUDGET_TOLERANCE,
        auditNote: '所有自主动作均记录工具调用轨迹，支持事后审计回溯'
      }
    };
  }

  function checkAuthorization(action, amount, boundary, intent, userAuthorized) {
    const level = boundary[action.nodeId] || 'confirm';
    const budgetCap = intent.budget ? intent.budget * DEFAULT_BUDGET_TOLERANCE : Infinity;
    if (level === 'auto') return { allowed: true, level, reason: '该动作在自主授权范围内' };
    if (amount && amount > budgetCap) {
      return { allowed: false, level: 'blocked', reason: `金额 ${amount} 元超出预算容忍上限 ${Math.round(budgetCap)} 元，触发约束松弛协商`, suggestion: 'constraint-relax' };
    }
    if (userAuthorized) return { allowed: true, level, reason: '用户已授权' };
    return { allowed: false, level: 'confirm', reason: '该动作需要用户确认（涉及支付）', suggestion: 'request-user-confirm' };
  }

  // ============================================================
  // 支撑层:分层消费记忆体系(Fact / Preference / Episode)
  // ============================================================
  const memStores = new Map();

  const SEED_FACTS = {
    userId: 'u-001', family: '三口之家', childAge: 5, address: '杭州市西湖区',
    shoeSize: 42, allergies: ['花生'], brandBlacklist: ['某杂牌'],
    budgetHabit: { typical: 2000, max: 5000 }, maxDriveHours: 2,
    cleanlinessPreference: 4.5, preferredPlatforms: ['京东', '携程', '美团']
  };

  const SEED_PREFERENCES = {
    priceSensitivity: { value: 'high', confidence: 0.85, evidence: '近5次消费中4次选择历史低价附近SKU' },
    styleTendency: { value: '实用优先', confidence: 0.7, evidence: '多次跳过高颜值溢价款' },
    brandOpenness: { value: '中', confidence: 0.6, evidence: '愿意尝试新品牌但需高评分背书' },
    decisionStyle: { value: '深度研究型', confidence: 0.75, evidence: '平均比价3.2个平台后才下单' },
    outdoorExperience: { value: '入门级', confidence: 0.8, evidence: '露营装备购买记录以入门款为主' }
  };

  const SEED_EPISODES = [
    { episodeId: 'ep-001', timestamp: '2026-05-12', scene: 'hiking', intent: '买一双周末徒步鞋', context: { weather: '初夏', trail: '杭州径山古道' }, candidates: ['探路者徒步鞋', 'Salomon X Ultra 3', '迈乐 Moab 3'], finalChoice: { product: '迈乐 Moab 3', platform: '京东', price: 659 }, outcome: { rating: 3, feedback: '湿地抓地力一般，雨后石板路有打滑', wouldRepurchase: false }, causalLinks: [{ cause: '选择 Vibram 大底但非湿地质', effect: '湿地打滑' }], lessons: ['同品类后续选购需优先看湿地抓地力评分'] },
    { episodeId: 'ep-002', timestamp: '2026-07-20', scene: 'family-trip', intent: '莫干山周末亲子游住宿', context: { childAge: 5, season: '夏季' }, candidates: ['莫干山亲子度假酒店', '裸心谷', '安吉帐篷客'], finalChoice: { product: '莫干山亲子度假酒店', platform: '携程', price: 688 }, outcome: { rating: 5, feedback: '儿童乐园很赞，孩子玩得不想走，卫生也很好', wouldRepurchase: true }, causalLinks: [{ cause: '酒店含室内儿童乐园', effect: '雨天也不无聊，体验超预期' }], lessons: ['该酒店适合重复选择；亲子游住宿优先看儿童设施与卫生评分'] },
    { episodeId: 'ep-003', timestamp: '2026-09-03', scene: 'camping', intent: '首次家庭露营装备尝试', context: { people: 3, season: '初秋' }, candidates: ['牧高笛冷山2', '挪客云层2'], finalChoice: { product: '挪客 Cloud Up 2', platform: '天猫', price: 449 }, outcome: { rating: 4, feedback: '搭建方便重量轻，但2人帐对三口之家略挤', wouldRepurchase: false }, causalLinks: [{ cause: '按2人容量选购', effect: '三口之家使用空间不足' }], lessons: ['家庭露营需选3-4人容量帐篷，容量宁大勿小'] }
  ];

  class MemoryStore {
    constructor(userId) {
      if (!memStores.has(userId)) {
        memStores.set(userId, {
          facts: userId === 'u-001' ? { ...SEED_FACTS } : { userId },
          preferences: userId === 'u-001' ? JSON.parse(JSON.stringify(SEED_PREFERENCES)) : {},
          episodes: userId === 'u-001' ? JSON.parse(JSON.stringify(SEED_EPISODES)) : []
        });
      }
      this.userId = userId;
    }
    get data() { return memStores.get(this.userId); }
    getFacts() { return this.data.facts; }
    getPreferences() { return this.data.preferences; }
    getEpisodes() { return this.data.episodes; }
    recordEpisode(episode) {
      const ep = {
        episodeId: `ep-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString().slice(0, 10),
        ...episode,
        outcome: episode.outcome || { status: 'pending', feedback: null },
        causalLinks: episode.causalLinks || [],
        lessons: episode.lessons || []
      };
      this.data.episodes.push(ep);
      return ep;
    }
    searchEpisodes(query = {}) {
      const { scene, category, keyword } = query;
      return this.data.episodes.filter(ep => {
        if (scene && ep.scene !== scene) return false;
        if (category && !JSON.stringify(ep).includes(category)) return false;
        if (keyword && !JSON.stringify(ep).includes(keyword)) return false;
        return true;
      });
    }
    getEpisodeInsights(query = {}) {
      const related = this.searchEpisodes(query);
      return related
        .filter(ep => ep.outcome && ep.outcome.rating !== undefined && ep.outcome.rating < 4)
        .map(ep => ({
          fromEpisode: ep.episodeId, date: ep.timestamp, scenario: ep.intent,
          whatHappened: ep.outcome.feedback,
          lesson: ep.lessons[0] || '该经历提示同类消费需注意历史反馈',
          actionableAdvice: generateAdvice(ep)
        }));
    }
    getMemoryContext() {
      return {
        facts: this.data.facts,
        preferences: Object.fromEntries(Object.entries(this.data.preferences).map(([k, v]) => [k, v.value])),
        preferenceDetails: this.data.preferences,
        episodeCount: this.data.episodes.length
      };
    }
  }

  function generateAdvice(ep) {
    if (ep.scene === 'hiking' && /湿地|打滑|抓地/.test(ep.outcome.feedback || '')) {
      return '本次同品类选购将优先核验湿地抓地力评分，过滤无防滑技术标注的 SKU';
    }
    if (ep.scene === 'camping' && /挤|空间|容量/.test(ep.outcome.feedback || '')) {
      return '本次露营装备将按人数+1选择容量，避免空间不足';
    }
    if (ep.scene === 'family-trip' && ep.outcome.rating >= 4) {
      return `上次选择的「${ep.finalChoice.product}」体验良好，本次可优先考虑同款或同系列`;
    }
    return '将参考该历史经历的反馈调整本次筛选权重';
  }

  // __END_BATCH_4__

  // ============================================================
  // 执行层:动态路由与状态机(Orchestrator Core)
  // ============================================================
  function executeTaskGraph(taskGraph, intent, boundary, options = {}) {
    const { authorized = false, relaxOption = null } = options;
    clearTrace();
    if (taskGraph.budgetAllocation && !intent.budgetAllocation) {
      intent.budgetAllocation = taskGraph.budgetAllocation;
    }
    const nodeMap = {};
    for (const n of taskGraph.nodes) nodeMap[n.id] = { ...n, status: 'pending' };
    const results = {};
    const categoryResults = {};
    const executionLog = [];
    let pendingAuthorization = null;
    let relaxation = null;
    let checkoutResult = null;

    const maxIter = taskGraph.nodes.length * 2 + 10;
    for (let iter = 0; iter < maxIter; iter++) {
      const ready = Object.values(nodeMap).filter(n =>
        n.status === 'pending' && n.dependsOn.every(d => nodeMap[d].status === 'done')
      );
      if (!ready.length) break;

      for (const node of ready) {
        const authCheck = checkAuthorization({ nodeId: node.id }, null, boundary.boundary, intent, authorized);
        if (!authCheck.allowed && node.type === 'checkout') {
          nodeMap[node.id].status = 'blocked';
          pendingAuthorization = { nodeId: node.id, action: '支付下单', reason: authCheck.reason, awaiting: 'user-confirm' };
          executionLog.push({ step: executionLog.length + 1, nodeId: node.id, action: node.label, status: 'blocked', detail: authCheck.reason });
          continue;
        }

        nodeMap[node.id].status = 'running';
        const t0 = Date.now();
        let result;

        switch (node.type) {
          case 'search':
            result = matchExpert(node, intent);
            categoryResults[node.category] = { search: result };
            break;
          case 'compare': {
            const upstream = categoryResults[node.category]?.search;
            result = compareExpert(node, intent, upstream);
            categoryResults[node.category] = { ...(categoryResults[node.category] || {}), compare: result };
            break;
          }
          case 'timing': {
            const upstream = categoryResults[node.category]?.compare;
            result = timingExpert(node, intent, upstream);
            categoryResults[node.category] = { ...(categoryResults[node.category] || {}), timing: result };
            break;
          }
          case 'bundle': {
            const latest = {};
            for (const [cat, cr] of Object.entries(categoryResults)) {
              latest[cat] = cr.timing || cr.compare || cr.search;
            }
            result = bundleExpert(node, intent, latest);
            const cp = checkpoint(node, result, intent);
            if (!cp.passed) {
              relaxation = constraintRelaxation(result, intent, latest);
              result.relaxation = relaxation;
              if (relaxOption) {
                result = applyRelaxOption(result, relaxOption, intent);
              }
            }
            break;
          }
          case 'checkout': {
            const bundleResult = results[taskGraph.nodes.find(n => n.type === 'bundle').id];
            const afterSales = afterSalesExpert(node, bundleResult);
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
        const cp = node.type !== 'bundle' ? checkpoint(node, result, intent) : { passed: true, issues: [] };
        executionLog.push({
          step: executionLog.length + 1, nodeId: node.id,
          action: node.label, expert: node.expert, status: 'done',
          durationMs: duration, detail: result.reasoning || result.status || '完成',
          checkpoint: cp
        });
      }
    }

    const bundleNode = taskGraph.nodes.find(n => n.type === 'bundle');
    const bundleResult = bundleNode ? results[bundleNode.id] : null;

    return {
      executionLog, toolTrace: getTrace(),
      nodeStates: Object.fromEntries(Object.entries(nodeMap).map(([id, n]) => [id, n.status])),
      categoryResults, bundleResult, relaxation,
      pendingAuthorization, checkoutResult,
      finalStatus: pendingAuthorization ? 'awaiting-authorization'
        : (checkoutResult && checkoutResult.status === 'completed') ? 'completed'
        : relaxation ? 'needs-negotiation' : 'executed'
    };
  }

  function applyRelaxOption(bundleResult, optionId, intent) {
    const opt = (bundleResult.relaxation?.options || []).find(o => o.id === optionId);
    if (!opt) return bundleResult;
    const updated = {
      ...bundleResult,
      appliedRelaxOption: opt,
      totalPrice: opt.impact.newTotal,
      reasoning: `已应用「${opt.title}」方案，调整后总价 ${opt.impact.newTotal} 元`
    };
    if (opt.impact.newPicks) updated.picks = opt.impact.newPicks;
    if (opt.impact.newBudget) updated.budget = opt.impact.newBudget;
    updated.overBudget = updated.totalPrice > updated.budget;
    updated.budgetUtilization = updated.budget ? Math.round((updated.totalPrice / updated.budget) * 100) : null;
    return updated;
  }

  function buildOrderSummary(bundleResult, intent) {
    const orderId = 'ORD' + Date.now().toString(36).toUpperCase();
    return {
      orderId, createdAt: new Date().toISOString(),
      items: bundleResult.picks.map(p => ({
        category: p.category, product: p.name, platform: p.bestPlatform,
        price: p.bestPrice, coupon: p.platforms?.find(pl => pl.platform === p.bestPlatform)?.coupon || null
      })),
      totalAmount: bundleResult.totalPrice, budget: bundleResult.budget,
      saved: bundleResult.totalSaved,
      note: '订单已提交，各平台发货与物流信息将同步至你的待办'
    };
  }

  // ============================================================
  // API 层:与后端接口一致的本地 API(供前端 app.js 调用)
  // ============================================================
  const taskStore = new Map();
  let taskSeq = 0;

  const AgentAPI = {
    health() {
      return { status: 'ok', service: 'consumer-agent', time: new Date().toISOString() };
    },
    getMemory(userId) {
      const memory = new MemoryStore(userId || 'u-001');
      return { facts: memory.getFacts(), preferences: memory.getPreferences(), episodes: memory.getEpisodes() };
    },
    parseIntent(text, userId) {
      const memory = new MemoryStore(userId || 'u-001');
      const memCtx = memory.getMemoryContext();
      const intent = parseIntent(text || '', memCtx);
      const taskGraph = buildTaskGraph(intent);
      const boundary = declareBoundary(taskGraph, intent);
      const insights = memory.getEpisodeInsights({ scene: intent.scene });
      const taskId = `task-${++taskSeq}`;
      taskStore.set(taskId, { taskId, userId: userId || 'u-001', intent, taskGraph, boundary, status: 'planned', createdAt: new Date().toISOString() });
      return {
        taskId, intent, taskGraph, boundary,
        episodeInsights: insights,
        memorySnapshot: { facts: memCtx.facts, preferences: memCtx.preferenceDetails }
      };
    },
    execute(taskId, options) {
      options = options || {};
      const task = taskStore.get(taskId);
      if (!task) return { error: '任务不存在' };
      const result = executeTaskGraph(task.taskGraph, task.intent, task.boundary, {
        authorized: !!options.authorized,
        relaxOption: options.relaxOption || null
      });
      task.lastResult = result;
      task.status = result.finalStatus;
      return { taskId: task.taskId, ...result };
    },
    authorize(taskId, options) {
      options = options || {};
      const task = taskStore.get(taskId);
      if (!task) return { error: '任务不存在' };
      const result = executeTaskGraph(task.taskGraph, task.intent, task.boundary, {
        authorized: true,
        relaxOption: options.relaxOption || (task.lastResult && task.lastResult.bundleResult && task.lastResult.bundleResult.appliedRelaxOption ? task.lastResult.bundleResult.appliedRelaxOption.id : null)
      });
      task.lastResult = result;
      task.status = result.finalStatus;
      if (result.finalStatus === 'completed' && result.bundleResult) {
        const memory = new MemoryStore(task.userId);
        const episode = memory.recordEpisode({
          scene: task.intent.scene,
          intent: task.intent.rawText,
          context: { budget: task.intent.budget, deadline: task.intent.deadline ? task.intent.deadline.label : undefined },
          candidates: (result.bundleResult.picks || []).map(p => p.name),
          finalChoice: {
            products: (result.bundleResult.picks || []).map(p => ({ name: p.name, platform: p.bestPlatform, price: p.bestPrice })),
            total: result.bundleResult.totalPrice
          },
          outcome: { status: 'ordered', feedback: null },
          lessons: [`本次通过${(result.bundleResult.picks || []).length}品类组合优化完成委托，节省 ${result.bundleResult.totalSaved || 0} 元`]
        });
        result.recordedEpisode = episode.episodeId;
      }
      return { taskId: task.taskId, ...result };
    },
    getInsights(userId, scene) {
      const memory = new MemoryStore(userId || 'u-001');
      return { insights: memory.getEpisodeInsights({ scene }) };
    },
    // ===== 数据库动态数据接口 =====
    getProducts() {
      return allProducts.map(p => ({ ...p }));
    },
    getCoupons() {
      return coupons.map(c => ({ ...c }));
    },
    loadData(products, newCoupons) {
      if (Array.isArray(products) && products.length) {
        allProducts = products.map(p => ({ ...p }));
      }
      if (Array.isArray(newCoupons) && newCoupons.length) {
        coupons = newCoupons.map(c => ({ ...c }));
      }
      return {
        productCount: allProducts.length,
        couponCount: coupons.length,
        source: 'local-database'
      };
    },
    updateProduct(id, fields) {
      const idx = allProducts.findIndex(p => p.id === id);
      if (idx === -1) return { error: '商品不存在' };
      const oldPrice = allProducts[idx].price;
      allProducts[idx] = { ...allProducts[idx], ...fields };
      const newPrice = allProducts[idx].price;
      // 价格下调时自动刷新历史低价
      if (newPrice < oldPrice && (!allProducts[idx].historicalLow || newPrice < allProducts[idx].historicalLow)) {
        allProducts[idx].historicalLow = newPrice;
      }
      return { ok: true, product: { ...allProducts[idx] }, priceChanged: newPrice !== oldPrice, oldPrice, newPrice };
    }
  };

  window.AgentAPI = AgentAPI;
})();