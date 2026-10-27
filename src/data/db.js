/**
 * 消费智能体 - SQLite 数据库模块
 * 零依赖:仅使用 Node.js 内置 node:sqlite
 * 与 public/server.js 的数据库层对应,供 src/server.js 使用
 *
 * seed 数据直接从 catalog.js 派生,消除数据重复。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const { campingProducts, familyTripProducts, coupons: seedCoupons } = require('./catalog');

const DATA_DIR = path.join(__dirname);
const DB_PATH = path.join(DATA_DIR, 'consumer.db');

// ============================================================
// 初始化
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
// Seed 数据(从 catalog.js 派生,不重复维护)
// ============================================================
const SEED_PRODUCTS = [
  ...campingProducts.map(p => ({ ...p, scene: 'camping' })),
  ...familyTripProducts.map(p => ({ ...p, scene: 'family-trip' }))
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
  for (const c of seedCoupons) {
    insertCoupon.run(c.id, c.platform, c.scope, c.amount, c.threshold, c.expire);
  }
  console.log(`[seed] 已导入 ${SEED_PRODUCTS.length} 个商品、${seedCoupons.length} 张优惠券`);
  return true;
}

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
    dbPath: path.relative(path.join(__dirname, '..'), DB_PATH)
  };
}

module.exports = {
  db, DB_PATH,
  seedIfEmpty, getAllProducts, getProductById, updateProduct,
  getPriceHistory, getCoupons, resetData, dbStats
};