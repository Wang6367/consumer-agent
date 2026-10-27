/**
 * 消费智能体 - HTTP 服务入口
 *
 * DevCloud 平台约束:
 *  - 仅暴露容器端口 8080(平台 K8s ingress 仅路由 8080)
 *  - 必须绑定 0.0.0.0(绑定 127.0.0.1 时容器外不可达)
 *  - 仅暴露一个端口
 *
 * 零外部依赖,仅使用 Node.js 内置模块。
 */

const http = require('http');
const { URL } = require('url');

const { parseIntent, SCENE_RULES } = require('./commander/intent-parser');
const { buildTaskGraph } = require('./commander/task-graph');
const { declareBoundary } = require('./commander/authorization');
const { executeTaskGraph } = require('./orchestrator/router');
const { MemoryStore } = require('./memory/memory-store');
const db = require('./data/db');
const catalog = require('./data/catalog');

const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';
const MAX_BODY = 1024 * 256; // 256KB

// ---------- 工具函数 ----------
function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
  const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function parseJsonBody(raw) {
  if (!raw || !raw.trim()) return {};
  const obj = JSON.parse(raw);
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('body must be a JSON object');
  }
  return obj;
}

// ---------- 数据库初始化与内存同步 ----------
// 启动时将 SQLite 数据加载到 catalog 内存,agent 执行链(tools.js)自动使用最新数据
function syncFromDb() {
  catalog.loadData(db.getAllProducts(), db.getCoupons());
}
db.seedIfEmpty();
syncFromDb();

// ---------- 业务流程 ----------
function runPlanning(text, userId) {
  const store = new MemoryStore(userId);
  const memory = store.getMemoryContext();
  const intent = parseIntent(text, memory);
  const taskGraph = buildTaskGraph(intent);
  const boundary = declareBoundary(taskGraph, intent);
  return { intent, taskGraph, boundary };
}

function runFullPipeline(text, userId, authorized, relaxOption) {
  const { intent, taskGraph, boundary } = runPlanning(text, userId);
  const execution = executeTaskGraph(taskGraph, intent, boundary, { authorized, relaxOption });
  return {
    understood: {
      scene: intent.sceneLabel,
      budget: intent.budget,
      deadline: intent.deadline,
      categories: intent.categories,
      hardConstraints: intent.hardConstraints,
      semanticNotes: intent.semanticNotes
    },
    plan: {
      nodes: taskGraph.nodes.map(n => ({ id: n.id, type: n.type, category: n.category, label: n.label, dependsOn: n.dependsOn })),
      edges: taskGraph.edges,
      budgetAllocation: taskGraph.budgetAllocation,
      summary: taskGraph.summary
    },
    authorizationPolicy: boundary.policy,
    confirmActions: boundary.confirmActions,
    execution
  };
}

