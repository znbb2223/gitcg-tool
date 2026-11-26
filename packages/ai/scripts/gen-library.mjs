// 生成牌组库：官方"卡牌广场"（api-takumi cardsquare）+ 米游社帖子
import fs from "node:fs";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { validateDeck } from "../dist/index.js";

const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const seen = new Set();
const decks = [];

function push(entry) {
  if (!entry.code || seen.has(entry.code)) return;
  let deck;
  try {
    deck = DEFAULT_ASSETS_MANAGER.decode(entry.code);
  } catch {
    return;
  }
  if (!validateDeck(deck, deckData).valid) return;
  seen.add(entry.code);
  decks.push({
    id: entry.id,
    code: entry.code,
    characters: deck.characters,
    cards: deck.cards,
    source: entry.source,
    subject: (entry.subject ?? "").slice(0, 32),
    strategy: (entry.strategy ?? "").replace(/\s+/g, " ").slice(0, 60),
    tags: (entry.tags ?? []).slice(0, 4),
    popularity: entry.popularity ?? 0,
  });
}

// 1) 官方卡牌广场
try {
  const plaza = JSON.parse(fs.readFileSync("/tmp/plaza-decks-large.json", "utf8"));
  for (const item of plaza) {
    push({
      id: `cardsquare-${item.id}`,
      code: item.card_code,
      source: "cardsquare",
      subject: (item.title ?? "").slice(0, 40),
      strategy: (item.desc ?? "").slice(0, 90),
      tags: (item.tags ?? []).slice(0, 4),
      popularity: item.like_cnt ?? 0,
    });
  }
  console.log("广场牌组:", plaza.length);
} catch (e) {
  console.log("广场数据缺失:", e.message.slice(0, 60));
}

// 1.5) 广场其它分区（热斗/铸境/赛事等）
try {
  const extra = JSON.parse(fs.readFileSync("/tmp/plaza-extra.json", "utf8"));
  for (const item of extra) {
    push({
      id: `cardsquare-x-${item.id}`,
      code: item.card_code,
      source: "cardsquare-other",
      subject: (item.title ?? "").slice(0, 40),
      strategy: (item.desc ?? "").slice(0, 60),
      tags: (item.tags ?? []).slice(0, 4),
      popularity: item.like_cnt ?? 0,
    });
  }
  console.log("其它分区牌组:", extra.length);
} catch (e) {
  console.log("其它分区数据缺失:", e.message.slice(0, 40));
}

// 2) 米游社帖子
try {
  const posts = JSON.parse(fs.readFileSync("/tmp/deck-codes.json", "utf8"));
  const KEYWORDS = ["起手", "打法", "思路", "留牌", "节奏", "斩杀", "蓄爆"];
  for (const [code, meta] of Object.entries(posts)) {
    const text = (meta.text ?? "").replace(/\s+/g, " ");
    const strategy = text
      .split(/(?<=[。！？])/)
      .filter((line) => KEYWORDS.some((k) => line.includes(k)))
      .slice(0, 3)
      .join("")
      .slice(0, 240);
    push({
      id: `miyoushe-${meta.postId}-${code.slice(0, 6)}`,
      code,
      source: "miyoushe",
      subject: meta.subject ?? "",
      strategy,
      tags: [],
    });
  }
  console.log("米游社牌组:", Object.keys(posts).length);
} catch (e) {
  console.log("帖子数据缺失:", e.message.slice(0, 40));
}

// 体积控制：按热度保留前 MAX_DECKS 套
const MAX_DECKS = 1600;
decks.sort((a, b) => b.popularity - a.popularity);
if (decks.length > MAX_DECKS) {
  decks.length = MAX_DECKS;
}

const body = `// 由 scripts/gen-library.mjs 生成（官方卡牌广场 + 米游社公开帖）
// 牌组码可分享、可复现；strategy 是社区作者写的打法摘要
export interface LibraryDeck {
  id: string;
  code: string;
  characters: number[];
  cards: number[];
  source: string;
  subject: string;
  strategy: string;
  tags: string[];
  popularity: number;
}

export const DECK_LIBRARY: LibraryDeck[] = ${JSON.stringify(decks, null, 2)};
`;
fs.writeFileSync("src/data/deck-library.ts", body);
console.log("合法牌组入库:", decks.length);
const tagCount = new Map();
for (const d of decks) for (const t of d.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
console.log("热门标签:", [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}(${v})`).join(" "));
