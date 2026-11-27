// 局面价值 A/B：同局对打 + 镜像配对。
//
// 用法:
//   node ab-value.mjs --a=v2 --b=v1 --pairs=15 --budget=150 --depth=10
//   node ab-value.mjs --a=v2nn --b=v2 --pairs=15 --nn=/data/gitcg/data/nn-v1.json
//
// 配置: v1=旧线性公式 | v2=手工新特征 | v2nn=v2+神经网络
// 镜像配对: 每一对用同一牌组同一随机种子打两局，交换先手后比较，抵消先手与随机性。

import fs from "node:fs";
import { CURRENT_VERSION, Game, exposeState } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { ActionValidity } from "@gi-tcg/typings";
import {
  actionKey,
  candidateFeatures,
  precomputeLine,
  takeCacheHitCount,
  createAi,
  createMemory,
  createMemoryAdapter,
  isPayable,
  policyScores,
  scoreAction,
  searchBestAction,
  stateFeatures,
  styleOfDeck,
} from "../dist/index.js";

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
/** B 方的推演深度（默认与 A 相同）；用来单独测"加深搜索"的效果 */
const DEPTH_B = Number(args.depthB ?? DEPTH);
const NN_PATH = args.nn ?? "/data/gitcg/data/nn-v1.json";
const NN_WEIGHT = Number(args.nnWeight ?? 0.45);
/** 学习到的单卡先验（cardId → -0.3..0.3），传给 AI 的 cardPriors */
const PRIORS_PATH = args.priors ?? null;
const cardPriors = PRIORS_PATH
  ? new Map(
      Object.entries(JSON.parse(fs.readFileSync(PRIORS_PATH, "utf8"))).map(([id, value]) => [
        Number(id),
        Number(value),
      ]),
    )
  : undefined;
/** B 方的思考预算；用来单独测"算力够不够"（默认与 A 相同） */
const BUDGET_B = Number(args.budgetB ?? BUDGET);
/** 决策记忆：A 方的搜索挂上记忆，B 方不挂；顺便统计命中率 */
const USE_MEMORY = args.memory === "true";
/** 策略网络作为搜索的先验排序（不是替代搜索） */
const USE_POLICY_GUIDE = args.policyGuide === "true"? true : args.policyGuide === "both";
/** 诊断：统计每次搜索实际跑了多少 rollout、花了多少毫秒 */
const SEARCH_STATS = args.searchStats === "true";
/** rollout 内跳过动作预览：A/B 可分别开，用来测"加速换来的 rollout 数"值不值 */
const SKIP_PREVIEW_A = args.skipPreview === "true";
/** 大招计划：能量满时攒骰/调和凑大招；两侧可分别关闭，用来测净效果 */
const BURST_PLAN_A = args.noBurstPlan !== "true";
/** 后台预计算预算（毫秒）；0 表示关闭。默认 0，实验时显式开启 */
const PRECOMPUTE_MS = Number(args.precompute ?? 0);
let cacheHits = 0;
const BURST_PLAN_B = args.noBurstPlanB !== "true";
const SKIP_PREVIEW_B = args.skipPreviewB === "true";
const searchStats = { decisions: 0, rollouts: 0, elapsed: 0, budget: 0 };
const memoryStats = { gets: 0, hits: 0 };
const memoryA = USE_MEMORY ? instrument(createMemoryAdapter(createMemory())) : null;

function instrument(adapter) {
  return {
    get(key) {
      memoryStats.gets += 1;
      const entry = adapter.get(key);
      if (entry) {
        memoryStats.hits += 1;
      }
      return entry;
    },
    record: (...args) => adapter.record(...args),
  };
}

/** 明牌模式：推演时直接用真实隐藏信息。A/B 可以分别开，用来量化"看不清对手"损失多少 */
const PERFECT_A = args.perfectInfo === "true";
const PERFECT_B = args.perfectInfoB === "true";
const A_MODE = args.a ?? "v2";
const B_MODE = args.b ?? "v1";
/** 策略网络模型；--a=policy / --b=policy 时需要 */
const POLICY_PATH =
  !args.policy || args.policy === "true" ? "/data/gitcg/data/policy-40d.json" : args.policy;

const data = getData(CURRENT_VERSION);
const library = JSON.parse(
  fs.readFileSync(args.lib ?? "/data/gitcg/data/deck-library.json", "utf8"),
).decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const nn = fs.existsSync(NN_PATH) ? JSON.parse(fs.readFileSync(NN_PATH, "utf8")) : null;

if (NN_PATH && !nn && (A_MODE === "v2nn" || B_MODE === "v2nn" || A_MODE === "v1nn" || B_MODE === "v1nn")) {
  throw new Error(`缺少神经网络权重: ${NN_PATH}`);
}

