// Copyright (C) 2026 Piovium Labs
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/**
 * DMC 自对弈采样器。
 *
 * 两种行为策略：
 * - `--policy=heur`：纯启发式（单步打分，不搜索）打，用来冷启动；
 * - `--policy=dmc`：用给定权重 ε-greedy 出招（`--weights` 必填，`--epsilon` 控制探索）。
 *
 * 每个决策点记一条：
 *   {"x":[44 维状态特征],"c":{选中动作的候选特征+启发式分},"r":整局回报(±1/0)}
 * 只用公开信息；不记候选全集（DMC 只需要实际走过的那一手）。
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { CURRENT_VERSION, Game, exposeState } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import {
  candidateFeatures,
  createAi,
  pickDmcAction,
  scoreAction,
  stateFeatures,
  styleOfDeck,
} from "../dist/index.js";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";

function parseArgs(argv) {
  const options = {
    games: 1000,
    start: 0,
    out: "/tmp/dmc-samples",
    shard: 0,
    shards: 1,
    lib: LIB,
    seed: 20261128,
    policy: "heur",
    weights: null,
    epsilon: 0,
    sample: 1,
    resume: false,
  };
  const stringKeys = new Set(["out", "lib", "policy", "weights"]);
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      throw new Error(`无法解析的参数：${item}（用 --key=value）`);
    }
    const [rawKey, inlineValue] = item.slice(2).split("=");
    // --key value 形式：下一个参数不是 -- 开头就当成值
    const value =
      inlineValue ??
      (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true");
    if (rawKey === "resume") {
      options.resume = value !== "false";
    } else if (stringKeys.has(rawKey)) {
      options[rawKey] = value;
    } else {
      options[rawKey] = Number(value);
    }
  }
  return options;
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

const r3 = (value) => Math.round(value * 1000) / 1000;

const options = parseArgs(process.argv.slice(2));
const data = getData(CURRENT_VERSION);
const library = JSON.parse(fs.readFileSync(options.lib, "utf8")).decks;
const usable = library.filter(
  (deck) => deck.chars?.length === 3 && deck.cards?.length >= 28,
);
const weights =
  options.policy === "dmc"
    ? JSON.parse(fs.readFileSync(options.weights, "utf8"))
    : null;
if (options.policy === "dmc" && !weights) {
  throw new Error("--policy=dmc 需要 --weights=<权重 JSON>");
}

fs.mkdirSync(options.out, { recursive: true });
const shardFile = path.join(options.out, `dmc-${options.shard}.jsonl.gz`);
const progressFile = path.join(options.out, `progress-${options.shard}.json`);
if (!options.resume) {
  // 不续跑就清空分片文件，避免追加出重复样本
  fs.rmSync(shardFile, { force: true });
  fs.rmSync(progressFile, { force: true });
}
const previous = options.resume && fs.existsSync(progressFile)
  ? JSON.parse(fs.readFileSync(progressFile, "utf8"))
  : { done: 0, samples: 0 };
const resumeFrom = options.start + previous.done;

/** 同步追加 + gzip：异步写流在长任务里会悄悄丢数据 */
function appendLines(lines) {
  if (lines.length === 0) {
    return;
  }
  fs.appendFileSync(shardFile, zlib.gzipSync(Buffer.from(lines.join("")), { level: 6 }));
}

let samples = 0;
let games = 0;
const startedAt = Date.now();

async function runGame(gameIndex) {
  const slots = (offset) =>
    usable[(gameIndex * 37 + offset + options.shard * 13) % usable.length];
  const slotA = slots(0);
  const slotB = slots(211);
  const decks = [
    { characters: slotA.chars, cards: slotA.cards },
    { characters: slotB.chars, cards: slotB.cards },
  ];
  const styles = [styleOfDeck(decks[0]), styleOfDeck(decks[1])];
  const game = new Game(
    Game.createInitialState({
      decks,
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: options.seed + gameIndex,
    }),
  );
  const records = [];
  let decisions = 0;
  for (const seat of [0, 1]) {
    const rng = mulberry32(options.seed + gameIndex * 7919 + seat);
    const io = createAi({
      who: seat,
      seed: options.seed + gameIndex * 2 + seat,
      delayMs: 0,
      data,
      style: styles[seat],
      ...(options.policy === "dmc"
        ? {
            selectAction: async (request) =>
              pickDmcAction(weights, request.action, game.state, {
                who: seat,
                data,
                style: styles[seat],
                rng,
                epsilon: options.epsilon,
              }),
          }
        : {}),
    });
    const original = io.rpc.bind(io);
    io.rpc = async (request) => {
      if (request.request?.$case !== "action") {
        return original(request);
      }
      const sampled = decisions % options.sample === 0;
      decisions += 1;
      const preState = game.state;
      // scoreAction 吃暴露态（对手手牌不可见），和核心态 game.state 不是同一个东西
      const snapshot = sampled
        ? {
            x: stateFeatures(preState, seat),
            context: { who: seat, state: exposeState(seat, preState), data, style: styles[seat] },
            actions: request.request.value.action,
          }
        : null;
      const response = await original(request);
      if (snapshot) {
        const body =
          response?.response?.$case === "action" ? response.response.value : response;
        const index = body?.chosenActionIndex;
        const action = snapshot.actions[index];
        if (typeof index === "number" && action) {
          const features = candidateFeatures(action, preState, seat);
          records.push({
            seat,
            x: snapshot.x,
            c: {
              k: features.k,
              cost: features.cost,
              dmg: features.dmg,
              kill: features.kill,
              fast: features.fast,
              tgtHp: features.tgtHp,
              end: features.end,
              sc: r3(scoreAction(action, snapshot.context).score),
            },
          });
        }
      }
      return response;
    };
    game.players[seat].io = io;
  }
  const winner = await game.start();
  const lines = records.flatMap((record) => {
    const r = winner === null ? 0 : winner === record.seat ? 1 : -1;
    return [
      `${JSON.stringify({
        x: record.x.map(r3),
        c: record.c,
        r,
        g: gameIndex,
        s: record.seat,
      })}\n`,
    ];
  });
  appendLines(lines);
  samples += lines.length;
  return lines.length;
}

const end = options.start + options.games;
if (resumeFrom >= end) {
  console.log(`分片${options.shard} 已完成（${previous.done} 局），跳过`);
  process.exit(0);
}
for (let gameIndex = resumeFrom; gameIndex < end; gameIndex += 1) {
  await runGame(gameIndex);
  games += 1;
  fs.writeFileSync(
    progressFile,
    JSON.stringify({ done: previous.done + games, samples: previous.samples + samples }),
  );
  if (games % 25 === 0) {
    const seconds = (Date.now() - startedAt) / 1000;
    console.log(
      `分片${options.shard} ${games}/${options.games} 局，样本 ${samples}，` +
        `${(games / seconds).toFixed(2)} 局/秒`,
    );
  }
}
const seconds = (Date.now() - startedAt) / 1000;
console.log(
  `分片${options.shard} 完成：${games} 局，样本 ${samples}，用时 ${seconds.toFixed(0)}s，` +
    `平均每局 ${(samples / games).toFixed(1)} 条 → ${shardFile}`,
);
