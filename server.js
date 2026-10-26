/**
 * 消费智能体 - 服务入口
 * 零外部依赖，使用 Node.js 原生 http 模块。
 *
 * DevCloud 部署规范：
 *  - 监听端口 8080（平台唯一暴露端口）
 *  - 绑定 0.0.0.0（localhost 绑定在容器外不可见）
 *  - 单端口（不暴露 metrics 等额外端口）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { parseIntent } = require('./src/commander/intent-parser');
const { buildTaskGraph } = require('./src/commander/task-graph');
const { declareBoundary } = require('./src/commander/authorization');
const { executeTaskGraph } = require('./src/orchestrator/router');
const { MemoryStore } = require('./src/memory/memory-store');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// ============ 任务存储（内存） ============
const taskStore = new Map();
let taskSeq = 0;

// ============ 静态文件服务 ============
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  let filePath = req.pathname === '/' ? '/index.html' : req.pathname;
  const full = path.join(__dirname, 'public', filePath);
  if (!full.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ============ 请求体解析 ============
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ============ API 路由 ============
async function handleApi(req, res) {
  const p = req.pathname;

  // 健康检查
  if (p === '/api/health') return json(res, 200, { status: 'ok', service: 'consumer-agent', time: new Date().toISOString() });

  // 1. 意图拆解：生成任务图 + 授权边界
  if (p === '/api/intent' && req.method === 'POST') {
    const body = await readBody(req);
    const userId = body.userId || 'u-001';
    const memory = new MemoryStore(userId);
    const memCtx = memory.getMemoryContext();
    const intent = parseIntent(body.text || '', memCtx);
    const taskGraph = buildTaskGraph(intent);
    const boundary = declareBoundary(taskGraph, intent);
    const insights = memory.getEpisodeInsights({ scene: intent.scene });
    const taskId = `task-${++taskSeq}`;
    taskStore.set(taskId, { taskId, userId, intent, taskGraph, boundary, status: 'planned', createdAt: new Date().toISOString() });
    return json(res, 200, { taskId, intent, taskGraph, boundary, episodeInsights: insights, memorySnapshot: { facts: memCtx.facts, preferences: memCtx.preferenceDetails } });
  }

  // 2. 执行任务图
  if (p === '/api/execute' && req.method === 'POST') {
    const body = await readBody(req);
    const task = taskStore.get(body.taskId);
    if (!task) return json(res, 404, { error: '任务不存在' });
    const result = executeTaskGraph(task.taskGraph, task.intent, task.boundary, {
      authorized: !!body.authorized,
      relaxOption: body.relaxOption || null
    });
    task.lastResult = result;
    task.status = result.finalStatus;
    return json(res, 200, { taskId: task.taskId, ...result });
  }

  // 3. 用户授权下单
  if (p === '/api/authorize' && req.method === 'POST') {
    const body = await readBody(req);
    const task = taskStore.get(body.taskId);
    if (!task) return json(res, 404, { error: '任务不存在' });
    const result = executeTaskGraph(task.taskGraph, task.intent, task.boundary, {
      authorized: true, relaxOption: body.relaxOption || task.lastResult?.bundleResult?.appliedRelaxOption?.id || null
    });
    task.lastResult = result;
    task.status = result.finalStatus;
    // 授权完成 → 写入经历记忆（消费事件图谱）
    if (result.finalStatus === 'completed' && result.bundleResult) {
      const memory = new MemoryStore(task.userId);
      const episode = memory.recordEpisode({
        scene: task.intent.scene,
        intent: task.intent.rawText,
        context: { budget: task.intent.budget, deadline: task.intent.deadline?.label },
        candidates: (result.bundleResult.picks || []).map(p => p.name),
        finalChoice: { products: (result.bundleResult.picks || []).map(p => ({ name: p.name, platform: p.bestPlatform, price: p.bestPrice })), total: result.bundleResult.totalPrice },
        outcome: { status: 'ordered', feedback: null },
        lessons: [`本次通过${(result.bundleResult.picks || []).length}品类组合优化完成委托，节省 ${result.bundleResult.totalSaved || 0} 元`]
      });
      result.recordedEpisode = episode.episodeId;
    }
    return json(res, 200, { taskId: task.taskId, ...result });
  }

  // 4. 获取记忆
  if (p === '/api/memory' && req.method === 'GET') {
    const userId = req.query.userId || 'u-001';
    const memory = new MemoryStore(userId);
    return json(res, 200, {
      facts: memory.getFacts(),
      preferences: memory.getPreferences(),
      episodes: memory.getEpisodes()
    });
  }

  // 5. 经历洞察
  if (p === '/api/insights' && req.method === 'GET') {
    const userId = req.query.userId || 'u-001';
    const scene = req.query.scene;
    const memory = new MemoryStore(userId);
    return json(res, 200, { insights: memory.getEpisodeInsights({ scene }) });
  }

  // 6. 任务列表
  if (p === '/api/tasks' && req.method === 'GET') {
    const list = [...taskStore.values()].map(t => ({
      taskId: t.taskId, intent: t.intent.rawText, scene: t.intent.sceneLabel,
      status: t.status, createdAt: t.createdAt
    }));
    return json(res, 200, { tasks: list });
  }

  return json(res, 404, { error: `未知接口: ${req.method} ${p}` });
}

// ============ 服务器 ============
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  req.pathname = parsed.pathname;
  req.query = parsed.query;
  // CORS（Demo 用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.pathname.startsWith('/api/')) return handleApi(req, res);
  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`[consumer-agent] 消费智能体服务已启动 → http://${HOST}:${PORT}`);
  console.log(`[consumer-agent] Demo 前端: http://localhost:${PORT}/`);
  console.log(`[consumer-agent] 健康检查: http://localhost:${PORT}/api/health`);
});