const policy =
  A_MODE === "policy" || B_MODE === "policy"
    ? JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"))
    : null;

/** 策略网络给出的候选排序分，归一化到和启发式同量级，喂给搜索当先验 */
function policyPrior(actions, who, state, deck) {
  const pool = actions.flatMap((action, index) =>
    action.validity === ActionValidity.VALID && isPayable(action) ? [index] : [],
  );
  if (pool.length === 0) {
    return undefined;
  }
  const needsScore = policy.usesScore !== false;
  const context = needsScore
    ? { who, state: exposeState(who, state), data, style: styleOfDeck(deck) }
    : null;
  const candidates = pool.map((index) => ({
    index,
    ...candidateFeatures(actions[index], state, who),
    sc: needsScore ? scoreAction(actions[index], context).score : 0,
  }));
  const scores = policyScores(policy, stateFeatures(state, who), candidates);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  // 搜索里先验走 tanh(prior/4)，抬到 0~6 才和启发式分数同量级
  return new Map(
    candidates.map((candidate, i) => [candidate.index, ((scores[i] - min) / span) * 6]),
  );
}

/** 用训练好的策略网络挑动作：候选池和 AI 自己的一致（合法且付得起），不跑搜索 */
function pickByPolicy(actions, who, state, deck) {
  const legal = actions.flatMap((action, index) =>
    action.validity === ActionValidity.VALID && isPayable(action) ? [index] : [],
  );
  const pool = legal.length > 0 ? legal : actions.map((_, index) => index);
  const needsScore = policy.usesScore !== false;
  const context = needsScore
    ? { who, state: exposeState(who, state), data, style: styleOfDeck(deck) }
    : null;
  const candidates = pool.map((index) => ({
    index,
    ...candidateFeatures(actions[index], state, who),
    // 不含 sc 的模型不需要启发式打分，这一步省掉才有速度优势
    sc: needsScore ? scoreAction(actions[index], context).score : 0,
  }));
  const scores = policyScores(policy, stateFeatures(state, who), candidates);
  const best = candidates[scores.indexOf(Math.max(...scores))];
  return {
    chosenActionIndex: best.index,
    usedDice: actions[best.index].autoSelectedDice ?? [],
  };
}

/** heurnp = 纯启发式但关掉牌/角色经验先验，用来单独测先验值多少 */
const weightsOf = (mode) =>
  mode === "heurnp" ? { cardPrior: 0, charPrior: 0 } : undefined;

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
      weights: weightsOf(mode),
      // 学习先验只给 A 方，B 方当对照
      cardPriors: isA ? cardPriors : undefined,
      selectAction: async (request) => {
        // 不跑搜索的两种模式：返回 undefined 让 AI 落回启发式，或交给策略网络
        if (mode === "heur" || mode === "heurnp") {
          return undefined;
        }
        if (mode === "policy") {
          return pickByPolicy(request.action, seat, game.state, decks[seat]);
        }
        const result = await searchBestAction(request, {
          who: seat,
          data,
          state: game.state,
          budgetMs: isA ? BUDGET : BUDGET_B,
          maxActions: isA ? DEPTH : DEPTH_B,
          rng: mulberry32(seed),
          valueOptions: valueOptionsOf(mode),
          perfectInformation: isA ? PERFECT_A : PERFECT_B,
          skipRolloutPreview: isA ? SKIP_PREVIEW_A : SKIP_PREVIEW_B,
          burstPlan: isA ? BURST_PLAN_A : BURST_PLAN_B,
          // 策略头只给候选排序，搜索仍是主力
          heuristicScores:
            USE_POLICY_GUIDE && policy ? policyPrior(request.action, seat, game.state, decks[seat]) : undefined,
          memory: isA && memoryA ? memoryA : undefined,
        });
        cacheHits += takeCacheHitCount();
        if (PRECOMPUTE_MS > 0) {
          void precomputeLine(request, {
            who: seat,
            data,
            state: game.state,
            budgetMs: PRECOMPUTE_MS,
            maxActions: 10,
            maxCandidates: 8,
            ourActionKey: actionKey(result.action ?? request.action[result.chosenActionIndex]),
          }).catch(() => void 0);
        }
        if (SEARCH_STATS) {
          searchStats.decisions += 1;
          searchStats.rollouts += result.rollouts ?? 0;
          searchStats.elapsed += result.elapsedMs ?? 0;
          searchStats.budget += BUDGET;
        }
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
      searchDecisions: searchStats.decisions,
      searchRollouts: searchStats.rollouts,
      searchElapsedMs: searchStats.elapsed,
      searchBudgetMs: searchStats.budget,
      cacheHits,
      memoryGets: memoryStats.gets,
      memoryHits: memoryStats.hits,
      seconds: elapsed,
    }),
);
