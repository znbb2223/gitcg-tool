// 牌组库大训练：牌组库自对弈，统计每套牌战绩与两两对战成绩
// 用法: node scripts/train-decklib.mjs <shardIndex> <shardCount> <gamesPerShard>
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, styleOfDeck } from "../dist/index.js";

const catalog = JSON.parse(fs.readFileSync(process.env.DECK_CATALOG ?? "/tmp/deck-catalog-train.json", "utf8"));
const shardIndex = Number(process.argv[2] ?? 0);
const shardCount = Number(process.argv[3] ?? 1);
const games = Number(process.argv[4] ?? 200);
const throttleMs = Number(process.env.TRAIN_THROTTLE_MS ?? 0);
const data = getData(CURRENT_VERSION);
const total = catalog.length;

const decks = new Map();
const pairs = new Map();
const chars = new Map();
const cards = new Map();
const bump = (map, key, win, draw) => {
  const entry = map.get(key) ?? { games: 0, wins: 0, draws: 0 };
  entry.games++;
  if (win) entry.wins++;
  if (draw) entry.draws++;
  map.set(key, entry);
};

let done = 0;
const shardFile = `/tmp/train-shards/shard-${shardIndex}.json`;
if (fs.existsSync(shardFile)) {
  try {
    const prev = JSON.parse(fs.readFileSync(shardFile, "utf8"));
    done = prev.games ?? 0;
    for (const [key, stat] of Object.entries(prev.decks ?? {})) decks.set(key, stat);
    for (const [key, stat] of Object.entries(prev.pairs ?? {})) pairs.set(key, stat);
    for (const [key, stat] of Object.entries(prev.chars ?? {})) chars.set(key, stat);
    for (const [key, stat] of Object.entries(prev.cards ?? {})) cards.set(key, stat);
    console.log(`[shard ${shardIndex}] 从快照续训：已完成 ${done} 局`);
  } catch {
    done = 0;
  }
}
const t0 = Date.now();
for (let local = done; local < games; local++) {
  const i = shardIndex + local * shardCount;
  const a = catalog[i % total];
  const bIndex = (i * 31 + 17) % total;
  const b = catalog[bIndex === i % total ? (i + 1) % total : bIndex];
  const deckA = { characters: a.characters, cards: a.cards };
  const deckB = { characters: b.characters, cards: b.cards };
  const game = new Game(
    Game.createInitialState({
      decks: [deckA, deckB],
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: 500000 + i * 7,
    }),
  );
  const seed = 500000 + i * 7;
  game.players[0].io = createAi({ who: 0, seed, delayMs: 0, style: styleOfDeck(deckA), data });
  game.players[1].io = createAi({ who: 1, seed: seed + 1, delayMs: 0, style: styleOfDeck(deckB), data });
  let winner = null;
  try {
    winner = await game.start();
  } catch (e) {
    console.log(`[shard ${shardIndex}] 第 ${i} 局出错跳过：${String(e?.message ?? e).slice(0, 60)}`);
    continue;
  }
  bump(decks, a.key, winner === 0, winner === null);
  bump(decks, b.key, winner === 1, winner === null);
  for (const id of a.characters) bump(chars, String(id), winner === 0, winner === null);
  for (const id of b.characters) bump(chars, String(id), winner === 1, winner === null);
  for (const id of new Set(a.cards)) bump(cards, String(id), winner === 0, winner === null);
  for (const id of new Set(b.cards)) bump(cards, String(id), winner === 1, winner === null);
  const pairKey = `${styleOfDeck(deckA)}>${styleOfDeck(deckB)}`;
  const pair = pairs.get(pairKey) ?? { games: 0, aWins: 0, draws: 0 };
  pair.games++;
  if (winner === 0) pair.aWins++;
  if (winner === null) pair.draws++;
  pairs.set(pairKey, pair);
  done++;
  if (done % 300 === 0) {
    fs.mkdirSync("/tmp/train-shards", { recursive: true });
    fs.writeFileSync(
      `/tmp/train-shards/shard-${shardIndex}.json`,
      JSON.stringify({
        shardIndex,
        games: done,
        decks: Object.fromEntries(decks),
        pairs: Object.fromEntries(pairs),
        chars: Object.fromEntries(chars),
        cards: Object.fromEntries(cards),
      }),
    );
  }
  if (throttleMs > 0) {
    await new Promise((r) => setTimeout(r, throttleMs));
  }
  if (done % 20 === 0) {
    const rate = done / ((Date.now() - t0) / 1000);
    console.log(`[shard ${shardIndex}] ${done}/${games} 局，${rate.toFixed(2)} 局/秒`);
  }
}

fs.mkdirSync("/tmp/train-shards", { recursive: true });
fs.writeFileSync(
  `/tmp/train-shards/shard-${shardIndex}.json`,
  JSON.stringify({
    shardIndex,
    games: done,
    decks: Object.fromEntries(decks),
    pairs: Object.fromEntries(pairs),
    chars: Object.fromEntries(chars),
    cards: Object.fromEntries(cards),
  }),
);
console.log(`[shard ${shardIndex}] 完成 ${done} 局，${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
