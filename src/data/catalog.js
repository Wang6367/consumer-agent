/**
 * 模拟商品目录与消费数据
 * 覆盖露营装备、亲子游两大 Demo 场景
 */

// ============ 露营装备 ============
const campingProducts = [
  {
    id: 'tent-001', name: '牧高笛 冷山2 Air 自动帐篷', category: '帐篷',
    price: 599, historicalLow: 489, weight: 2.1, capacity: 2,
    platforms: ['京东', '天猫', '拼多多'],
    tags: ['轻量', '自动搭建', '防水2000mm'],
    rating: 4.7, reviews: 12800,
    stock: { '京东': true, '天猫': true, '拼多多': false },
    deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 4 }
  },
  {
    id: 'tent-002', name: '挪客 Cloud Up 2 云层帐篷', category: '帐篷',
    price: 469, historicalLow: 399, weight: 1.7, capacity: 2,
    platforms: ['京东', '天猫'],
    tags: ['超轻', '徒步友好', '防水3000mm'],
    rating: 4.6, reviews: 8600,
    stock: { '京东': true, '天猫': true },
    deliveryDays: { '京东': 1, '天猫': 3 }
  },
  {
    id: 'tent-003', name: '探险者 全自动液压帐篷 4人', category: '帐篷',
    price: 359, historicalLow: 299, weight: 3.8, capacity: 4,
    platforms: ['京东', '拼多多'],
    tags: ['家庭', '液压自动', '防水1500mm'],
    rating: 4.4, reviews: 21000,
    stock: { '京东': true, '拼多多': true },
    deliveryDays: { '京东': 2, '拼多多': 5 }
  },
  {
    id: 'sleep-001', name: '黑冰 B700 睡袋', category: '睡眠系统',
    price: 428, historicalLow: 368, weight: 0.95, tempRating: '-5℃',
    platforms: ['京东', '天猫'],
    tags: ['羽绒', '轻量', '保暖'],
    rating: 4.8, reviews: 5400,
    stock: { '京东': true, '天猫': true },
    deliveryDays: { '京东': 1, '天猫': 2 }
  },
  {
    id: 'sleep-002', name: '挪客 信封式棉睡袋', category: '睡眠系统',
    price: 129, historicalLow: 99, weight: 1.4, tempRating: '5℃',
    platforms: ['京东', '天猫', '拼多多'],
    tags: ['棉质', '经济', '春秋季'],
    rating: 4.3, reviews: 18000,
    stock: { '京东': true, '天猫': true, '拼多多': true },
    deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 3 }
  },
  {
    id: 'mat-001', name: 'Therm-a-Rest Z Lite SOL 防潮垫', category: '睡眠系统',
    price: 248, historicalLow: 198, weight: 0.41, rValue: 2.0,
    platforms: ['京东', '天猫'],
    tags: ['蛋槽', '超轻', '多季节'],
    rating: 4.7, reviews: 3200,
    stock: { '京东': true, '天猫': false },
    deliveryDays: { '京东': 1 }
  },
  {
    id: 'stove-001', name: '火枫 野火2 分体式气炉', category: '炊具',
    price: 168, historicalLow: 138, weight: 0.35,
    platforms: ['京东', '天猫'],
    tags: ['高效', '防风', '便携'],
    rating: 4.6, reviews: 7600,
    stock: { '京东': true, '天猫': true },
    deliveryDays: { '京东': 1, '天猫': 2 }
  },
  {
    id: 'stove-002', name: '牧高笛 套锅炊具套装', category: '炊具',
    price: 199, historicalLow: 159, weight: 0.85,
    platforms: ['京东', '拼多多'],
    tags: ['套装', '铝制', '2-3人'],
    rating: 4.5, reviews: 9200,
    stock: { '京东': true, '拼多多': true },
    deliveryDays: { '京东': 1, '拼多多': 4 }
  },
  {
    id: 'lamp-001', name: '山力士 灵狐营地灯', category: '照明',
    price: 89, historicalLow: 69, weight: 0.12,
    platforms: ['京东', '天猫', '拼多多'],
    tags: ['充电', '调光', '防水'],
    rating: 4.5, reviews: 15000,
    stock: { '京东': true, '天猫': true, '拼多多': true },
    deliveryDays: { '京东': 1, '天猫': 2, '拼多多': 3 }
  },
  {
    id: 'backpack-001', name: 'Osprey Stratos 云层34L 登山包', category: '背包',
    price: 899, historicalLow: 749, weight: 1.32,
    platforms: ['京东', '天猫'],
    tags: ['透气背板', '轻量', '防雨罩'],
    rating: 4.8, reviews: 4100,
    stock: { '京东': true, '天猫': true },
    deliveryDays: { '京东': 2, '天猫': 2 }
  }
];

