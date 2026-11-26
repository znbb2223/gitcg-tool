// 生成牌组库数据：合并训练战绩、流派、克制关系与玩法说明
import fs from "node:fs";
import { sanitizeNote } from "./clean-note-json.mjs";
import path from "node:path";

const STANDALONE = "/root/workspace/gi-tcg/packages/standalone";
const DATUM_DIR = path.join(STANDALONE, "public/assets-local/api/v5/datum/latest/CHS");
const catalog = JSON.parse(fs.readFileSync("/tmp/deck-catalog.json", "utf8"));
let gameDataRef = null;

// 卡牌类型/标签（来自 @gi-tcg/data，用来区分装备/事件/支援与治疗/护盾/过牌）
const catalogTypes = new Map();
const catalogTags = new Map();
{
  const { default: getData } = await import("@gi-tcg/data");
  const { CURRENT_VERSION } = await import("@gi-tcg/core");
  const gameData = getData(CURRENT_VERSION);
  gameDataRef = gameData;
  for (const id of new Set(catalog.flatMap((deck) => deck.cards))) {
    const definition = gameData.entities.get(id);
    if (!definition) {
      continue;
    }
    catalogTypes.set(String(id), definition.type ?? "unknown");
    catalogTags.set(String(id), (definition.tags ?? []).join(","));
  }
}

// 1) 训练结果（分片可能还没跑完，按现有数据算）
const shardDir = process.env.SHARD_DIR ?? "/tmp/train-shards";
const deckStats = new Map();
const charStats = new Map();
const cardStats = new Map();
const stylePairs = new Map();
let totalGames = 0;
if (fs.existsSync(shardDir)) {
  for (const file of fs.readdirSync(shardDir)) {
    const shard = JSON.parse(fs.readFileSync(path.join(shardDir, file), "utf8"));
    totalGames += shard.games ?? 0;
    for (const [key, stat] of Object.entries(shard.decks ?? {})) {
      const acc = deckStats.get(key) ?? { games: 0, wins: 0, draws: 0 };
      acc.games += stat.games;
      acc.wins += stat.wins;
      acc.draws += stat.draws;
      deckStats.set(key, acc);
    }
    for (const [key, stat] of Object.entries(shard.chars ?? {})) {
      const acc = charStats.get(key) ?? { games: 0, wins: 0, draws: 0 };
      acc.games += stat.games; acc.wins += stat.wins; acc.draws += stat.draws;
      charStats.set(key, acc);
    }
    for (const [key, stat] of Object.entries(shard.cards ?? {})) {
      const acc = cardStats.get(key) ?? { games: 0, wins: 0, draws: 0 };
      acc.games += stat.games; acc.wins += stat.wins; acc.draws += stat.draws;
      cardStats.set(key, acc);
    }
    for (const [key, stat] of Object.entries(shard.pairs ?? {})) {
      const acc = stylePairs.get(key) ?? { games: 0, aWins: 0, draws: 0 };
      acc.games += stat.games;
      acc.aWins += stat.aWins;
      acc.draws += stat.draws;
      stylePairs.set(key, acc);
    }
  }
}

// 2) 中文名
const nameCache = new Map();
const costCache = new Map();
const costOf = (id) => {
  if (costCache.has(id)) return costCache.get(id);
  let total = 0;
  try {
    const datum = JSON.parse(fs.readFileSync(path.join(DATUM_DIR, `${id}.json`), "utf8"));
    total = (datum.playCost ?? []).reduce((sum, item) => sum + (item.count ?? 0), 0);
  } catch {
    // 缺数据按 0 费算
  }
  costCache.set(id, total);
  return total;
};

const nameOf = (id) => {
  if (nameCache.has(id)) {
    return nameCache.get(id);
  }
  let name = String(id);
  try {
    const datum = JSON.parse(fs.readFileSync(path.join(DATUM_DIR, `${id}.json`), "utf8"));
    name = datum.name ?? name;
  } catch {
    // 缺数据时退回 id
  }
  nameCache.set(id, name);
  return name;
};

