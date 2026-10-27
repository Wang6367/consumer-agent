/* 消费智能体 Demo 前端交互 */
let currentTask = null;
let memoryData = null;
let selectedRelax = null;
let dbOnline = false;          // 本地数据库服务器是否在线
let dbProducts = [];           // 从数据库加载的商品(用于价格管理面板)
const COLORS = ['#2563eb','#7c3aed','#d97706','#059669','#dc2626','#0891b2','#db2777','#65a30d'];

// 本地数据库 API 请求封装
async function dbFetch(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error(`DB API ${path} → ${res.status}`);
  return res.json();
}

async function api(path, opts = {}) {
  const body = opts.body || {};
  if (path === 'health') return AgentAPI.health();
  if (path.startsWith('memory')) {
    const uid = path.includes('userId=') ? path.split('userId=')[1] : 'u-001';
    return AgentAPI.getMemory(uid);
  }
  if (path === 'intent') return AgentAPI.parseIntent(body.text, body.userId);
  if (path === 'execute') return AgentAPI.execute(body.taskId, { relaxOption: body.relaxOption });
  if (path === 'authorize') return AgentAPI.authorize(body.taskId, { relaxOption: body.relaxOption });
  return { error: '未知接口: ' + path };
}

function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';'); }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

// ============ 初始化 ============
async function init() {
  try {
    const h = await api('health');
    document.getElementById('serverStatus').textContent = '● 服务正常';
    loadMemory();
  } catch {
    document.getElementById('serverStatus').textContent = '● 连接失败';
  }
  await detectDbAndLoad();
}

// ============ 本地数据库探测与数据加载 ============
async function detectDbAndLoad() {
  const badge = document.getElementById('dbBadge');
  try {
    const health = await dbFetch('/api/health');
    if (health.status === 'ok') {
      dbOnline = true;
      badge.textContent = '● SQLite 已连接';
      badge.className = 'db-badge on';
      await refreshDbData(true);
      return;
    }
    throw new Error('health != ok');
  } catch {
    dbOnline = false;
    badge.textContent = '● 离线模式(内置数据)';
    badge.className = 'db-badge off';
    // 离线回退:使用 agent-core 内置数据渲染价格管理面板
    dbProducts = AgentAPI.getProducts();
    renderPriceManager();
  }
}

async function refreshDbData(silent) {
  if (!dbOnline) { if (!silent) alert('本地数据库未连接,请先启动: node server.js'); return; }
  try {
    const [prodRes, cpRes] = await Promise.all([
      dbFetch('/api/products'),
      dbFetch('/api/coupons')
    ]);
    dbProducts = prodRes.products || [];
    // 将数据库数据注入 agent-core,后续意图拆解/比价均使用最新价格
    AgentAPI.loadData(dbProducts, cpRes.coupons || []);
    renderPriceManager();
    if (!silent) flashDbBadge('已刷新');
  } catch (e) {
    if (!silent) alert('刷新失败: ' + e.message);
  }
}

function flashDbBadge(text) {
  const badge = document.getElementById('dbBadge');
  const orig = badge.textContent;
  badge.textContent = '✓ ' + text;
  setTimeout(() => { badge.textContent = orig; }, 1500);
}

function fillScene(text) {
  document.getElementById('intentInput').value = text;
  parseIntent();
}

// ============ 记忆面板 ============
async function loadMemory() {
  memoryData = await api('memory?userId=u-001');
  switchMemTab('facts', document.querySelector('.mem-tab'));
}

