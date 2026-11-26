// 用牌组库的 3.4 万局社区战绩，生成 AI 内置经验种子（experience-seed.ts）
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const OUT = "/root/workspace/gi-tcg/packages/ai/src/data/experience-seed.ts";
const VERSION = "7.2.0";
const MAX_DECKS = 900;

const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
const decks = lib.decks ?? [];

const fp = (chars, cards) =>
  `${[...chars].sort((a, b) => a - b).join(",")}|${[...cards].sort((a, b) => a - b).join(",")}`;

const cardAgg = new Map();
const charAgg = new Map();
const deckRecords = [];

for (const deck of decks) {
  const games = deck.games ?? 0;
  if (games <= 0) continue;
  const wins = Math.round((deck.winRate ?? 0.5) * games);
  const key = fp(deck.chars, deck.cards);
  deckRecords.push({
    key,
    characters: deck.chars,
    cards: deck.cards,
    games,
    wins,
    subject: (deck.title ?? "").slice(0, 40),
    tags: deck.tags ?? [],
    strategies: (deck.role ?? "").slice(0, 12),
    updatedAt: deck.createdAt ?? 0,
  });
  for (const id of deck.cards ?? []) {
    const entry = cardAgg.get(id) ?? { games: 0, wins: 0, draws: 0 };
    entry.games += games;
    entry.wins += wins;
    cardAgg.set(id, entry);
  }
  for (const id of deck.chars ?? []) {
    const entry = charAgg.get(id) ?? { games: 0, wins: 0, draws: 0 };
    entry.games += games;
    entry.wins += wins;
    charAgg.set(id, entry);
  }
}

deckRecords.sort((a, b) => b.games - a.games);
const kept = deckRecords.slice(0, MAX_DECKS);

const decksObj = {};
for (const deck of kept) {
  decksObj[deck.key] = {
    characters: deck.characters,
    cards: deck.cards,
    games: deck.games,
    wins: deck.wins,
    draws: 0,
    origin: "library",
    subject: deck.subject,
    tags: deck.tags,
    strategies: deck.strategies,
    updatedAt: deck.updatedAt,
  };
}

const totalGames = deckRecords.reduce((sum, deck) => sum + deck.games, 0);
const totalWins = deckRecords.reduce((sum, deck) => sum + deck.wins, 0);

const ts = `// 由 scripts/build-experience-seed.mjs 生成，请勿手改
// 数据来源：牌组库社区战绩 ${totalGames.toLocaleString("en-US")} 局（${deckRecords.length} 套牌组）
import type { LearningData } from "../learner";

export const EXPERIENCE_SEED: LearningData = {
  kind: "gi-tcg-ai-learning",
  version: 1,
  gameVersion: "${VERSION}",
  versions: { "${VERSION}": { games: ${totalGames}, wins: ${totalWins}, draws: 0 } },
  games: ${totalGames},
  cards: ${JSON.stringify(Object.fromEntries([...cardAgg.entries()].map(([id, v]) => [id, v])))},
  characters: ${JSON.stringify(Object.fromEntries([...charAgg.entries()].map(([id, v]) => [id, v])))},
  decks: ${JSON.stringify(decksObj)},
  updatedAt: ${Date.now()},
};
`;

fs.writeFileSync(OUT, ts);
console.log(
  `seed: ${totalGames} 局 / ${deckRecords.length} 套（写入 ${kept.length} 套） / ${cardAgg.size} 张牌 / ${charAgg.size} 个角色 → ${(ts.length / 1024).toFixed(0)}KB`,
);
