/**
 * 消费智能体 - 本地后端服务器
 * 零依赖:仅使用 Node.js 内置模块(http + node:sqlite)
 * 提供商品/价格/优惠券的 REST API 与静态文件服务
 *
 * 启动: node server.js   (或 npm start)
 * 仅初始化数据库: node server.js --init-only
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'consumer.db');

// ============================================================
// 数据库初始化
// ============================================================
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    scene         TEXT NOT NULL DEFAULT 'camping',
    price         REAL NOT NULL,
    historical_low REAL,
    rating        REAL,
    reviews       INTEGER DEFAULT 0,
    extra         TEXT,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id        TEXT PRIMARY KEY,
    platform  TEXT NOT NULL,
    scope     TEXT NOT NULL,
    amount    REAL NOT NULL,
    threshold REAL NOT NULL,
    expire    TEXT
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    old_price  REAL,
    new_price  REAL NOT NULL,
    note       TEXT,
    changed_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_history_product ON price_history(product_id);
`);

// ============================================================
// Seed 数据(与前端内置数据一致,首次启动自动导入)
// ============================================================
const SEED_PRODUCTS = [
  { id:'tent-001', name:'牧高笛 冷山2 Air 自动帐篷', category:'帐篷', scene:'camping', price:599, historicalLow:489, weight:2.1, capacity:2, platforms:['京东','天猫','拼多多'], tags:['轻量','自动搭建','防水2000mm'], rating:4.7, reviews:12800, stock:{'京东':true,'天猫':true,'拼多多':false}, deliveryDays:{'京东':1,'天猫':2,'拼多多':4} },
  { id:'tent-002', name:'挪客 Cloud Up 2 云层帐篷', category:'帐篷', scene:'camping', price:469, historicalLow:399, weight:1.7, capacity:2, platforms:['京东','天猫'], tags:['超轻','徒步友好','防水3000mm'], rating:4.6, reviews:8600, stock:{'京东':true,'天猫':true}, deliveryDays:{'京东':1,'天猫':3} },
  { id:'tent-003', name:'探险者 全自动液压帐篷 4人', category:'帐篷', scene:'camping', price:359, historicalLow:299, weight:3.8, capacity:4, platforms:['京东','拼多多'], tags:['家庭','液压自动','防水1500mm'], rating:4.4, reviews:21000, stock:{'京东':true,'拼多多':true}, deliveryDays:{'京东':2,'拼多多':5} },
  { id:'sleep-001', name:'黑冰 B700 睡袋', category:'睡眠系统', scene:'camping', price:428, historicalLow:368, weight:0.95, tempRating:'-5℃', platforms:['京东','天猫'], tags:['羽绒','轻量','保暖'], rating:4.8, reviews:5400, stock:{'京东':true,'天猫':true}, deliveryDays:{'京东':1,'天猫':2} },
  { id:'sleep-002', name:'挪客 信封式棉睡袋', category:'睡眠系统', scene:'camping', price:129, historicalLow:99, weight:1.4, tempRating:'5℃', platforms:['京东','天猫','拼多多'], tags:['棉质','经济','春秋季'], rating:4.3, reviews:18000, stock:{'京东':true,'天猫':true,'拼多多':true}, deliveryDays:{'京东':1,'天猫':2,'拼多多':3} },
  { id:'mat-001', name:'Therm-a-Rest Z Lite SOL 防潮垫', category:'睡眠系统', scene:'camping', price:248, historicalLow:198, weight:0.41, rValue:2.0, platforms:['京东','天猫'], tags:['蛋槽','超轻','多季节'], rating:4.7, reviews:3200, stock:{'京东':true,'天猫':false}, deliveryDays:{'京东':1} },
  { id:'stove-001', name:'火枫 野火2 分体式气炉', category:'炊具', scene:'camping', price:168, historicalLow:138, weight:0.35, platforms:['京东','天猫'], tags:['高效','防风','便携'], rating:4.6, reviews:7600, stock:{'京东':true,'天猫':true}, deliveryDays:{'京东':1,'天猫':2} },
  { id:'stove-002', name:'牧高笛 套锅炊具套装', category:'炊具', scene:'camping', price:199, historicalLow:159, weight:0.85, platforms:['京东','拼多多'], tags:['套装','铝制','2-3人'], rating:4.5, reviews:9200, stock:{'京东':true,'拼多多':true}, deliveryDays:{'京东':1,'拼多多':4} },
  { id:'lamp-001', name:'山力士 灵狐营地灯', category:'照明', scene:'camping', price:89, historicalLow:69, weight:0.12, platforms:['京东','天猫','拼多多'], tags:['充电','调光','防水'], rating:4.5, reviews:15000, stock:{'京东':true,'天猫':true,'拼多多':true}, deliveryDays:{'京东':1,'天猫':2,'拼多多':3} },
  { id:'backpack-001', name:'Osprey Stratos 云层34L 登山包', category:'背包', scene:'camping', price:899, historicalLow:749, weight:1.32, platforms:['京东','天猫'], tags:['透气背板','轻量','防雨罩'], rating:4.8, reviews:4100, stock:{'京东':true,'天猫':true}, deliveryDays:{'京东':2,'天猫':2} },
  { id:'hotel-001', name:'莫干山亲子度假酒店（含儿童乐园）', category:'住宿', scene:'family-trip', price:688, historicalLow:588, type:'酒店', platforms:['携程','美团'], tags:['亲子房','室内乐园','含早'], rating:4.6, reviews:3400, cleanliness:4.8, distance:'杭州1.5h车程', stock:{'携程':true,'美团':true} },
  { id:'hotel-002', name:'安吉帐篷客度假酒店', category:'住宿', scene:'family-trip', price:928, historicalLow:798, type:'酒店', platforms:['携程','飞猪'], tags:['自然风光','帐篷主题','亲子活动'], rating:4.7, reviews:2100, cleanliness:4.9, distance:'杭州2h车程', stock:{'携程':true,'飞猪':false} },
  { id:'ticket-001', name:'莫干山奇幻谷亲子乐园门票', category:'门票', scene:'family-trip', price:128, historicalLow:99, type:'门票', platforms:['美团','携程'], tags:['儿童免票','周末可用'], rating:4.5, reviews:8800, stock:{'美团':true,'携程':true} },
  { id:'ticket-002', name:'安吉竹博园+熊猫馆联票', category:'门票', scene:'family-trip', price:88, historicalLow:68, type:'门票', platforms:['美团','携程'], tags:['1.2m以下免票','联票优惠'], rating:4.4, reviews:12000, stock:{'美团':true,'携程':true} },
  { id:'trans-001', name:'杭州东→德清 高铁往返（2大1小）', category:'交通', scene:'family-trip', price:156, historicalLow:156, type:'交通', platforms:['12306'], tags:['儿童半价','30分钟直达'], rating:4.9, reviews:0, stock:{'12306':true} },
  { id:'trans-002', name:'自驾租车 5座SUV 周末2日', category:'交通', scene:'family-trip', price:329, historicalLow:269, type:'交通', platforms:['神州','一嗨'], tags:['儿童座椅可租','无限里程'], rating:4.3, reviews:5600, stock:{'神州':true,'一嗨':true} }
];

const SEED_COUPONS = [
  { id:'cp-1', platform:'京东', scope:'户外运动', amount:60, threshold:300, expire:'2026-11-15' },
  { id:'cp-2', platform:'京东', scope:'全品类', amount:20, threshold:100, expire:'2026-11-30' },
  { id:'cp-3', platform:'天猫', scope:'户外露营', amount:100, threshold:500, expire:'2026-11-11' },
  { id:'cp-4', platform:'美团', scope:'酒店民宿', amount:50, threshold:400, expire:'2026-11-20' },
  { id:'cp-5', platform:'携程', scope:'门票', amount:30, threshold:200, expire:'2026-11-25' }
];

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return false;
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, scene, price, historical_low, rating, reviews, extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCoupon = db.prepare(`
    INSERT INTO coupons (id, platform, scope, amount, threshold, expire)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const p of SEED_PRODUCTS) {
    const { id, name, category, scene, price, historicalLow, rating, reviews, ...rest } = p;
    insertProduct.run(id, name, category, scene || 'camping', price, historicalLow ?? null, rating ?? null, reviews ?? 0, JSON.stringify(rest));
  }
  for (const c of SEED_COUPONS) {
    insertCoupon.run(c.id, c.platform, c.scope, c.amount, c.threshold, c.expire);
  }
  console.log(`[seed] 已导入 ${SEED_PRODUCTS.length} 个商品、${SEED_COUPONS.length} 张优惠券`);
  return true;
}

seedIfEmpty();

// __END_SERVER_BATCH_1__

// ============================================================
// 数据访问层
// ============================================================
function rowToProduct(row) {
  if (!row) return null;
  const extra = row.extra ? JSON.parse(row.extra) : {};
  return {
    id: row.id, name: row.name, category: row.category, scene: row.scene,
    price: row.price, historicalLow: row.historical_low,
    rating: row.rating, reviews: row.reviews,
    updatedAt: row.updated_at, ...extra
  };
}

function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY category, price').all().map(rowToProduct);
}

function getProductById(id) {
  return rowToProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}

function updateProduct(id, fields) {
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!current) return null;
  const allowed = ['price', 'historicalLow', 'name', 'rating', 'reviews'];
  const extraFields = ['weight', 'capacity', 'tempRating', 'rValue', 'type', 'platforms', 'tags', 'stock', 'deliveryDays', 'cleanliness', 'distance'];
  const sets = [];
  const vals = [];
  let oldPrice = current.price;
  let newPrice = current.price;

  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (k === 'historicalLow') { sets.push('historical_low = ?'); vals.push(v); }
    else if (allowed.includes(k)) {
      sets.push(`${k} = ?`); vals.push(v);
      if (k === 'price') newPrice = v;
    } else if (extraFields.includes(k)) {
      const extra = current.extra ? JSON.parse(current.extra) : {};
      extra[k] = v;
      sets.push('extra = ?'); vals.push(JSON.stringify(extra));
    }
  }
  if (!sets.length) return rowToProduct(current);
  sets.push("updated_at = datetime('now','localtime')");
  vals.push(id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  // 价格变更 → 写入历史
  if (newPrice !== oldPrice) {
    db.prepare('INSERT INTO price_history (product_id, old_price, new_price, note) VALUES (?, ?, ?, ?)')
      .run(id, oldPrice, newPrice, fields.note || '手动调价');
    // 若新价低于历史最低,自动刷新历史低价
    if (current.historical_low === null || newPrice < current.historical_low) {
      db.prepare('UPDATE products SET historical_low = ? WHERE id = ?').run(newPrice, id);
    }
  }
  return getProductById(id);
}

function getPriceHistory(productId) {
  return db.prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY changed_at DESC, id DESC LIMIT 50')
    .all(productId);
}

function getCoupons() {
  return db.prepare('SELECT * FROM coupons ORDER BY platform').all()
    .map(r => ({ id: r.id, platform: r.platform, scope: r.scope, amount: r.amount, threshold: r.threshold, expire: r.expire }));
}

function updateCoupon(id, fields) {
  const current = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  if (!current) return null;
  const allowed = ['platform', 'scope', 'amount', 'threshold', 'expire'];
  const sets = []; const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k) && v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return current;
  vals.push(id);
  db.prepare(`UPDATE coupons SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
}

function resetData() {
  db.exec('DELETE FROM products; DELETE FROM coupons; DELETE FROM price_history;');
  seedIfEmpty();
  return { products: getAllProducts().length, coupons: getCoupons().length };
}

function dbStats() {
  return {
    products: db.prepare('SELECT COUNT(*) AS c FROM products').get().c,
    coupons: db.prepare('SELECT COUNT(*) AS c FROM coupons').get().c,
    priceChanges: db.prepare('SELECT COUNT(*) AS c FROM price_history').get().c,
    dbPath: path.relative(__dirname, DB_PATH)
  };
}

// __END_SERVER_BATCH_2__

// ============================================================
// HTTP 服务器
// ============================================================
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', c => { buf += c; if (buf.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const abs = path.join(__dirname, filePath);
  if (!abs.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found'); return; }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  // GET /api/health
  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { status: 'ok', service: 'consumer-agent-db', time: new Date().toISOString(), stats: dbStats() });
  }
  // GET /api/products[?scene=xxx&category=xxx]
  if (req.method === 'GET' && pathname === '/api/products') {
    const u = new URL(req.url, 'http://localhost');
    let list = getAllProducts();
    const scene = u.searchParams.get('scene');
    const category = u.searchParams.get('category');
    if (scene) list = list.filter(p => p.scene === scene);
    if (category) list = list.filter(p => p.category === category);
    return sendJson(res, 200, { products: list, count: list.length });
  }
  // GET /api/products/:id
  const mGetOne = req.method === 'GET' && pathname.match(/^\/api\/products\/([\w-]+)$/);
  if (mGetOne) {
    const p = getProductById(mGetOne[1]);
    return p ? sendJson(res, 200, p) : sendJson(res, 404, { error: '商品不存在' });
  }
  // PUT /api/products/:id  ← 核心调价接口
  const mPut = req.method === 'PUT' && pathname.match(/^\/api\/products\/([\w-]+)$/);
  if (mPut) {
    const body = await readBody(req);
    const updated = updateProduct(mPut[1], body);
    return updated ? sendJson(res, 200, { ok: true, product: updated })
      : sendJson(res, 404, { error: '商品不存在' });
  }
  // GET /api/price-history/:productId
  const mHist = req.method === 'GET' && pathname.match(/^\/api\/price-history\/([\w-]+)$/);
  if (mHist) {
    return sendJson(res, 200, { productId: mHist[1], history: getPriceHistory(mHist[1]) });
  }
  // GET /api/coupons
  if (req.method === 'GET' && pathname === '/api/coupons') {
    return sendJson(res, 200, { coupons: getCoupons() });
  }
  // PUT /api/coupons/:id
  const mCp = req.method === 'PUT' && pathname.match(/^\/api\/coupons\/([\w-]+)$/);
  if (mCp) {
    const body = await readBody(req);
    const updated = updateCoupon(mCp[1], body);
    return updated ? sendJson(res, 200, { ok: true, coupon: updated })
      : sendJson(res, 404, { error: '优惠券不存在' });
  }
  // POST /api/reset  ← 重置为初始数据
  if (req.method === 'POST' && pathname === '/api/reset') {
    return sendJson(res, 200, { ok: true, ...resetData() });
  }
  return sendJson(res, 404, { error: `未知接口: ${req.method} ${pathname}` });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  const u = new URL(req.url, 'http://localhost');
  try {
    if (u.pathname.startsWith('/api/')) {
      await handleApi(req, res, u.pathname);
    } else {
      serveStatic(req, res, u.pathname);
    }
  } catch (err) {
    console.error('[error]', err);
    sendJson(res, 500, { error: '服务器内部错误', detail: String(err.message || err) });
  }
});

// --init-only 模式:仅初始化数据库后退出
if (process.argv.includes('--init-only')) {
  console.log('[init-only] 数据库初始化完成:', DB_PATH);
  console.log('[init-only] 统计:', dbStats());
  db.close();
  process.exit(0);
}

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('  消费智能体 · 本地数据库版已启动');
  console.log(`  前端页面:  http://localhost:${PORT}`);
  console.log(`  API 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`  SQLite 数据库: ${DB_PATH}`);
  console.log('  统计:', JSON.stringify(dbStats()));
  console.log('====================================================');
});