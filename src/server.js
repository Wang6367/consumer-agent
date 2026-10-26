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
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // 健康检查
  if (path === '/health') {
    sendJson(res, 200, { status: 'ok', service: 'consumer-agent', time: new Date().toISOString() });
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
  console.log(`[consumer-agent] 服务已启动: http://${HOST}:${PORT}`);
});