// 3) 流派分类
const STYLE_NAME = { aggro: "快攻", midrange: "中速", control: "控制", combo: "组合技" };
/**
 * 流派判定（宁可判中速，也不乱贴「控制」）：
 * - 快攻：费用曲线够低（或作者自称快攻且不算贵）
 * - 控制：作者自己说是控制/运营，或者护盾+回复/大量事件牌两种防守信号，且不是快攻曲线
 * - 组合技：作者提到 OTK/斩杀，或者过牌 + 多张高费核心
 */
const styleOf = (deck) => {
  const text = [deck.subject, deck.strategy, deck.note, ...(deck.tags ?? [])].join(" ");
  const feat = deckFeatures(deck);

  const cheapAggro = feat.avgCost <= 1.7 && feat.heavy.length <= 3;
  if (/(otk|斩杀|组合技|一波带走)/i.test(text) && !cheapAggro) {
    return "combo";
  }
  if (cheapAggro || (/(快攻|速攻|抢血|铺场)/i.test(text) && feat.avgCost <= 2)) {
    return "aggro";
  }
  const wantsControl = /(控制|防守|苟|慢速|运营)/.test(text);
  const defenseSignals =
    Number(feat.hasShield) + Number(feat.hasHeal) + Number(feat.events >= 5);
  if (wantsControl || (defenseSignals >= 2 && feat.avgCost >= 1.75)) {
    return "control";
  }
  if (feat.hasDraw && feat.heavy.length >= 6) {
    return "combo";
  }
  return "midrange";
};

// 4) 流派对阵表：快攻吃中速、中速吃控制、控制吃快攻、组合技吃慢速
const styleWinRate = (aStyle, bStyle) => {
  const stat = stylePairs.get(`${aStyle}>${bStyle}`);
  if (!stat || stat.games < 20) {
    return null;
  }
  return stat.aWins / stat.games;
};


const elementOfCard = (id) =>
  ({ 1: "冰", 2: "水", 3: "火", 4: "雷", 5: "风", 6: "岩", 7: "草" }[Math.floor(id / 100) % 10] ?? "");


const NATION_LABEL = {
  mondstadt: "蒙德", liyue: "璃月", inazuma: "稻妻", sumeru: "须弥", fontaine: "枫丹",
  natlan: "纳塔", snezhnaya: "至冬", fatui: "愚人众", khaenriah: "坎瑞亚",
  nodkrai: "挪德卡莱", eremite: "镀金旅团", monster: "魔物", hilichurl: "丘丘人",
};
const WEAPON_LABEL = { sword: "单手剑", claymore: "双手剑", pole: "长柄武器", bow: "弓", catalyst: "法器" };

const charTags = (id) => gameDataRef?.characters?.get?.(id)?.tags ?? [];

const nationOfChar = (id) =>
  charTags(id).map((tag) => NATION_LABEL[tag]).find(Boolean) ?? "";
const weaponOfChar = (id) =>
  charTags(id).map((tag) => WEAPON_LABEL[tag]).find(Boolean) ?? "";
/** 从牌库构成提取特征（供标签/说明共用） */
function deckFeatures(deck) {
  const info = deck.cards.map((id) => ({
    id,
    cost: costOf(id),
    type: catalogTypes.get(String(id)) ?? "unknown",
    tags: catalogTags.get(String(id)) ?? "",
  }));
  return {
    heavy: info.filter((card) => card.cost >= 3),
    equipment: info.filter((card) => card.type === "equipment"),
    supports: info.filter((card) => card.type === "support"),
    avgCost: deck.cards.reduce((sum, id) => sum + costOf(id), 0) / Math.max(deck.cards.length, 1),
    hasHeal: info.some((card) => /heal|治疗|回血/.test(card.tags)),
    hasShield: info.some((card) => /shield|护盾/.test(card.tags)),
    hasDraw: info.some((card) => /draw|过牌|抽牌/.test(card.tags)),
    events: info.filter((card) => card.type === "GCG_CARD_EVENT").length,
  };
}

const STYLE_TAG = { aggro: "快攻", midrange: "中速", control: "控制", combo: "组合技" };

