// 采集轨迹样本：每局每个决策点记一行 (特征, 结局)，供价值网络 / 查表使用。
//
// 用法:
//   node collect-trajectories.mjs --games 2000 --shard 0 --shards 4 --out /data/traj
// 可选:
//   --mix heuristic|mixed|search  对手强度混合（默认 mixed）
//   --sample 3                     每 N 个决策点采一个（默认 3）
//   --budget 300                   search 模式的思考预算
//   --start 0                      起始局号（断点续跑用）
//
// 输出: <out>/shard-<shard>.jsonl + <out>/progress-<shard>.json
// 行格式: {"s":座位,"w":胜负,"t":回合,"f":[22维特征]}

import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, stateFeatureMap, stateFeatures, styleOfDeck } from "../dist/index.js";

const LIB =
  process.env.GI_DECK_LIB ??
  "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";

function parseArgs(argv) {
  const result = {
    games: 1000,
    shard: 0,
    shards: 1,
    out: "/data/traj",
    lib: "",
    mix: "mixed",
    sample: 3,
    budget: 300,
    depth: 30,
    searchShare: 0.25,
    blunderShare: 0.15,
    start: 0,
    seed: 424242,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    const value = argv[i + 1];
    if (key === "out") {
      result.out = value;
    } else if (key === "lib") {
      result.lib = value;
    } else if (key === "mix") {
      result.mix = value;
    } else {
      result[key] = Number(value);
    }
  }
  return result;
}

const options = parseArgs(process.argv.slice(2));
const data = getData(CURRENT_VERSION);
const library = JSON.parse(
  fs.readFileSync(options.lib || LIB, "utf8"),
).decks;
const usable = library.filter(
  (deck) => deck.chars?.length === 3 && deck.cards?.length >= 28,
);

fs.mkdirSync(options.out, { recursive: true });
const shardFile = path.join(options.out, `shard-${options.shard}.jsonl.gz`);
const progressFile = path.join(options.out, `progress-${options.shard}.json`);

const previous = fs.existsSync(progressFile)
  ? JSON.parse(fs.readFileSync(progressFile, "utf8"))
  : { games: 0, lines: 0 };
const startGame = Math.min(options.start + previous.games, options.start + options.games);
const endGame = options.start + options.games;
if (startGame >= endGame) {
  console.log(`分片 ${options.shard} 已完成（${previous.games} 局），跳过`);
  process.exit(0);
}

/** 用同步追加，避免异步写流在长任务里悄悄丢数据 */
function appendLines(lines) {
  if (lines.length === 0) {
    return;
  }
  // 逐批 gzip 追加：多个 gzip member 拼接，gunzip 能连续解压
  fs.appendFileSync(shardFile, zlib.gzipSync(Buffer.from(lines.join("")), { level: 6 }));
}
let lines = previous.lines;
let games = previous.games;

/** 权重随机：按 mix 决定双方用多强的 AI */
function pickOpponent(rng) {
  if (options.mix === "heuristic") {
    return { search: false, blunder: 0 };
  }
  if (options.mix === "search") {
    return { search: true, blunder: 0 };
  }
  const roll = rng();
  if (roll < 1 - options.searchShare - options.blunderShare) {
    return { search: false, blunder: 0 };
  }
  if (roll < 1 - options.blunderShare) {
    return { search: true, blunder: 0 };
  }
  return { search: false, blunder: 0.2 };
}

/** 候选动作特征：类别、费用、目标血量、能否击杀、是否快攻、是否结束 */
function actionFeatures(action, state, who) {
  const act = action.action;
  const enemy = state.players[1 - who];
  const summary = (action.preview ?? []).reduce(
    (acc, preview) => {
      const mutation = preview.mutation;
      if (mutation?.$case === "damage") {
        const enemyIds = new Set(enemy.characters.map((c) => c.id));
        if (enemyIds.has(mutation.value.targetId)) {
          acc.damage += mutation.value.value;
          acc.kill += mutation.value.causeDefeated ? 1 : 0;
        }
      }
      return acc;
    },
    { damage: 0, kill: 0 },
  );
  const cost = (action.requiredCost ?? []).reduce((sum, req) => sum + req.count, 0);
  const kind = act?.$case ?? "none";
  const enemyActive = enemy.characters.find((c) => c.id === enemy.activeCharacterId);
  return {
    k: kind,
    cost,
    dmg: Math.min(summary.damage, 10) / 10,
    kill: summary.kill > 0 ? 1 : 0,
    fast: action.isFast ? 1 : 0,
    tgtHp: Math.max(enemyActive?.variables.health ?? 0, 0) / 10,
    end: kind === "declareEnd" ? 1 : 0,
  };
}

/** 动作标签：类别 + 关键参数（角色 id / 卡牌 id / 技能 id） */
function actionLabel(action) {
  const act = action.action;
  if (!act) {
    return "none";
  }
  switch (act.$case) {
    case "useSkill":
      return `skill:${act.value.skillDefinitionId}`;
    case "playCard":
      return `card:${act.value.cardDefinitionId}`;
    case "switchActive":
      return `switch:${act.value.characterId}`;
    case "elementalTuning":
      return "tuning";
    case "declareEnd":
      return "end";
    default:
      return act.$case;
  }
}

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

