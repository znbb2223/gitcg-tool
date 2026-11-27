// 把训练器导出的经验包合并进 packages/ai/src/data/experience-seed.ts
//
// 合并规则：同一牌/角色/牌组，取「对局数更大」的那份（同源续训，不是相加，
// 否则会重复计数）。牌组额外做贝叶斯平滑，避免 1 局的极端胜率被当真。
//
// 用法: node tools/merge-experience.mjs <bundle.json> [输出路径]

import fs from "node:fs";
import path from "node:path";
import { EXPERIENCE_SEED } from "../dist/index.js";

const input = process.argv[2];
if (!input) {
  throw new Error("用法: node tools/merge-experience.mjs <bundle.json>");
}
const outPath =
  process.argv[3] ?? path.join(import.meta.dirname, "../src/data/experience-seed.ts");

const bundle = JSON.parse(fs.readFileSync(input, "utf8")).learning;
if (!bundle?.cards || !bundle?.characters) {
  throw new Error("不是经验的训练包格式");
}

/** 逐条取对局数更大的那份 */
function mergeRecords(base, next) {
  const merged = { ...base };
  let added = 0;
  let updated = 0;
  for (const [key, record] of Object.entries(next)) {
    const current = merged[key];
    if (!current) {
      merged[key] = record;
      added += 1;
    } else if ((record.games ?? 0) > (current.games ?? 0)) {
      merged[key] = record;
      updated += 1;
    }
  }
  return { merged, added, updated };
}

const cards = mergeRecords(EXPERIENCE_SEED.cards, bundle.cards);
const characters = mergeRecords(EXPERIENCE_SEED.characters, bundle.characters);
const decks = mergeRecords(EXPERIENCE_SEED.decks, bundle.decks);

// 经验包里的 versions 计数可能为 0（训练器未累计版本维度），以顶层 games 为准
const seedGames = Object.values(EXPERIENCE_SEED.versions).reduce(
  (sum, item) => sum + (item.games ?? 0),
  0,
);
const games = Math.max(EXPERIENCE_SEED.games, seedGames, bundle.games);
const versions = {
  ...EXPERIENCE_SEED.versions,
  [bundle.gameVersion ?? EXPERIENCE_SEED.gameVersion]: {
    games,
    wins: Math.round(games * 0.5),
    draws: 0,
  },
};
const totalGames = games;

/** 平滑后的胜率：先验 50%，权重 10 局 */
const SMOOTH_PRIOR = 10;
const smoothedDecks = Object.fromEntries(
  Object.entries(decks.merged).map(([key, record]) => {
    const wins = record.wins ?? 0;
    const count = record.games ?? 0;
    return [
      key,
      {
        ...record,
        smoothedWinRate:
          Math.round(((wins + SMOOTH_PRIOR * 0.5) / (count + SMOOTH_PRIOR)) * 10000) / 10000,
      },
    ];
  }),
);

const payload = {
  kind: "gi-tcg-ai-learning",
  version: 1,
  gameVersion: bundle.gameVersion ?? EXPERIENCE_SEED.gameVersion,
  versions,
  games: totalGames,
  cards: cards.merged,
  characters: characters.merged,
  decks: smoothedDecks,
  updatedAt: Date.now(),
};

const source = `// 由 tools/merge-experience.mjs 生成，请勿手改
// 数据来源：内置种子 + 训练器经验包合并（${games.toLocaleString("en-US")} 局）
import type { LearningData } from "../learner";

export const EXPERIENCE_SEED: LearningData = ${JSON.stringify(payload)};
`;
fs.writeFileSync(outPath, source);

console.log(
  JSON.stringify({
    games: totalGames,
    cards: { total: Object.keys(payload.cards).length, added: cards.added, updated: cards.updated },
    characters: {
      total: Object.keys(payload.characters).length,
      added: characters.added,
      updated: characters.updated,
    },
    decks: { total: Object.keys(payload.decks).length, added: decks.added, updated: decks.updated },
    bytes: source.length,
  }),
);