const NOTE_TAGS = [
  [/otk|斩杀|一击|秒杀/i, "OTK"],
  [/召唤/, "召唤"],
  [/速切/, "速切"],
  [/整活|娱乐/, "整活"],
  [/新手|入门|教学/, "新手"],
  [/比赛|赛事|冠军|邀请赛/, "比赛"],
  [/冻结|永冻/, "冻结"],
  [/超载/, "超载"],
  [/绽放|激化|超导|感电|扩散|蒸发|融化|结晶|燃烧/, "元素反应"],
  [/上分|强度|轮椅/, "上分"],
];

/** 标签 = 原广场标签 + 构成推出来的玩法 + 作者说明里的关键词 */
function buildDeckTags(deck, feat, style) {
  const tags = new Set((deck.tags ?? []).filter(Boolean).slice(0, 5));
  if (feat.equipment.length >= 10) {
    tags.add("装备流");
  }
  if (feat.supports.length >= 10) {
    tags.add("支援流");
  }
  if (feat.heavy.length >= 9) {
    tags.add("重费");
  }
  if (feat.avgCost <= 1.25) {
    tags.add("低费");
  }
  if (feat.hasDraw) {
    tags.add("过牌");
  }
  if (feat.hasHeal) {
    tags.add("回复");
  }
  if (feat.hasShield) {
    tags.add("护盾");
  }
  if (STYLE_TAG[style]) {
    tags.add(STYLE_TAG[style]);
  }
  const text = `${deck.subject ?? ""} ${deck.note ?? ""}`;
  for (const [pattern, tag] of NOTE_TAGS) {
    if (pattern.test(text)) {
      tags.add(tag);
    }
  }
  return [...tags].slice(0, 8);
}

/** 梯度：按收缩后的胜率分档（样本量单独展示，不参与判定） */
function tierOf(winRate) {
  if (winRate >= 0.55) {
    return "S";
  }
  if (winRate >= 0.5) {
    return "A";
  }
  if (winRate >= 0.45) {
    return "B";
  }
  return "C";
}

const decks = catalog.map((deck) => {
  const style = styleOf(deck);
  const feat = deckFeatures(deck);
  const stat = deckStats.get(deck.key) ?? { games: 0, wins: 0, draws: 0 };
  const rawGames = Math.max(stat.games - stat.draws, 0);
  const rawWinRate = rawGames > 0 ? stat.wins / rawGames : null;
  const rateOf = (map, id) => {
    const item = map.get(String(id));
    const n = item ? item.games - item.draws : 0;
    return item && n > 0 ? item.wins / n : null;
  };
  const charRates = deck.characters.map((id) => rateOf(charStats, id)).filter((r) => r !== null);
  const cardRates = deck.cards.map((id) => rateOf(cardStats, id)).filter((r) => r !== null);
  const mean = (list, fallback) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : fallback);
  // 少样本时向"这套牌的角色/卡牌整体胜率"收缩，避免 21 局噪声带偏排序
  const prior = 0.7 * mean(charRates, 0.5) + 0.3 * mean(cardRates, 0.5);
  const K = 15;
  const winRate = (stat.wins + K * prior) / (rawGames + K);
  const tier = tierOf(winRate);
  return {
    id: deck.id,
    key: deck.key,
    code: deck.code,
    chars: deck.characters,
    cards: deck.cards,
    tags: buildDeckTags(deck, feat, style),
    elements: [...new Set(deck.characters.map(elementOfCard).filter(Boolean))],
    nations: [...new Set(deck.characters.map(nationOfChar).filter(Boolean))],
    weapons: [...new Set(deck.characters.map(weaponOfChar).filter(Boolean))],
    tier,
    style,
    source: (deck.sources ?? []).includes("cardsquare-other")
      ? "special"
      : (deck.sources?.[0] ?? deck.source),
    popularity: deck.popularity ?? 0,
    winRate,
    rawWinRate,
    games: stat.games,
    subject: (deck.subject ?? "").slice(0, 40),
    title: (deck.subject ?? "").slice(0, 80),
    likes: deck.likes ?? 0,
    views: deck.views ?? 0,
    author: deck.author
      ? {
          uid: deck.author.uid,
          nickname: (deck.author.nickname ?? "").slice(0, 24),
        }
      : null,
    note: sanitizeNote(deck.note ?? "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 1500),
    createdAt: deck.createdAt ?? 0,
  };
});

