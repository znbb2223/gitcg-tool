// 进化算法调启发式权重：用对局胜率当适应度，搜索更好的 AiWeights。
//
// 用法: node evolve-weights.mjs [--pop=10] [--gens=5] [--games=10] [--seed=1]
// 输出: 最优权重 JSON（可直接写进 AiWeights）
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_AI_WEIGHTS, createAi, styleOfDeck } from "../dist/index.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, value = "true"] = item.replace(/^--/, "").split("=");
    return [key, Number(value)];
  }),
);
const POP = args.pop ?? 10;
const GENS = args.gens ?? 5;
const GAMES = args.games ?? 10;
const SEED = args.seed ?? 20260101;

const data = getData(CURRENT_VERSION);
const library = JSON.parse(
  fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"),
).decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);

const BASELINE = { ...DEFAULT_AI_WEIGHTS };
const KEYS = Object.keys(BASELINE);

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
const rng = mulberry32(SEED);

function randomGenome() {
  const genome = {};
  for (const key of KEYS) {
    const base = BASELINE[key];
    const scale = 1 + (rng() - 0.5) * 1.2; // ±60%
    genome[key] = Math.max(0, Math.round(base * scale * 1000) / 1000);
  }
  return genome;
}

function mutation(genome, rate = 0.25, strength = 0.3) {
  const next = { ...genome };
  for (const key of KEYS) {
    if (rng() < rate) {
      next[key] = Math.max(0, next[key] * (1 + (rng() - 0.5) * strength));
      next[key] = Math.round(next[key] * 1000) / 1000;
    }
  }
  return next;
}

function crossover(a, b) {
  const child = {};
  for (const key of KEYS) {
    child[key] = rng() < 0.5 ? a[key] : b[key];
  }
  return child;
}

/** 用给定权重跑一局，返回胜者 */
async function playOne(weightsA, weightsB, pairIndex, swapped) {
  const deckA = library[(pairIndex * 41) % library.length];
  const deckB = library[(pairIndex * 41 + 173) % library.length];
  const decks = [
    { characters: deckA.chars, cards: deckA.cards },
    { characters: deckB.chars, cards: deckB.cards },
  ];
  const seed = 30000 + pairIndex * 97;
  const game = new Game(
    Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: seed }),
  );
  for (const seat of [0, 1]) {
    const isA = swapped ? seat === 1 : seat === 0;
    game.players[seat].io = createAi({
      who: seat,
      seed: seed + seat,
      delayMs: 0,
      style: styleOfDeck(decks[seat]),
      data,
      weights: isA ? weightsA : weightsB,
    });
  }
  return game.start();
}

/** 适应度：对基线权重的胜率（镜像配对） */
async function fitness(genome) {
  let win = 0;
  let total = 0;
  for (let pair = 0; pair < GAMES; pair += 1) {
    const first = await playOne(genome, BASELINE, pair, false);
    const second = await playOne(genome, BASELINE, pair, true);
    if (first === 0) win += 1;
    if (second === 1) win += 1;
    total += 2;
  }
  return total ? win / total : 0;
}

let population = [BASELINE, ...Array.from({ length: POP - 1 }, randomGenome)];
for (let gen = 0; gen < GENS; gen += 1) {
  const scored = [];
  for (const genome of population) {
    const score = await fitness(genome);
    scored.push({ genome, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  console.log(
    `第 ${gen + 1} 代: 最优 ${(best.score * 100).toFixed(1)}% | 中位 ${(scored[Math.floor(scored.length / 2)].score * 100).toFixed(1)}%`,
  );
  // 精英保留 + 交叉 + 变异
  const elites = scored.slice(0, Math.max(2, Math.floor(POP * 0.3))).map((s) => s.genome);
  const next = [...elites];
  while (next.length < POP) {
    const a = elites[Math.floor(rng() * elites.length)];
    const b = elites[Math.floor(rng() * elites.length)];
    next.push(mutation(crossover(a, b)));
  }
  population = next;
  fs.writeFileSync(
    `/tmp/evolve-best.json`,
    JSON.stringify({ generation: gen + 1, score: best.score, weights: best.genome }, null, 2),
  );
}

const result = JSON.parse(fs.readFileSync("/tmp/evolve-best.json", "utf8"));
console.log("\n最优权重:");
console.log(JSON.stringify(result, null, 2));
