/**
 * 执行层 - 底层工具生态接入
 * 模拟对接：商品检索API、价格历史数据库、库存/物流接口、优惠券聚合器。
 * 每个工具调用均记录调用轨迹（供审计回溯）。
 */

const catalog = require('../data/catalog');

// ---------- 工具调用轨迹记录 ----------
const toolTrace = [];

function recordTrace(tool, input, output, durationMs) {
  const entry = {
    tool, input, output: summarize(output),
    durationMs, timestamp: new Date().toISOString()
  };
  toolTrace.push(entry);
  return entry;
}

function summarize(output) {
  if (Array.isArray(output)) return `${output.length} 条结果`;
  if (output && typeof output === 'object') return Object.keys(output).slice(0, 5).join(',');
  return String(output).slice(0, 80);
}

// ---------- 工具1：商品检索 ----------
function productSearch({ category, constraints = [], scene }) {
  const t0 = Date.now();
  let pool = catalog.allProducts.filter(p => p.category === category);

  // 应用硬约束过滤
  for (const c of constraints) {
    if (c.type === 'weight' && c.value) {
      pool = pool.filter(p => !p.weight || p.weight <= c.value * 1.5); // 轻量约束放宽50%
    }
    if (c.type === 'people' && c.value) {
      pool = pool.filter(p => !p.capacity || p.capacity >= c.value);
    }
    if (c.type === 'cleanliness' && c.value) {
      pool = pool.filter(p => !p.cleanliness || p.cleanliness >= c.value);
    }
  }
  // 场景加权：亲子游优先儿童友好
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

// ---------- 工具2：价格历史查询 ----------
function priceHistory({ productId }) {
  const t0 = Date.now();
  const product = catalog.allProducts.find(p => p.id === productId);
  if (!product) return [];
  const history = catalog.genPriceHistory(product.price, product.historicalLow);
  recordTrace('price-history', { productId }, history, Date.now() - t0);
  return history;
}

// ---------- 工具3：优惠券聚合 ----------
function couponAggregator({ platform, category, amount }) {
  const t0 = Date.now();
  const matched = catalog.coupons.filter(cp =>
    cp.platform === platform &&
    amount >= cp.threshold &&
    (cp.scope === '全品类' || cp.scope.includes(category) || category.includes(cp.scope))
  );
  const best = matched.sort((a, b) => b.amount - a.amount)[0] || null;
  recordTrace('coupon-aggregator', { platform, category, amount }, best ? [best] : [], Date.now() - t0);
  return best;
}

// ---------- 工具4：库存与物流时效 ----------
function logisticsCheck({ productId, platform, deadline }) {
  const t0 = Date.now();
  const product = catalog.allProducts.find(p => p.id === productId);
  if (!product) return { available: false, reason: '商品不存在' };
  const inStock = product.stock[platform];
  if (!inStock) return { available: false, reason: `${platform} 无库存` };
  const days = product.deliveryDays ? product.deliveryDays[platform] : 1;
  const arriveBy = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const meetDeadline = !deadline || arriveBy <= deadline;
  recordTrace('logistics-check', { productId, platform, deadline }, { inStock, days, meetDeadline }, Date.now() - t0);
  return { available: true, platform, deliveryDays: days, arriveBy, meetDeadline };
}

// ---------- 工具5：售后政策解析 ----------
function afterSalesParser({ platform }) {
  const t0 = Date.now();
  const policy = catalog.afterSalesPolicies[platform] || null;
  recordTrace('after-sales-parser', { platform }, policy ? [policy] : [], Date.now() - t0);
  return policy;
}

function getTrace() { return [...toolTrace]; }
function clearTrace() { toolTrace.length = 0; }

module.exports = {
  productSearch, priceHistory, couponAggregator,
  logisticsCheck, afterSalesParser,
  getTrace, clearTrace, recordTrace
};