// ---------- 路由 ----------
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // 健康检查
  if (path === '/health' || path === '/api/health') {
    sendJson(res, 200, {
      status: 'ok', service: 'consumer-agent',
      time: new Date().toISOString(),
      stats: db.dbStats()
    });
    return;
  }

  // ---------- 数据管理 API(与 public/server.js 对应) ----------
  // GET /api/products[?scene=xxx&category=xxx]
  if (path === '/api/products' && method === 'GET') {
    let list = db.getAllProducts();
    const scene = url.searchParams.get('scene');
    const category = url.searchParams.get('category');
    if (scene) list = list.filter(p => p.scene === scene);
    if (category) list = list.filter(p => p.category === category);
    sendJson(res, 200, { products: list, count: list.length });
    return;
  }

  // GET /api/products/:id
  const mGetOne = method === 'GET' && path.match(/^\/api\/products\/([\w-]+)$/);
  if (mGetOne) {
    const p = db.getProductById(mGetOne[1]);
    return p ? sendJson(res, 200, p) : sendJson(res, 404, { error: '商品不存在' });
  }

  // PUT /api/products/:id ← 核心调价接口(同步DB+内存)
  const mPut = method === 'PUT' && path.match(/^\/api\/products\/([\w-]+)$/);
  if (mPut) {
    const body = parseJsonBody(await readBody(req));
    const updated = db.updateProduct(mPut[1], body);
    if (!updated) return sendJson(res, 404, { error: '商品不存在' });
    // 同步到 catalog 内存,agent 执行链立即生效
    catalog.updateProduct(mPut[1], { price: updated.price, historicalLow: updated.historicalLow, name: updated.name, rating: updated.rating, reviews: updated.reviews });
    return sendJson(res, 200, { ok: true, product: updated });
  }

  // GET /api/price-history/:productId
  const mHist = method === 'GET' && path.match(/^\/api\/price-history\/([\w-]+)$/);
  if (mHist) {
    sendJson(res, 200, { productId: mHist[1], history: db.getPriceHistory(mHist[1]) });
    return;
  }

  // GET /api/coupons
  if (path === '/api/coupons' && method === 'GET') {
    sendJson(res, 200, { coupons: db.getCoupons() });
    return;
  }

  // POST /api/reset ← 重置为初始数据
  if (path === '/api/reset' && method === 'POST') {
    const result = db.resetData();
    syncFromDb(); // 重置后重新同步内存
    sendJson(res, 200, { ok: true, ...result });
    return;
  }

  // 支持的场景
  if (path === '/api/scenes') {
    sendJson(res, 200, {
      scenes: SCENE_RULES.map(r => ({ scene: r.scene, label: r.label, keywords: r.keywords, defaultCategories: r.defaultCategories }))
    });
    return;
  }

  // 规划阶段:意图解析 + 任务图 + 授权边界(不执行)
  if (path === '/api/plan' && method === 'POST') {
    const body = parseJsonBody(await readBody(req));
    if (!body.text) return sendJson(res, 400, { error: '缺少必填字段 text(消费意图文本)' });
    const userId = body.userId || 'u-001';
    const result = runPlanning(body.text, userId);
    sendJson(res, 200, {
      understood: {
        scene: result.intent.sceneLabel,
        budget: result.intent.budget,
        deadline: result.intent.deadline,
        categories: result.intent.categories,
        hardConstraints: result.intent.hardConstraints,
        semanticNotes: result.intent.semanticNotes
      },
      plan: {
        nodes: result.taskGraph.nodes.map(n => ({ id: n.id, type: n.type, category: n.category, label: n.label, dependsOn: n.dependsOn })),
        edges: result.taskGraph.edges,
        budgetAllocation: result.taskGraph.budgetAllocation,
        summary: result.taskGraph.summary
      },
      authorizationPolicy: result.boundary.policy,
      confirmActions: result.boundary.confirmActions
    });
    return;
  }

  // 全流程执行:规划 → 路由执行 → 组合 → (授权)下单
  if (path === '/api/execute' && method === 'POST') {
    const body = parseJsonBody(await readBody(req));
    if (!body.text) return sendJson(res, 400, { error: '缺少必填字段 text(消费意图文本)' });
    const userId = body.userId || 'u-001';
    const result = runFullPipeline(body.text, userId, !!body.authorized, body.relaxOption || null);
    sendJson(res, 200, result);
    return;
  }

  // 用户记忆查询
  const memMatch = path.match(/^\/api\/memory\/([\w-]+)$/);
  if (memMatch && method === 'GET') {
    const store = new MemoryStore(memMatch[1]);
    sendJson(res, 200, {
      userId: memMatch[1],
      memoryContext: store.getMemoryContext(),
      episodes: store.getEpisodes(),
      insights: store.getEpisodeInsights()
    });
    return;
  }

  // 首页:服务状态页
  if (path === '/' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>消费智能体</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 16px;color:#333}h1{color:#1a73e8}li{margin:4px 0}code{background:#f5f5f5;padding:2px 6px;border-radius:4px}</style>
</head><body><h1>消费智能体服务运行中</h1>
<p>意图拆解 / 任务图编排 / 专家路由 / 授权下单 —— 全流程消费代理。</p>
<h2>API 接口</h2><ul>
<li><code>GET  /health</code> — 健康检查</li>
<li><code>GET  /api/scenes</code> — 支持的消费场景</li>
<li><code>POST /api/plan</code> — 意图解析 + 任务图规划(不执行)</li>
<li><code>POST /api/execute</code> — 全流程执行(检索→比价→时效→组合→下单)</li>
<li><code>GET  /api/memory/:userId</code> — 用户记忆与历史经历洞察</li>
<li><code>GET  /api/products</code> — 商品列表(支持 ?scene=&category= 筛选)</li>
<li><code>PUT  /api/products/:id</code> — 更新商品价格(自动记录历史+刷新史低)</li>
<li><code>GET  /api/price-history/:productId</code> — 价格变更历史</li>
<li><code>GET  /api/coupons</code> — 优惠券列表</li>
<li><code>POST /api/reset</code> — 重置为初始数据</li>
</ul>
<h2>快速体验</h2>
<pre>curl -X POST /api/execute -H "Content-Type: application/json" \\
  -d '{"text":"周末带5岁孩子去莫干山亲子游,预算3千以内,住宿要干净"}'</pre>
</body></html>`);
    return;
  }

  sendJson(res, 404, { error: `未找到路由: ${method} ${path}` });
}

// ---------- 启动服务 ----------
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    if (err.message === 'payload too large') return sendJson(res, 413, { error: '请求体过大' });
    if (err instanceof SyntaxError) return sendJson(res, 400, { error: 'JSON 格式错误' });
    console.error('[server] 未捕获错误:', err);
    sendJson(res, 500, { error: '服务器内部错误', detail: err.message });
  });
});

server.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('  消费智能体 · 模块化后端已启动');
  console.log(`  服务地址:  http://${HOST}:${PORT}`);
  console.log(`  SQLite:    ${db.DB_PATH}`);
  console.log(`  数据统计:  ${JSON.stringify(db.dbStats())}`);
  console.log('  Agent API: /api/plan /api/execute /api/memory/:id');
  console.log('  数据 API:  /api/products /api/coupons /api/reset');
  console.log('====================================================');
});