function switchMemTab(tab, btn) {
  document.querySelectorAll('.mem-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const el = document.getElementById('memContent');
  if (!memoryData) return;
  if (tab === 'facts') {
    const f = memoryData.facts;
    const rows = Object.entries(f).filter(([k]) => k !== 'userId').map(([k, v]) =>
      `<div class="fact-row"><span class="fact-key">${esc(k)}</span><span class="fact-val">${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</span></div>`
    ).join('');
    el.innerHTML = rows || '<p class="hint">暂无</p>';
  } else if (tab === 'prefs') {
    el.innerHTML = Object.entries(memoryData.preferences).map(([k, p]) => `
      <div class="pref-item">
        <div class="pref-label">${esc(k)} <span class="pref-value">${esc(p.value)}</span></div>
        <div class="conf-bar"><div class="conf-fill" style="width:${Math.round((p.confidence||0)*100)}%"></div></div>
        <div class="pref-evidence">置信度 ${Math.round((p.confidence||0)*100)}% · ${esc(p.evidence||'')}</div>
      </div>`).join('') || '<p class="hint">暂无</p>';
  } else {
    el.innerHTML = memoryData.episodes.map(ep => `
      <div class="episode-item">
        <div class="ep-date">${ep.timestamp} · ${ep.scene}</div>
        <div class="ep-intent">${esc(ep.intent)}</div>
        <div class="ep-choice">选择了：${esc(ep.finalChoice.product || ep.finalChoice.products?.[0]?.name || '-')}</div>
        <div class="ep-feedback ${ep.outcome.rating >= 4 ? 'good' : 'bad'}">${ep.outcome.rating ? '★'.repeat(ep.outcome.rating) : ''} ${esc(ep.outcome.feedback || '待反馈')}</div>
      </div>`).join('') || '<p class="hint">暂无经历</p>';
  }
}

// ============ 意图拆解 ============
async function parseIntent() {
  const text = document.getElementById('intentInput').value.trim();
  if (!text) return;
  const btn = document.getElementById('btnParse');
  btn.disabled = true; btn.textContent = '拆解中…';
  try {
    const data = await api('intent', { method: 'POST', body: { text, userId: 'u-001' } });
    currentTask = data;
    selectedRelax = null;
    renderIntent(data);
    renderGraph(data);
    renderInsights(data.episodeInsights || []);
    hide('execCard'); hide('bundleCard'); hide('actionCard');
    document.getElementById('traceBody').innerHTML = '<p class="hint">执行后展示</p>';
    // 自动执行
    setTimeout(() => executeTask(), 400);
  } finally {
    btn.disabled = false; btn.textContent = '拆解意图 →';
  }
}

function renderIntent(data) {
  const it = data.intent;
  const tiles = [
    ['场景', it.sceneLabel], ['预算', it.budget ? it.budget + ' 元' : '未指定'],
    ['时效', it.deadline ? `${it.deadline.label}（${it.deadline.date}）` : '无硬性时限'],
    ['品类', it.categories.join('、') || '-']
  ].map(([l, v]) => `<div class="intent-tile"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`).join('');
  const constraints = it.hardConstraints.map(c =>
    `<div class="note-item">${c.label}：${c.value}${c.unit || ''}${c.source === 'memory' ? '（来自记忆）' : ''}</div>`).join('');
  const notes = it.semanticNotes.map(n => `<div class="note-item">${esc(n)}</div>`).join('');
  document.getElementById('intentBody').innerHTML = `
    <div class="intent-grid">${tiles}</div>
    ${constraints ? `<div class="semantic-notes"><p class="hint">硬性约束：</p>${constraints}</div>` : ''}
    <div class="semantic-notes"><p class="hint">消费语义理解：</p>${notes}</div>`;
  show('intentCard');
}

function renderGraph(data) {
  const g = data.taskGraph;
  const typeLabel = { search: '检索', compare: '比价', timing: '时效', bundle: '组合', checkout: '下单' };
  // 按品类分组渲染 DAG 行
  const rows = [];
  const cats = g.categories;
  for (const cat of cats) {
    const chain = g.nodes.filter(n => n.category === cat).map(n =>
      `<span class="dag-node ${n.type}">${esc(cat)}·${typeLabel[n.type]}</span>`).join('<span class="dag-arrow">→</span>');
    rows.push(`<div class="dag-row">${chain}</div>`);
  }
  const bundleNode = g.nodes.find(n => n.type === 'bundle');
  const checkoutNode = g.nodes.find(n => n.type === 'checkout');
  rows.push(`<div class="dag-row"><span class="dag-node bundle">${bundleNode.label}</span><span class="dag-arrow">→</span><span class="dag-node checkout">${checkoutNode.label}</span></div>`);
  // 授权标签
  const b = data.boundary;
  const autoCount = Object.values(b.boundary).filter(v => v === 'auto').length;
  const authTags = `<span class="auth-tag auto">✓ 自主执行 ${autoCount} 步（检索/比价/核验/组合）</span><span class="auth-tag confirm">⚠ 需确认 1 步（支付下单）</span>`;
  // 预算分配
  let budgetHtml = '';
  if (g.budgetAllocation) {
    const entries = Object.entries(g.budgetAllocation);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    budgetHtml = `<div class="budget-alloc"><p class="hint">预算智能分配：</p><div class="budget-bar">${entries.map(([cat, val], i) =>
      `<div class="budget-seg" style="width:${(val/total*100)}%;background:${COLORS[i%COLORS.length]}" title="${cat} ${val}元">${cat} ${val}</div>`).join('')}</div></div>`;
  }
  document.getElementById('graphBody').innerHTML = rows.join('') + `<div class="auth-tags">${authTags}</div>` + budgetHtml +
    `<p class="hint" style="margin-top:10px">${esc(b.policy.auditNote)}</p>`;
  show('graphCard');
}

function renderInsights(insights) {
  const el = document.getElementById('insightBody');
  if (!insights || !insights.length) { el.innerHTML = '<p class="hint">该场景暂无相关历史经历洞察</p>'; return; }
  el.innerHTML = insights.map(i => `
    <div class="insight-item">
      <div class="insight-scenario">${esc(i.scenario)}（${i.date}）</div>
      <div class="insight-what">上次结果：${esc(i.whatHappened)}</div>
      <div class="insight-advice">${esc(i.actionableAdvice)}</div>
    </div>`).join('');
}

// ============ 执行 ============
async function executeTask(relaxOption) {
  if (!currentTask) return;
  const data = await api('execute', { method: 'POST', body: { taskId: currentTask.taskId, relaxOption } });
  renderExecution(data);
  renderBundle(data);
  renderTrace(data.toolTrace || []);
  renderAction(data);
}

function renderExecution(data) {
  const steps = (data.executionLog || []).map(s => `
    <div class="exec-step">
      <div class="step-num">${s.step}</div>
      <div class="step-info">
        <div class="step-title">${esc(s.action)} <span class="status-tag ${s.status}">${s.status === 'done' ? '完成' : '等待授权'}</span></div>
        <div class="step-detail">${esc(s.detail)}</div>
        <div class="step-meta">${esc(s.expert || '')} ${s.durationMs !== undefined ? '· ' + s.durationMs + 'ms' : ''}</div>
      </div>
    </div>`).join('');
  document.getElementById('execBody').innerHTML = steps;
  show('execCard');
}

function renderBundle(data) {
  const b = data.bundleResult;
  if (!b) return;
  const over = b.overBudget;
  const tiles = [
    ['total', b.totalPrice + ' 元', '组合总价'],
    ['saved', (b.totalSaved || 0) + ' 元', '累计节省'],
    over ? ['over', (b.totalPrice - b.budget) + ' 元', '超出预算'] : ['saved', (b.budgetUtilization || 0) + '%', '预算利用']
  ].map(([cls, num, lbl]) => `<div class="summary-tile ${cls}"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
  const picks = (b.picks || []).map((p, i) => `
    <div class="pick-item">
      <span class="pick-cat">${esc(p.category)}</span>
      <span class="pick-name">${esc(p.name)}</span>
      <span class="pick-plat">${esc(p.bestPlatform)}${p.platforms?.find(pl => pl.platform === p.bestPlatform)?.coupon ? ' · ' + p.platforms.find(pl => pl.platform === p.bestPlatform).coupon : ''}</span>
      <span class="pick-price">¥${p.bestPrice}</span>
    </div>`).join('');
  document.getElementById('bundleBody').innerHTML = `
    <div class="bundle-summary">${tiles}</div>
    <div class="pick-list">${picks}</div>
    <p class="hint" style="margin-top:10px">${esc(b.reasoning)}</p>`;
  show('bundleCard');
}

function renderTrace(traces) {
  if (!traces.length) return;
  document.getElementById('traceBody').innerHTML = traces.map(t => `
    <div class="trace-item">
      <span class="trace-tool">${esc(t.tool)}</span>
      <span class="trace-io">${esc(JSON.stringify(t.input))} → ${esc(t.output)}</span>
      <span class="trace-ms">${t.durationMs}ms</span>
    </div>`).join('');
}

// ============ 协商 & 授权 ============
function renderAction(data) {
  const el = document.getElementById('actionBody');
  show('actionCard');
  // 1. 约束松弛协商
  if (data.relaxation && !data.bundleResult?.appliedRelaxOption) {
    const opts = data.relaxation.options.map(o => `
      <div class="relax-opt" onclick="selectRelax('${o.id}', this)">
        <h4>${esc(o.title)}</h4>
        <p>${esc(o.detail)}</p>
        <div class="tradeoff">权衡：${esc(o.tradeoff)}</div>
      </div>`).join('');
    el.innerHTML = `
      <div class="relax-box">
        <h3>⚠ 约束松弛协商</h3>
        <div class="relax-msg">${esc(data.relaxation.message)}</div>
        <div class="relax-options">${opts}</div>
        <div style="margin-top:12px;text-align:center">
          <button class="btn success" onclick="applyRelax()">应用方案并继续 →</button>
        </div>
      </div>`;
    return;
  }
  // 2. 等待授权
  if (data.pendingAuthorization) {
    const b = data.bundleResult;
    el.innerHTML = `
      <div class="auth-box">
        <h3>🔐 支付授权确认</h3>
        <p>组合总价 <strong>¥${b?.totalPrice}</strong>${b?.budget ? `（预算 ¥${b.budget}）` : ''}，共 ${b?.picks?.length} 件商品。<br>授权后智能体将自主完成下单，所有动作可审计回溯。</p>
        <div class="auth-actions">
          <button class="btn success" onclick="authorize()">确认授权下单</button>
          <button class="btn ghost" onclick="alert('已取消，可修改意图后重新拆解')">暂不授权</button>
        </div>
      </div>`;
    return;
  }
  // 3. 已完成
  if (data.checkoutResult?.status === 'completed' && data.checkoutResult.order) {
    const o = data.checkoutResult.order;
    el.innerHTML = `
      <div class="order-box">
        <h3>✅ 委托完成 · 订单 ${esc(o.orderId)}</h3>
        ${o.items.map(i => `<div class="order-item"><span>${esc(i.category)}：${esc(i.product)}（${esc(i.platform)}）</span><span>¥${i.price}</span></div>`).join('')}
        <div class="order-item" style="font-weight:700;border-top:1px solid #bbf7d0;margin-top:6px;padding-top:8px"><span>合计</span><span>¥${o.totalAmount}</span></div>
        <p class="hint" style="margin-top:8px">${esc(o.note)}${data.recordedEpisode ? ' · 已写入经历记忆（消费事件图谱）' : ''}</p>
      </div>`;
    loadMemory();
    return;
  }
  hide('actionCard');
}

function selectRelax(id, el) {
  selectedRelax = id;
  document.querySelectorAll('.relax-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

async function applyRelax() {
  if (!selectedRelax) { alert('请先选择一个方案'); return; }
  await executeTask(selectedRelax);
}

async function authorize() {
  if (!currentTask) return;
  const data = await api('authorize', { method: 'POST', body: { taskId: currentTask.taskId, relaxOption: selectedRelax } });
  renderExecution(data);
  renderBundle(data);
  renderTrace(data.toolTrace || []);
  renderAction(data);
}

// ============ 价格管理面板(本地数据库) ============
function renderPriceManager() {
  const el = document.getElementById('priceBody');
  const filter = document.getElementById('priceCatFilter');
  // 品类筛选下拉(保留当前选中)
  const cats = [...new Set(dbProducts.map(p => p.category))];
  const curCat = filter.value;
  filter.innerHTML = '<option value="">全部品类</option>' +
    cats.map(c => `<option value="${esc(c)}"${c === curCat ? ' selected' : ''}>${esc(c)}</option>`).join('');

  let list = dbProducts;
  if (curCat) list = list.filter(p => p.category === curCat);
  if (!list.length) { el.innerHTML = '<p class="hint">暂无商品数据</p>'; return; }

  el.innerHTML = list.map(p => `
    <div class="price-row" id="prow-${esc(p.id)}">
      <div class="price-info">
        <span class="price-name" title="${esc(p.name)}">${esc(p.name)}</span>
        <span class="price-meta">${esc(p.category)} · 当前 ¥${p.price} · 史低 ¥${p.historicalLow ?? '-'}</span>
      </div>
      <div class="price-edit">
        <input type="number" class="price-input" id="pin-${esc(p.id)}" value="${p.price}" min="0" step="1" />
        <button class="btn primary sm" onclick="savePrice('${esc(p.id)}')">保存</button>
        <button class="btn ghost sm" onclick="toggleHistory('${esc(p.id)}')" title="价格变更历史">史</button>
      </div>
      <div class="price-history hidden" id="phist-${esc(p.id)}"></div>
    </div>`).join('');
}

async function savePrice(productId) {
  const input = document.getElementById('pin-' + productId);
  const newPrice = parseFloat(input.value);
  if (isNaN(newPrice) || newPrice < 0) { alert('请输入有效价格'); return; }

  if (dbOnline) {
    try {
      const res = await dbFetch('/api/products/' + productId, { method: 'PUT', body: { price: newPrice } });
      if (res.ok) {
        AgentAPI.updateProduct(productId, { price: newPrice });
        const p = dbProducts.find(x => x.id === productId);
        if (p) { p.price = newPrice; if (newPrice < (p.historicalLow ?? Infinity)) p.historicalLow = newPrice; p.updatedAt = res.product.updatedAt; }
        renderPriceManager();
        flashDbBadge('价格已保存');
      }
    } catch (e) { alert('保存失败: ' + e.message); }
  } else {
    // 离线模式:仅更新浏览器内存(刷新后失效)
    const res = AgentAPI.updateProduct(productId, { price: newPrice });
    if (res.ok) {
      const p = dbProducts.find(x => x.id === productId);
      if (p) { p.price = newPrice; p.historicalLow = res.product.historicalLow; }
      renderPriceManager();
      flashDbBadge('已更新(离线,刷新失效)');
    }
  }
}

async function toggleHistory(productId) {
  const histEl = document.getElementById('phist-' + productId);
  if (!histEl.classList.contains('hidden')) { histEl.classList.add('hidden'); return; }

  if (!dbOnline) {
    histEl.innerHTML = '<p class="hint">离线模式无法查看历史,请启动本地服务器(node server.js)</p>';
    histEl.classList.remove('hidden');
    return;
  }
  try {
    const res = await dbFetch('/api/price-history/' + productId);
    const h = res.history || [];
    histEl.innerHTML = h.length
      ? h.map(r => `<div class="hist-item"><span class="hist-time">${esc(r.changed_at)}</span><span class="hist-prices">¥${r.old_price ?? '-'} → ¥${r.new_price}</span><span class="hist-note">${esc(r.note || '')}</span></div>`).join('')
      : '<p class="hint">暂无价格变更记录</p>';
  } catch (e) {
    histEl.innerHTML = '<p class="hint">加载失败: ' + esc(e.message) + '</p>';
  }
  histEl.classList.remove('hidden');
}

async function resetDbData() {
  if (!dbOnline) { alert('离线模式,数据已为内置默认值'); return; }
  if (!confirm('确认将所有商品/优惠券重置为初始数据?价格历史将清空。')) return;
  try {
    await dbFetch('/api/reset', { method: 'POST' });
    await refreshDbData(true);
    flashDbBadge('已重置为初始数据');
  } catch (e) { alert('重置失败: ' + e.message); }
}

init();