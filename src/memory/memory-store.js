/**
 * 支撑层 - 分层消费记忆体系
 *
 * 三层记忆设计（差异化竞争力核心）：
 * 1. 事实记忆（Fact）    : 尺码/地址/忌口/品牌黑名单等硬约束，结构化存储，高置信度直接调用
 * 2. 偏好记忆（Preference）: 风格/价格敏感度/品牌开放度/决策风格，渐进推断，带置信度标签
 * 3. 经历记忆（Episode）  : 消费事件图谱——每次消费的完整轨迹（需求→候选→选择→结果），
 *                          带时间戳与因果关系，使智能体能"接着上次的经验继续"
 */

// ============ 内存存储（Demo 用；生产可替换为 Redis/MySQL） ============
const stores = new Map();

// ============ 种子记忆：Demo 用户 u-001（三口之家） ============
const SEED_FACTS = {
  userId: 'u-001',
  family: '三口之家',
  childAge: 5,
  address: '杭州市西湖区',
  shoeSize: 42,
  allergies: ['花生'],
  brandBlacklist: ['某杂牌'],
  budgetHabit: { typical: 2000, max: 5000 },
  maxDriveHours: 2,
  cleanlinessPreference: 4.5,
  preferredPlatforms: ['京东', '携程', '美团']
};

const SEED_PREFERENCES = {
  priceSensitivity: { value: 'high', confidence: 0.85, evidence: '近5次消费中4次选择历史低价附近SKU' },
  styleTendency: { value: '实用优先', confidence: 0.7, evidence: '多次跳过高颜值溢价款' },
  brandOpenness: { value: '中', confidence: 0.6, evidence: '愿意尝试新品牌但需高评分背书' },
  decisionStyle: { value: '深度研究型', confidence: 0.75, evidence: '平均比价3.2个平台后才下单' },
  outdoorExperience: { value: '入门级', confidence: 0.8, evidence: '露营装备购买记录以入门款为主' }
};

// ============ 种子经历记忆：消费事件图谱 ============
// 每个事件是一条带时间戳与因果链的记录
const SEED_EPISODES = [
  {
    episodeId: 'ep-001',
    timestamp: '2026-05-12',
    scene: 'hiking',
    intent: '买一双周末徒步鞋',
    context: { weather: '初夏', trail: '杭州径山古道' },
    candidates: ['探路者徒步鞋', 'Salomon X Ultra 3', '迈乐 Moab 3'],
    finalChoice: { product: '迈乐 Moab 3', platform: '京东', price: 659 },
    outcome: {
      rating: 3,
      feedback: '湿地抓地力一般，雨后石板路有打滑',
      wouldRepurchase: false
    },
    causalLinks: [
      { cause: '选择 Vibram 大底但非湿地质', effect: '湿地打滑' }
    ],
    lessons: ['同品类后续选购需优先看湿地抓地力评分']
  },
  {
    episodeId: 'ep-002',
    timestamp: '2026-07-20',
    scene: 'family-trip',
    intent: '莫干山周末亲子游住宿',
    context: { childAge: 5, season: '夏季' },
    candidates: ['莫干山亲子度假酒店', '裸心谷', '安吉帐篷客'],
    finalChoice: { product: '莫干山亲子度假酒店', platform: '携程', price: 688 },
    outcome: {
      rating: 5,
      feedback: '儿童乐园很赞，孩子玩得不想走，卫生也很好',
      wouldRepurchase: true
    },
    causalLinks: [
      { cause: '酒店含室内儿童乐园', effect: '雨天也不无聊，体验超预期' }
    ],
    lessons: ['该酒店适合重复选择；亲子游住宿优先看儿童设施与卫生评分']
  },
  {
    episodeId: 'ep-003',
    timestamp: '2026-09-03',
    scene: 'camping',
    intent: '首次家庭露营装备尝试',
    context: { people: 3, season: '初秋' },
    candidates: ['牧高笛冷山2', '挪客云层2'],
    finalChoice: { product: '挪客 Cloud Up 2', platform: '天猫', price: 449 },
    outcome: {
      rating: 4,
      feedback: '搭建方便重量轻，但2人帐对三口之家略挤',
      wouldRepurchase: false
    },
    causalLinks: [
      { cause: '按2人容量选购', effect: '三口之家使用空间不足' }
    ],
    lessons: ['家庭露营需选3-4人容量帐篷，容量宁大勿小']
  }
];

// ============ MemoryStore 类 ============
class MemoryStore {
  constructor(userId) {
    if (!stores.has(userId)) {
      stores.set(userId, {
        facts: userId === 'u-001' ? { ...SEED_FACTS } : { userId },
        preferences: userId === 'u-001' ? JSON.parse(JSON.stringify(SEED_PREFERENCES)) : {},
        episodes: userId === 'u-001' ? JSON.parse(JSON.stringify(SEED_EPISODES)) : []
      });
    }
    this.userId = userId;
  }

  get data() { return stores.get(this.userId); }

  // ---- 事实记忆 ----
  getFacts() { return this.data.facts; }
  updateFact(key, value) {
    this.data.facts[key] = value;
    return this.data.facts;
  }

  // ---- 偏好记忆 ----
  getPreferences() { return this.data.preferences; }
  updatePreference(key, value, confidence, evidence) {
    this.data.preferences[key] = { value, confidence, evidence, updatedAt: new Date().toISOString() };
    return this.data.preferences;
  }

  // ---- 经历记忆（消费事件图谱） ----
  getEpisodes() { return this.data.episodes; }

  /**
   * 记录一次完整的消费事件
   */
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

  /**
   * 检索相关经历：按品类/场景/关键词匹配
   * 返回的不是"用户买过什么"，而是"在什么情境下做了什么选择，结果如何"
   */
  searchEpisodes(query = {}) {
    const { scene, category, keyword } = query;
    return this.data.episodes.filter(ep => {
      if (scene && ep.scene !== scene) return false;
      if (category && !JSON.stringify(ep).includes(category)) return false;
      if (keyword && !JSON.stringify(ep).includes(keyword)) return false;
      return true;
    });
  }

  /**
   * 生成经历洞察：将历史经历转化为可执行的消费建议
   * 例如："上次徒步鞋湿地打滑 → 这次优先看湿地抓地力"
   */
  getEpisodeInsights(query = {}) {
    const related = this.searchEpisodes(query);
    return related
      .filter(ep => ep.outcome && ep.outcome.rating !== undefined && ep.outcome.rating < 4)
      .map(ep => ({
        fromEpisode: ep.episodeId,
        date: ep.timestamp,
        scenario: ep.intent,
        whatHappened: ep.outcome.feedback,
        lesson: ep.lessons[0] || '该经历提示同类消费需注意历史反馈',
        actionableAdvice: generateAdvice(ep)
      }));
  }

  /**
   * 获取完整记忆上下文（供意图解析器使用）
   */
  getMemoryContext() {
    return {
      facts: this.data.facts,
      preferences: Object.fromEntries(
        Object.entries(this.data.preferences).map(([k, v]) => [k, v.value])
      ),
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

module.exports = { MemoryStore };