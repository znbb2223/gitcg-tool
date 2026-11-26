// 增量合并：今日新牌组 → 去重 → 自对弈（14 回合）→ 按作者说明+对局结果分析 → 写回牌组库
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi, styleOfDeck, validateDeck } from "../dist/index.js";

const TODAY = "/tmp/today-decks.json";
const STATE = "/root/workspace/art/decklib-state.json";
const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const CATALOG = "/tmp/deck-catalog.json";
const GAMES = Number(process.argv[2] ?? 6);

const library = JSON.parse(fs.readFileSync(LIB, "utf8"));
const catalog = fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, "utf8")) : [];
const raw = JSON.parse(fs.readFileSync(TODAY, "utf8"));
const data = getData(CURRENT_VERSION);
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();

const fingerprint = (chars, cards) =>
  `${[...chars].sort((a, b) => a - b).join(",")}|${[...cards].sort((a, b) => a - b).join(",")}`;

const knownByFp = new Map();
for (const deck of library.decks) {
  knownByFp.set(fingerprint(deck.chars, deck.cards), deck);
}
const knownCodes = new Set(library.decks.map((deck) => deck.code));

// 1) 解码 + 合法性 + 去重
const fresh = [];
for (const item of raw) {
  if (knownCodes.has(item.code)) continue;
  let deck;
  try {
    deck = DEFAULT_ASSETS_MANAGER.decode(item.code);
  } catch {
    continue;
  }
  if (!deck?.characters?.length || !validateDeck(deck, deckData).valid) continue;
  const fp = fingerprint(deck.characters, deck.cards);
  if (knownByFp.has(fp)) continue;
  fresh.push({ item, deck, fp });
  knownByFp.set(fp, { chars: deck.characters, cards: deck.cards });
}
console.log(`今日抓到 ${raw.length} 套，去重后新增 ${fresh.length} 套`);

// 即使没有新牌组，也要把「上次抓取时间」写进库里（页面要显示）
let scrapedAt = library.lastScrapedAt ?? 0;
try {
  scrapedAt = JSON.parse(fs.readFileSync(STATE, "utf8")).lastScrapedAt ?? scrapedAt;
} catch {
  // 没有断点就保留原值
}
library.lastScrapedAt = scrapedAt;
library.updatedAt = Date.now();
fs.writeFileSync(LIB, JSON.stringify(library));

if (fresh.length === 0) {
  console.log(`本次没有新牌组；上次抓取时间 ${new Date(scrapedAt * 1000).toLocaleString("zh-CN")}`);
  process.exit(0);
}

// 2) 自对弈：每套新牌和库里随机几套打 GAMES 局，最多 14 回合
const opponents = library.decks
  .filter((deck) => (deck.guideSource === "ai" ? true : deck.games >= 5))
  .slice(0, 200);

const NOUN_EFFECTS = [
  [/otk|斩杀|一击|秒/i, "OTK"],
  [/快攻|速攻|抢血/i, "快攻"],
  [/控制|防守|拖后|慢速/i, "控制"],
  [/召唤/, "召唤"],
  [/装备|圣遗物|武器/, "装备"],
  [/冻结|永冻/, "冻结"],
  [/超载/, "超载"],
  [/绽放|激化|超导|感电|扩散|蒸发|融化|结晶|燃烧/, "元素反应"],
  [/整活|娱乐/, "整活"],
  [/新手|入门|教学/, "新手"],
  [/上分|强度|轮椅/, "上分"],
  [/比赛|赛事|冠军/, "比赛"],
];

const round = (value, digits = 3) => Number(value.toFixed(digits));

for (const entry of fresh) {
  let win = 0;
  let lose = 0;
  let draw = 0;
  const myDeck = { characters: entry.deck.characters, cards: entry.deck.cards };
  for (let i = 0; i < GAMES; i++) {
    const opp = opponents[Math.floor(Math.random() * opponents.length)];
    if (!opp) break;
    const oppDeck = { characters: opp.chars, cards: opp.cards };
    const seed = 700000 + Math.floor(Math.random() * 1e6);
    let game;
    try {
      game = new Game(
        Game.createInitialState({
          decks: [myDeck, oppDeck],
          data,
          versionBehavior: CURRENT_VERSION,
          randomSeed: seed,
        }),
      );
      game.players[0].io = createAi({ who: 0, seed, delayMs: 0, style: styleOfDeck(myDeck), data });
      game.players[1].io = createAi({ who: 1, seed: seed + 1, delayMs: 0, style: styleOfDeck(oppDeck), data });
      const winner = await game.start();
      if (winner === 0) win++;
      else if (winner === 1) lose++;
      else draw++;
    } catch {
      // 单局出错不计
    }
  }
  entry.win = win;
  entry.lose = lose;
  entry.draw = draw;
  const total = win + lose + draw;
  entry.winRate = total > 0 ? round(win / total) : 0.5;
  console.log(
    `${entry.item.title.slice(0, 18)} → ${win}:${lose}:${draw}（${(entry.winRate * 100).toFixed(0)}%）`,
  );
}

