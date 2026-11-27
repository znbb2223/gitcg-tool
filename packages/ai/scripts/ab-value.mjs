// 局面价值 A/B：同局对打 + 镜像配对。
//
// 用法:
//   node ab-value.mjs --a=v2 --b=v1 --pairs=15 --budget=150 --depth=10
//   node ab-value.mjs --a=v2nn --b=v2 --pairs=15 --nn=/data/gitcg/data/nn-v1.json
//
// 配置: v1=旧线性公式 | v2=手工新特征 | v2nn=v2+神经网络
// 镜像配对: 每一对用同一牌组同一随机种子打两局，交换先手后比较，抵消先手与随机性。

import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, value = "true"] = item.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const PAIRS = Number(args.pairs ?? 15);
/** 起始对号：多实例并行时用它把对局切成互不重叠的区间 */
const OFFSET = Number(args.offset ?? 0);
const BUDGET = Number(args.budget ?? 150);
const DEPTH = Number(args.depth ?? 10);
const NN_PATH = args.nn ?? "/data/gitcg/data/nn-v1.json";
const NN_WEIGHT = Number(args.nnWeight ?? 0.45);
const A_MODE = args.a ?? "v2";
const B_MODE = args.b ?? "v1";

const data = getData(CURRENT_VERSION);
const library = JSON.parse(
  fs.readFileSync(args.lib ?? "/data/gitcg/data/deck-library.json", "utf8"),
).decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const nn = fs.existsSync(NN_PATH) ? JSON.parse(fs.readFileSync(NN_PATH, "utf8")) : null;

if (NN_PATH && !nn && (A_MODE === "v2nn" || B_MODE === "v2nn" || A_MODE === "v1nn" || B_MODE === "v1nn")) {
  throw new Error(`缺少神经网络权重: ${NN_PATH}`);
}

const valueOptionsOf = (mode) => {
  if (mode === "v1") {
    return { mode: "v1" };
  }
  if (mode === "v1nn") {
    return { mode: "v1", nn, nnWeight: NN_WEIGHT };
  }
  if (mode === "v2nn") {
    return { mode: "v2", nn, nnWeight: NN_WEIGHT };
  }
  return { mode: "v2" };
};

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

/** A 执哪一方：pairIndex*2 + gameIndexInPair */
async function playOne(pairIndex, swap, aSeat) {
  const seedBase = 91000 + pairIndex * 131;
  const deckA = library[(pairIndex * 37) % library.length];
  const deckB = library[(pairIndex * 37 + 211) % library.length];
  const decks = [
    { characters: deckA.chars, cards: deckA.cards },
    { characters: deckB.chars, cards: deckB.cards },
  ];
  const game = new Game(
    Game.createInitialState({
      decks,
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: seedBase,
    }),
  );
  const seats = swap ? [1, 0] : [0, 1];
  for (const seat of seats) {
    const isA = seat === aSeat;
    const mode = isA ? A_MODE : B_MODE;
    const seed = seedBase + seat;
    game.players[seat].io = createAi({
      who: seat,
      seed,
      delayMs: 0,
      style: styleOfDeck(decks[seat]),
      data,
      selectAction: async (request) => {
        const result = await searchBestAction(request, {
          who: seat,
          data,
          state: game.state,
          budgetMs: BUDGET,
          maxActions: DEPTH,
          rng: mulberry32(seed),
          valueOptions: valueOptionsOf(mode),
        });
        return {
          chosenActionIndex: result.chosenActionIndex,
          usedDice: result.usedDice,
        };
      },
    });
  }
  const winner = await game.start();
  return winner;
}

const stats = { aWin: 0, bWin: 0, draw: 0, error: 0, pairsA: 0, pairsB: 0, pairsSplit: 0 };
const startedAt = Date.now();

for (let local = 0; local < PAIRS; local += 1) {
  const pair = OFFSET + local;
  try {
    // 两局镜像：第一局 A 先手，第二局 A 后手，牌组与种子完全相同
    const first = await playOne(pair, false, 0);
    const second = await playOne(pair, true, 1);
    const aWins = (first === 0 ? 1 : 0) + (second === 1 ? 1 : 0);
    const bWins = (first === 1 ? 1 : 0) + (second === 0 ? 1 : 0);
    stats.aWin += aWins;
    stats.bWin += bWins;
    if (aWins === bWins) {
      stats.pairsSplit += 1;
    } else if (aWins > bWins) {
      stats.pairsA += 1;
    } else {
      stats.pairsB += 1;
    }
    console.log(
      `对 ${local + 1}/${PAIRS}（#${pair}）: A(${A_MODE}) ${aWins} - ${bWins} B(${B_MODE}) | 累计 A ${stats.aWin} B ${stats.bWin}`,
    );
  } catch (error) {
    stats.error += 1;
    console.error(`对 ${pair} 出错:`, error?.message ?? error);
  }
}

const decided = stats.aWin + stats.bWin;
const elapsed = Math.round((Date.now() - startedAt) / 1000);
console.log(
  "\nRESULT " +
    JSON.stringify({
      a: A_MODE,
      b: B_MODE,
      pairs: PAIRS,
      offset: OFFSET,
      games: stats.aWin + stats.bWin + stats.draw,
      aWin: stats.aWin,
      bWin: stats.bWin,
      draw: stats.draw,
      error: stats.error,
      aWinRate: decided ? +(stats.aWin / decided).toFixed(4) : null,
      pairA: stats.pairsA,
      pairB: stats.pairsB,
      pairSplit: stats.pairsSplit,
      seconds: elapsed,
    }),
);