// ============ 亲子游（交通/住宿/门票/餐饮） ============
const familyTripProducts = [
  {
    id: 'hotel-001', name: '莫干山亲子度假酒店（含儿童乐园）', category: '住宿',
    price: 688, historicalLow: 588, type: '酒店',
    platforms: ['携程', '美团'],
    tags: ['亲子房', '室内乐园', '含早'],
    rating: 4.6, reviews: 3400,
    cleanliness: 4.8, distance: '杭州1.5h车程',
    stock: { '携程': true, '美团': true }
  },
  {
    id: 'hotel-002', name: '安吉帐篷客度假酒店', category: '住宿',
    price: 928, historicalLow: 798, type: '酒店',
    platforms: ['携程', '飞猪'],
    tags: ['自然风光', '帐篷主题', '亲子活动'],
    rating: 4.7, reviews: 2100,
    cleanliness: 4.9, distance: '杭州2h车程',
    stock: { '携程': true, '飞猪': false }
  },
  {
    id: 'ticket-001', name: '莫干山奇幻谷亲子乐园门票', category: '门票',
    price: 128, historicalLow: 99, type: '门票',
    platforms: ['美团', '携程'],
    tags: ['儿童免票', '周末可用'],
    rating: 4.5, reviews: 8800,
    stock: { '美团': true, '携程': true }
  },
  {
    id: 'ticket-002', name: '安吉竹博园+熊猫馆联票', category: '门票',
    price: 88, historicalLow: 68, type: '门票',
    platforms: ['美团', '携程'],
    tags: ['1.2m以下免票', '联票优惠'],
    rating: 4.4, reviews: 12000,
    stock: { '美团': true, '携程': true }
  },
  {
    id: 'trans-001', name: '杭州东→德清 高铁往返（2大1小）', category: '交通',
    price: 156, historicalLow: 156, type: '交通',
    platforms: ['12306'],
    tags: ['儿童半价', '30分钟直达'],
    rating: 4.9, reviews: 0,
    stock: { '12306': true }
  },
  {
    id: 'trans-002', name: '自驾租车 5座SUV 周末2日', category: '交通',
    price: 329, historicalLow: 269, type: '交通',
    platforms: ['神州', '一嗨'],
    tags: ['儿童座椅可租', '无限里程'],
    rating: 4.3, reviews: 5600,
    stock: { '神州': true, '一嗨': true }
  }
];

// ============ 价格历史（近30天趋势） ============
function genPriceHistory(base, low) {
  const points = [];
  let cur = base;
  for (let i = 29; i >= 0; i--) {
    // 模拟波动，偶尔触及低价
    const wave = Math.sin(i / 4) * (base - low) * 0.25;
    const noise = ((i * 37) % 11 - 5) * (base - low) * 0.03;
    cur = Math.round(low + (base - low) * 0.5 + wave + noise);
    points.push({ day: i, price: Math.max(low, Math.min(base + 50, cur)) });
  }
  return points;
}

// ============ 售后政策 ============
const afterSalesPolicies = {
  '京东': { returnDays: 7, exchangeDays: 15, freightInsurance: true, notes: '支持上门取件' },
  '天猫': { returnDays: 7, exchangeDays: 15, freightInsurance: true, notes: '运费险自动理赔' },
  '拼多多': { returnDays: 7, exchangeDays: 0, freightInsurance: false, notes: '需自行寄回' },
  '携程': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '酒店预订取消政策以房型为准，通常提前24h免费取消' },
  '美团': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '未消费随时退，过期自动退' },
  '12306': { returnDays: 0, exchangeDays: 0, freightInsurance: false, notes: '开车前8天免费退改' }
};

// 数据层改为可变:支持从数据库动态加载与运行时更新
let allProducts = [...campingProducts, ...familyTripProducts];
let coupons = [
  { id: 'cp-1', platform: '京东', scope: '户外运动', amount: 60, threshold: 300, expire: '2026-11-15' },
  { id: 'cp-2', platform: '京东', scope: '全品类', amount: 20, threshold: 100, expire: '2026-11-30' },
  { id: 'cp-3', platform: '天猫', scope: '户外露营', amount: 100, threshold: 500, expire: '2026-11-11' },
  { id: 'cp-4', platform: '美团', scope: '酒店民宿', amount: 50, threshold: 400, expire: '2026-11-20' },
  { id: 'cp-5', platform: '携程', scope: '门票', amount: 30, threshold: 200, expire: '2026-11-25' }
];

/**
 * 从外部(如SQLite数据库)批量加载商品与优惠券,替换内存数据
 * 与 public/agent-core.js 中 AgentAPI.loadData() 对应
 */
function loadData(products, newCoupons) {
  if (Array.isArray(products)) allProducts = products;
  if (Array.isArray(newCoupons)) coupons = newCoupons;
}

/**
 * 更新单个商品字段(含历史最低价自动刷新)
 * 与 public/agent-core.js 中 AgentAPI.updateProduct() 对应
 */
function updateProduct(id, fields) {
  const p = allProducts.find(item => item.id === id);
  if (!p) return null;
  Object.assign(p, fields);
  // 新价低于历史最低 → 自动刷新史低
  if (fields.price !== undefined && fields.price < (p.historicalLow ?? Infinity)) {
    p.historicalLow = fields.price;
  }
  return p;
}

module.exports = {
  campingProducts,
  familyTripProducts,
  // getter 导出:catalog.allProducts 始终返回最新内存数据,tools.js 无需改动
  get allProducts() { return allProducts; },
  get coupons() { return coupons; },
  genPriceHistory,
  afterSalesPolicies,
  loadData,
  updateProduct
};