// 5) 克制关系：按流派胜率挑对手流派里的强牌
const byStyle = new Map();
for (const deck of decks) {
  if (!byStyle.has(deck.style)) {
    byStyle.set(deck.style, []);
  }
  byStyle.get(deck.style).push(deck);
}
for (const list of byStyle.values()) {
  list.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.games - a.games);
}
const styles = [...byStyle.keys()];
const styleLabel = (deck) => deck.chars.map(nameOf).join(" · ");

for (const deck of decks) {
  const beats = [];
  const losesTo = [];
  for (const other of styles) {
    if (other === deck.style) {
      continue;
    }
    const pairStyle = deck.style === "combo" ? "midrange" : deck.style;
    const win = styleWinRate(pairStyle, other);
    if (win === null) {
      continue;
    }
    const candidates = (byStyle.get(other) ?? []).filter((d) => d.key !== deck.key).slice(0, 1);
    for (const candidate of candidates) {
      if (win >= 0.55) {
        beats.push({ id: candidate.id, label: styleLabel(candidate), winRate: win, style: other });
      } else if (win <= 0.45) {
        losesTo.push({ id: candidate.id, label: styleLabel(candidate), winRate: 1 - win, style: other });
      }
    }
  }
  deck.counters = beats.slice(0, 3);
  deck.counteredBy = losesTo.slice(0, 3);
}

// 6) 玩法说明：按流派给骨架，再塞入这套牌的角色/标签/胜率
// 卡牌类型/标签查表（用于生成贴合牌型的说明）
const typeOf = (id) => {
  try {
    return catalogTypes.get(String(id)) ?? "unknown";
  } catch {
    return "unknown";
  }
};
const tagsOf = (id) => catalogTags.get(String(id)) ?? "";

const ELEMENT_OF = (id) => {
  const prefix = Math.floor(id / 100) % 10;
  return { 1: "冰", 2: "水", 3: "火", 4: "雷", 5: "风", 6: "岩", 7: "草" }[prefix] ?? "";
};

const hashOf = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