async function runGame(gameIndex) {
  const rng = mulberry32(options.seed + gameIndex * 7919);
  const deckA = usable[(gameIndex * 37 + options.shard * 13) % usable.length];
  const deckB = usable[(gameIndex * 37 + 211 + options.shard * 13) % usable.length];
  const decks = [
    { characters: deckA.chars, cards: deckA.cards },
    { characters: deckB.chars, cards: deckB.cards },
  ];
  const game = new Game(
    Game.createInitialState({
      decks,
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: options.seed + gameIndex,
    }),
  );

  /** 本局记录：{ seat, round, features } */
  const samples = [];
  /** 决策点计数（不能拿 samples.length 当计数，否则第一次采样后长度永远不是 N 的倍数） */
  let decisions = 0;
  for (const seat of [0, 1]) {
    const plan = pickOpponent(rng);
    const io = createAi({
      who: seat,
      seed: options.seed + gameIndex * 2 + seat,
      delayMs: 0,
      data,
      style: styleOfDeck(decks[seat]),
      blunderRate: plan.blunder,
      ...(plan.search
        ? {
            selectAction: async (request, context) => {
              const result = await searchBestAction(request, {
                who: seat,
                data,
                state: game.state,
                budgetMs: options.budget,
                maxActions: options.depth,
              });
              return {
                chosenActionIndex: result.chosenActionIndex,
                usedDice: result.usedDice,
              };
            },
          }
        : {}),
    });
    const original = io.rpc.bind(io);
    io.rpc = async (request) => {
      if (request.request?.$case !== "action") {
        return original(request);
      }
      // 只有采样的那一步才需要记动作，避免白算
      const sampled = decisions % options.sample === 0;
      const snapshot = sampled
        ? {
            // v3：命名特征 + 全部候选的动作特征 + 可见牌信息
            featureMap: stateFeatureMap(game.state, seat),
            vector: stateFeatures(game.state, seat),
            round: game.state.roundNumber,
            candidates: request.request.value.action
              .map((action, index) => ({ index, ...actionFeatures(action, game.state, seat) }))
              .slice(0, 5),
            candidateCount: request.request.value.action.length,
            myHand: game.state.players[seat].hands.map((card) => card.definition.id),
            enemyPlayed: game.state.players[1 - seat].removedEntities
              ?.map((entity) => entity.definition?.id)
              .filter((id) => typeof id === "number")
              .slice(-12) ?? [],
          }
        : null;
      decisions += 1;
      const response = await original(request);
      if (snapshot) {
        // 响应可能是扁平的，也可能包在 { response: { $case, value } } 里，两种都兼容
        const body =
          response?.response?.$case === "action" ? response.response.value : response;
        const chosenIndex = body?.chosenActionIndex;
        const chosen =
          typeof chosenIndex === "number"
            ? request.request.value.action[chosenIndex]
            : undefined;
        snapshot.action = chosen ? actionLabel(chosen) : "none";
        snapshot.index = chosenIndex;
        samples.push({ seat, ...snapshot });
      }
      return response;
    };
    game.players[seat].io = io;
  }

  const winner = await game.start();
  if (process.env.DEBUG_COLLECT) {
    console.log(`[debug] game=${gameIndex} winner=${winner} samples=${samples.length} rounds=${game.state.roundNumber}`);
  }
  if (winner === null) {
    return { games: 1, lines: 0 };
  }
  const lines = [];
  for (const sample of samples) {
    lines.push(
      `${JSON.stringify({
        v: 3,
        s: sample.seat,
        w: winner === sample.seat ? 1 : 0,
        t: sample.round,
        f: Object.fromEntries(
          Object.entries(sample.featureMap).map(([key, value]) => [
            key,
            Math.round(value * 1000) / 1000,
          ]),
        ),
        x: sample.vector.map((value) => Math.round(value * 1000) / 1000),
        c: sample.candidates,
        a: sample.index ?? -1,
        l: sample.action ?? "none",
        h: sample.myHand,
        e: sample.enemyPlayed,
      })}\n`,
    );
  }
  appendLines(lines);
  return { games: 1, lines: lines.length };
}

for (let index = startGame; index < endGame; index += 1) {
  const result = await runGame(index);
  games += result.games;
  lines += result.lines;
  if (games % 25 === 0) {
    fs.writeFileSync(progressFile, JSON.stringify({ games, lines, mix: options.mix }));
    console.log(
      `分片${options.shard}: ${startGame + games - previous.games}/${endGame} 局，${lines} 行`,
    );
  }
}

fs.writeFileSync(progressFile, JSON.stringify({ games, lines, mix: options.mix }));
console.log(
  `分片${options.shard} 完成：新增 ${games - previous.games} 局，累计 ${games} 局 / ${lines} 行`,
);
