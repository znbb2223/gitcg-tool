// 局面价值 A/B：同一套搜索，只换截断推演用的价值函数。
// 用法: node packages/ai/scripts/ab-value.mjs [games] [budgetMs] [maxActions]
// 例:   node packages/ai/scripts/ab-value.mjs 60 120 40
//
// 双方交替先手，牌组从牌组库里随机取；输出两个配置各自的胜场数。

import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const nnArg = process.argv.find((value) => value.startsWith("--nn="));
const nnWeights = nnArg ? (await import("node:fs")).readFileSync(nnArg.slice(5), "utf8") : null;
const positional = process.argv.slice(2).filter((value) => !value.startsWith("--"));
const games = Number(positional[0] ?? 40);
const budgetMs = Number(positional[1] ?? 120);
const maxActions = Number(positional[2] ?? 40);

const data = getData(CURRENT_VERSION);
const library = JSON.parse(fs.readFileSync(LIB, "utf8")).decks ?? [];
const usable = library.filter((deck) => deck.chars?.length === 3 && deck.cards?.length >= 28);
if (usable.length < 2) {
  throw new Error("牌组库不可用");
}

const makeSearchAi = (who, seed, deck, mode) =>
  createAi({
    who,
    seed,
    delayMs: 0,
    style: styleOfDeck(deck),
    data,
    selectAction: async (request, context) => {
      const result = await searchBestAction(request, {
        who,
        data,
        state: context.state ?? gameRef.state,
        budgetMs,
        maxActions,
        rng: mulberry32(seed + Date.now() % 1000),
        valueOptions:
          mode === "v2"
            ? { mode, ...(nnWeights ? { nn: JSON.parse(nnWeights), nnWeight: 0.4 } : {}) }
            : { mode },
      });
      calls[mode] += 1;
      const bucket = rollouts[mode];
      for (const candidate of result.candidates ?? []) {
        bucket.total += candidate.rollouts;
        bucket.cut += candidate.draws;
        bucket.win += candidate.wins;
      }
      return {
        chosenActionIndex: result.chosenActionIndex,
        usedDice: result.usedDice,
      };
    },
  });

let gameRef = null;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stats = { v2Win: 0, v1Win: 0, draw: 0, error: 0 };
const rollouts = { v2: { total: 0, cut: 0, win: 0 }, v1: { total: 0, cut: 0, win: 0 } };
const calls = { v1: 0, v2: 0 };

for (let i = 0; i < games; i += 1) {
  const deckA = usable[(i * 37) % usable.length];
  const deckB = usable[(i * 37 + 211) % usable.length];
  // 偶数局 v2 先手，奇数局交换座位，抵消先手优势
  const v2Seat = i % 2 === 0 ? 0 : 1;
  const decks = [
    { characters: deckA.chars, cards: deckA.cards },
    { characters: deckB.chars, cards: deckB.cards },
  ];
  const game = new Game(
    Game.createInitialState({
      decks,
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: 70000 + i * 97,
    }),
  );
  gameRef = game;
  for (const seat of [0, 1]) {
    const mode = seat === v2Seat ? "v2" : "v1";
    game.players[seat].io = makeSearchAi(seat, 70000 + i * 97 + seat, decks[seat], mode);
  }
  try {
    const winner = await game.start();
    if (winner === null) {
      stats.draw += 1;
    } else if (winner === v2Seat) {
      stats.v2Win += 1;
    } else {
      stats.v1Win += 1;
    }
  } catch (error) {
    stats.error += 1;
    console.error(`第 ${i} 局出错:`, error?.message ?? error);
  }
  if ((i + 1) % 5 === 0) {
    console.log(`已跑 ${i + 1}/${games}`, JSON.stringify(stats));
  }
}

console.log("\n=== 调用次数 ===", JSON.stringify(calls));
console.log("\n=== 推演统计 ===");
for (const mode of ["v1", "v2"]) {
  const b = rollouts[mode];
  console.log(
    `${mode}: 推演 ${b.total} 条，截断 ${b.cut} 条（${b.total ? ((b.cut / b.total) * 100).toFixed(1) : "-"}%），直接分出胜负 ${b.win + (b.total - b.cut - b.win)} 条`,
  );
}
console.log("\n=== 结果 ===");
console.log(JSON.stringify(stats, null, 2));
const decided = stats.v2Win + stats.v1Win;
console.log(
  `v2 胜率: ${decided ? ((stats.v2Win / decided) * 100).toFixed(1) : "-"}%（${stats.v2Win}/${decided}）`,
);
