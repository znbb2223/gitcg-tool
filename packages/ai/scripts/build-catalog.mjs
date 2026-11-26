// 合并本地牌组库 + 米游社新抓的牌组，按牌组构成去重，输出目录 JSON
import fs from "node:fs";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { DECK_LIBRARY, validateDeck } from "../dist/index.js";

const KEYWORD_TAGS = ["赛事", "比赛", "竞技", "邀请赛", "冠军"];

// 卡牌广场最新抓取（无标签列表 + 各分区标签池）
// 广场主列表（含发布人/说明）+ 老牌组补抓详情
const plaza = [];
for (const file of [
  "/tmp/cardsquare-full.json",
  "/tmp/cardsquare-detail.json",
  "/tmp/cardsquare-raw-all.json",
]) {
  if (fs.existsSync(file)) {
    for (const item of JSON.parse(fs.readFileSync(file, "utf8"))) {
      plaza.push(item);
    }
  }
}
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
let plazaValid = 0;
const plazaDecks = [];
for (const item of plaza) {
  let deck;
  try {
    deck = DEFAULT_ASSETS_MANAGER.decode(item.code);
  } catch {
    continue;
  }
  if (!deck?.characters?.length || !validateDeck(deck, deckData).valid) {
    continue;
  }
  plazaValid++;
  const text = `${item.title ?? ""}${item.desc ?? ""}`;
  plazaDecks.push({
    id: `plaza-${item.id}`,
    code: item.code,
    characters: deck.characters,
    cards: deck.cards,
    source: "cardsquare-live",
    subject: item.title ?? "",
    strategy: item.desc ?? "",
    tags: KEYWORD_TAGS.filter((k) => text.includes(k)),
    popularity: (item.likes ?? 0) + 1,
    author: item.uid
      ? { uid: item.uid, nickname: item.nickname ?? "", avatar: item.avatar ?? "" }
      : null,
    note: item.desc ?? "",
    createdAt: item.createdAt ?? 0,
    views: item.views ?? 0,
  });
}
console.log(`卡牌广场新抓 ${plaza.length} 条，合法 ${plazaValid} 套`);
const miyoushe = fs.existsSync("/tmp/miyoushe-decks.json")
  ? JSON.parse(fs.readFileSync("/tmp/miyoushe-decks.json", "utf8"))
  : [];

const fingerprint = (d) =>
  `${[...d.characters].sort((a, b) => a - b).join(",")}|${[...d.cards].sort((a, b) => a - b).join(",")}`;

const seen = new Map();
const push = (entry) => {
  const key = fingerprint(entry);
  const old = seen.get(key);
  if (old) {
    old.sources.push(entry.source);
    old.popularity = Math.max(old.popularity, entry.popularity ?? 0);
    for (const tag of entry.tags ?? []) {
      if (!old.tags.includes(tag)) old.tags.push(tag);
    }
    if (!old.author && entry.author) {
      old.author = entry.author;
      old.createdAt = entry.createdAt ?? 0;
    }
    if ((entry.note ?? "").length > (old.note ?? "").length) {
      old.note = entry.note;
    }
    return;
  }
  seen.set(key, { ...entry, key, sources: [entry.source] });
};

for (const deck of DECK_LIBRARY) {
  push({
    id: deck.id,
    code: deck.code,
    characters: deck.characters,
    cards: deck.cards,
    source: deck.source,
    subject: deck.subject,
    strategy: deck.strategy,
    tags: [...deck.tags],
    popularity: deck.popularity ?? 0,
  });
}
for (const deck of plazaDecks) {
  push(deck);
}
const miyousheMeta = fs.existsSync("/tmp/miyoushe-meta.json")
  ? JSON.parse(fs.readFileSync("/tmp/miyoushe-meta.json", "utf8"))
  : {};
for (const deck of miyoushe) {
  const meta = miyousheMeta[deck.postId] ?? {};
  const subject = (meta.subject ?? deck.subject ?? "").trim();
  push({
    id: `miyoushe-${deck.postId}`,
    code: deck.code,
    characters: deck.characters,
    cards: deck.cards,
    source: "miyoushe",
    subject,
    strategy: meta.note ?? "",
    tags: KEYWORD_TAGS.filter((k) => subject.includes(k)),
    popularity: 1,
    author: meta.uid ? { uid: meta.uid, nickname: meta.nickname ?? "" } : null,
    note: meta.note ?? "",
    createdAt: deck.createdAt ?? 0,
    views: 0,
  });
}

// 要求每套牌都有标题、作者、说明，缺信息的直接不收
const decks = [];
const missingMeta = [];
for (const deck of seen.values()) {
  if ((deck.subject ?? "").trim() && (deck.note ?? "").trim() && deck.author?.uid) {
    decks.push({ ...deck, index: decks.length });
  } else {
    missingMeta.push((deck.subject || deck.id).slice(0, 24));
  }
}
fs.writeFileSync("/tmp/deck-catalog.json", JSON.stringify(decks));
const bySource = {};
for (const d of decks) for (const s of d.sources) bySource[s] = (bySource[s] ?? 0) + 1;
console.log(`合并去重后牌组 ${decks.length} 套（本地 ${DECK_LIBRARY.length} + 米游社 ${miyoushe.length}）`);
console.log("各来源:", JSON.stringify(bySource));
console.log("带赛事标签:", decks.filter((d) => d.tags.includes("赛事")).length);
console.log("带发布人:", decks.filter((d) => d.author?.uid).length, "带说明:", decks.filter((d) => (d.note ?? "").length > 0).length);
console.log("因缺标题/作者/说明被丢弃:", missingMeta.length, missingMeta.slice(0, 5));