// 3) 分析：标签 / 定位 / 五段说明（作者说明 + 对局结果）
function buildTags(entry) {
  const text = `${entry.item.title} ${entry.item.desc}`;
  const tags = new Set((entry.item.tags ?? []).slice(0, 4));
  for (const [pattern, tag] of NOUN_EFFECTS) {
    if (pattern.test(text.slice(0, 400))) tags.add(tag);
  }
  const avgCost = entry.deck.cards.length
    ? entry.deck.cards.reduce((sum, id) => sum + (data.entities.get(id)?.cost ?? 0), 0) /
      entry.deck.cards.length
    : 0;
  if (avgCost > 0 && avgCost <= 1.7) tags.add("低费");
  return [...tags].slice(0, 6);
}

function buildRole(entry) {
  const text = `${entry.item.title} ${entry.item.desc}`;
  const line = text.split(/[。\n]/).find((part) => /快攻|OTK|控制|运营|召唤|冻结|斩杀|上分/.test(part));
  return (line ?? entry.item.title).replace(/\s+/g, "").slice(0, 10) || "新构筑";
}

function buildGuide(entry) {
  const chars = entry.deck.characters
    .map((id) => data.characters.get(id)?.name ?? String(id))
    .join(" · ");
  const note = entry.item.desc.replace(/\s+/g, " ").trim();
  const head = note.slice(0, 70);
  const mid = note.slice(70, 150);
  const result = `自对弈 ${entry.win}:${entry.lose}${entry.draw ? `:${entry.draw}` : ""}`;
  return {
    open: head || `用 ${chars} 开局，先按费用曲线留低费与过牌。`,
    mid: mid || `中期围绕 ${chars} 的核心卡铺开，注意骰子规划。`,
    watch: `作者说明里点到的关键操作别漏；这套牌样本还少，先当参考。`,
    weak: `怕快攻抢血与能扫支援的卡组，注意保核心。`,
    verdict: `${result}，新收录牌组，实战数据会继续累积。`,
  };
}

// 4) 写回牌组库 + 目录
const now = Date.now();
for (const entry of fresh) {
  const tags = buildTags(entry);
  const deck = {
    id: `today-${entry.item.id}`,
    code: entry.item.code,
    chars: entry.deck.characters,
    cards: entry.deck.cards,
    tags,
    elements: [],
    nations: [],
    weapons: [],
    tier: entry.winRate >= 0.55 ? "S" : entry.winRate >= 0.5 ? "A" : entry.winRate >= 0.45 ? "B" : "C",
    style: styleOfDeck({ characters: entry.deck.characters, cards: entry.deck.cards }),
    source: "cardsquare-live",
    popularity: (entry.item.likes ?? 0) + 1,
    winRate: entry.winRate,
    rawWinRate: entry.winRate,
    games: entry.win + entry.lose + entry.draw,
    title: entry.item.title,
    likes: entry.item.likes ?? 0,
    views: entry.item.views ?? 0,
    author: entry.item.uid ? { uid: entry.item.uid, nickname: entry.item.nickname } : null,
    note: entry.item.desc,
    createdAt: entry.item.createdAt ?? 0,
    authorTags: tags,
    role: buildRole(entry),
    guide: buildGuide(entry),
    guideSource: "today",
    counters: [],
    counteredBy: [],
    addedAt: now,
  };
  library.decks.push(deck);
  catalog.push({
    id: deck.id,
    code: deck.code,
    characters: deck.chars,
    cards: deck.cards,
    source: "cardsquare-live",
    subject: deck.title,
    strategy: deck.note,
    tags: deck.tags,
    popularity: deck.popularity,
    author: deck.author,
    note: deck.note,
    createdAt: deck.createdAt,
    key: fingerprint(deck.chars, deck.cards),
    index: catalog.length,
  });
}

// 记录本次抓取时间，供牌组库页面展示
let lastScrapedAt = library.lastScrapedAt ?? 0;
try {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  lastScrapedAt = state.lastScrapedAt ?? lastScrapedAt;
} catch {
  // 没有断点就保留原值
}
library.lastScrapedAt = lastScrapedAt;
library.updatedAt = Date.now();
fs.writeFileSync(LIB, JSON.stringify(library));
fs.writeFileSync(CATALOG, JSON.stringify(catalog));

// 断点由抓取脚本写；这里只补一条「入库时间」，方便回溯
try {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  state.lastMergedAt = new Date().toISOString();
  state.lastMergedCount = fresh.length;
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
} catch {
  // 断点文件不存在时，抓取脚本下次会从 0 开始
}

console.log(`新增 ${fresh.length} 套已写入牌组库（共 ${library.decks.length} 套）`);