// 玩法说明：按牌型特征拼句子，同套牌稳定、不同套牌换说法，读起来不像模板
const buildGuide = (deck) => {
  const char = deck.chars.map(nameOf);
  const counts = new Map();
  for (const id of deck.cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  const info = [...counts.entries()].map(([id, count]) => ({
    id,
    count,
    cost: costOf(id),
    name: nameOf(id),
    type: typeOf(id),
    tags: tagsOf(id),
  }));
  const cheap = [...info].filter((c) => c.cost <= 1).sort((a, b) => b.count - a.count || a.cost - b.cost);
  const heavy = info.filter((c) => c.cost >= 3);
  const dup = [...info].filter((c) => c.count >= 2).sort((a, b) => b.cost - a.cost);
  const equipment = info.filter((c) => c.type === "equipment");
  const supports = info.filter((c) => c.type === "support");
  const events = info.filter((c) => c.type === "eventCard");
  const avgCost = deck.cards.reduce((sum, id) => sum + costOf(id), 0) / Math.max(deck.cards.length, 1);
  const hasHeal = info.some((c) => /heal|治疗|回血/.test(c.tags));
  const hasShield = info.some((c) => /shield|护盾/.test(c.tags));
  const hasDraw = info.some((c) => /draw|过牌|抽牌/.test(c.tags));
  const elements = [...new Set(deck.chars.map(ELEMENT_OF).filter(Boolean))];
  const bare = (name) => (name ?? "").replace(/^[「」]+|[「」]+$/g, "");
  const anchor = bare(dup[0]?.name ?? cheap[0]?.name ?? info[0]?.name ?? "关键牌");
  const second = bare(dup[1]?.name ?? cheap[1]?.name ?? supports[0]?.name ?? equipment[0]?.name ?? "");
  const cheapName = bare(cheap[0]?.name ?? dup[0]?.name ?? "低费牌");
  const cheapName2 = bare(cheap[1]?.name ?? dup[0]?.name ?? "");
  const elementText = elements.length ? elements.join("/") : "元素";

  const seed = hashOf(String(deck.key ?? deck.id ?? deck.code ?? anchor));
  const variants = (list, offset) => list[(seed >> (offset * 4)) % list.length];

  // 开局：先说留什么、再说先手后手的差别
  const openLean =
    deck.style === "control"
      ? "开局以稳为主，别急着下怪"
      : deck.style === "aggro"
        ? "开局就要压，别想着留后手"
        : deck.style === "combo"
          ? "开局只找组件，前两回合本来就不指望打顺"
          : "开局先把低费展开铺出来，再考虑换血";
  const openTail =
    heavy.length >= 7
      ? `这套 3 费以上有 ${heavy.length} 张，起手把大牌全换掉`
      : avgCost <= 1.8
        ? "曲线很薄，手牌留得越干净越顺"
        : "3 费以上的牌起手先换，留骰子比留组件实在";
  const openCandidates = [
    `${openLean}。起手留「${cheapName}」${cheapName2 ? `和「${cheapName2}」` : ""}，${openTail}。`,
    `${openLean}，起手优先保「${cheapName}」${cheapName2 ? `「${cheapName2}」` : ""}和对应元素骰；${openTail}。`,
    `这套牌的起手只看两件事——「${cheapName}」在不在、骰子够不够。${openTail}。`,
    `先手可以把牌换薄去抢「${cheapName}」，后手就多留一张过牌；${openTail}。`,
  ];

  // 中期：成名牌 + 元素方向 + 装备/支援门槛
  const midGear =
    equipment.length >= 6
      ? `，装备铺满 ${equipment.length} 张才算完整形态`
      : supports.length >= 5
        ? `，支援位 ${supports.length} 张，场面全靠它们撑`
        : "";
  const midCandidates = [
    `中期把「${anchor}」${second ? `和「${second}」` : ""}铺开，围绕${elementText}反应打交换${midGear}。`,
    `进入中期后节奏交给「${anchor}」，靠${elementText}反应一点点把血线压过去${midGear}。`,
    `这套牌的中期靠「${anchor}」滚雪球，${elementText}反应的先后顺序很关键${midGear}。`,
    `中期别急着 all in，先用「${anchor}」稳住场面，等${second ? `「${second}」` : "关键牌"}到位再一波推${midGear}。`,
  ];

  // 注意：从构成推出来的具体隐患
  const watchRisks = [];
  if (!hasHeal) watchRisks.push("没有回复牌（血线掉了回不来）");
  if (!hasShield) watchRisks.push("穿透和后台伤害会绕前排");
  if (!hasDraw) watchRisks.push("没有过牌（手牌打空就断档）");
  if (heavy.length >= 8) watchRisks.push(`3 费以上的牌有 ${heavy.length} 张（卡手会很难受）`);
  if (events.length <= 2) watchRisks.push("事件牌偏少（解场手段有限）");
  if (!watchRisks.length) watchRisks.push("资源一旦打散就很难打回来");
  const riskOrder = (seed >> 7) % watchRisks.length;
  const r1 = watchRisks[riskOrder];
  const r2 = watchRisks[(riskOrder + 1) % watchRisks.length] ?? r1;
  const watchCandidates = [
    `打的时候盯紧两点：${r1}；${r2}。`,
    `这套牌容错不高——${r1}，而且${r2}。`,
    `最容易被忽略的是${r1}，其次${r2}。`,
    `真正要防的是${r1}，${r2}同样别大意。`,
  ];

  // 弱点：从构成推天敌，再补一句结构短板
  const weakByFeature = [];
  if (!hasHeal) weakByFeature.push("快攻抢血");
  if (heavy.length >= 7) weakByFeature.push("快攻的连续压血");
  if (!hasDraw) weakByFeature.push("中速的消耗战");
  if (supports.length >= 5) weakByFeature.push("能扫支援的卡组");
  if (equipment.length >= 6) weakByFeature.push("拆装备/弃牌干扰");
  if (deck.style === "combo") weakByFeature.push("控制打断组件");
  const weakList = [...new Set(weakByFeature)].filter(
    (item) => !(deck.style === "aggro" && item.startsWith("快攻")),
  );
  const weakCore = weakList.length ? weakList.slice(0, 2).join("和") : "没有明显天敌";
  const structural =
    deck.style === "control"
      ? "反击慢，被抢血很难找回节奏"
      : deck.style === "aggro"
        ? "手牌打空之后没有续航"
        : deck.style === "combo"
          ? "组件被打断就得重来"
          : `节奏过度依赖「${anchor}」`;
  const weakCandidates = [
    `最怕${weakCore}，${structural}。`,
    `天敌多半是${weakCore}——${structural}。`,
    `怕${weakCore}；${structural}。`,
    `碰上${weakCore}会很难受，${structural}。`,
  ];

  // 自我评价：样本够才报胜负，不够只给梯队
  const rate = deck.rawWinRate;
  const tier = deck.games < 20 || rate === null
    ? "样本还不够，先当梯队参考"
    : rate >= 0.55
      ? "强度很不错"
      : rate >= 0.5
        ? "中上水平"
        : rate >= 0.45
          ? "中规中矩"
          : "偏弱，需要操作弥补";
  const sample = deck.games > 0 ? `（${deck.games} 局）` : "（暂无对局）";
  const closing =
    deck.style === "aggro"
      ? "上限高但容错低，输多半是一波换血换亏"
      : deck.style === "control"
        ? "越拖越强，前期要忍得住"
        : deck.style === "combo"
          ? "顺起来很强，断件立刻崩"
          : "赢法和输法都比较固定，看谁先犯错";
  const verdictCandidates = [
    `自我评价：${tier}${sample}，${closing}。`,
    `一句话总结：${tier}${sample}，${closing}。`,
    `${tier}${sample}——${closing}。`,
    `${tier}${sample}。${closing}。`,
  ];

  const guide = {
    open: variants(openCandidates, 0),
    mid: variants(midCandidates, 1),
    watch: variants(watchCandidates, 2),
    weak: variants(weakCandidates, 3),
    verdict: variants(verdictCandidates, 4),
  };
  return guide;
};
for (const deck of decks) {
  deck.guide = buildGuide(deck);
}

// 7) 名字表（只保留用到的）
const characters = {};
const cards = {};
for (const deck of decks) {
  for (const id of deck.chars) characters[id] = nameOf(id);
  for (const id of deck.cards) cards[id] = nameOf(id);
}

const characterHp = {};
const cardCosts = {};
for (const deck of decks) {
  for (const id of deck.chars) {
    if (characterHp[id] === undefined) {
      try {
        const datum = JSON.parse(fs.readFileSync(path.join(DATUM_DIR, `${id}.json`), "utf8"));
        characterHp[id] = datum.hp ?? 10;
      } catch {
        characterHp[id] = 10;
      }
    }
  }
}
for (const deck of decks) {
  for (const id of deck.cards) {
    if (cardCosts[id] === undefined) {
      try {
        const datum = JSON.parse(fs.readFileSync(path.join(DATUM_DIR, `${id}.json`), "utf8"));
        const cost = datum.playCost ?? [];
        const dice = cost.filter((item) => item.type !== "GCG_COST_ENERGY");
        const total = dice.reduce((sum, item) => sum + (item.count ?? 0), 0);
        const energy = cost.filter((item) => item.type === "GCG_COST_ENERGY").reduce((sum, item) => sum + (item.count ?? 0), 0);
        const primary = dice.find((item) => item.type && item.type !== "GCG_COST_DICE_VOID") ?? dice[0];
        cardCosts[id] = { total, type: primary?.type ?? "", energy };
      } catch {
        cardCosts[id] = 0;
      }
    }
  }
}

const output = {
  version: "7.2.0",
  totalGames,
  generatedAt: Date.now(),
  characters,
  cards,
  characterHp,
  cardCosts,
  decks: decks.map(({ key, subject, ...rest }) => rest),
};
const outPath = process.argv[2] ?? path.join(STANDALONE, "public/data/deck-library.json");
fs.writeFileSync(outPath, JSON.stringify(output));
console.log(
  `牌组 ${decks.length} 套，训练 ${totalGames} 局，流派对阵 ${stylePairs.size} 组，角色 ${Object.keys(characters).length}，卡牌 ${Object.keys(cards).length}`,
);
const json = fs.readFileSync(outPath);
console.log(`输出 ${(json.length / 1024).toFixed(0)} KB，含战绩牌组 ${decks.filter((d) => d.games > 0).length} 套`);
