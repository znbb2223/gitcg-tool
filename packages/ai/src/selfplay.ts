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
 * 代码层面的自我对弈训练。
 *
 * 两个 AI 各自组牌（"有目的"用学到的权重，"无目的"纯随机但合法），
 * 在静默模式（silent）下快速打完一局，把胜负记进经验库。
 * 没有画面、没有通知，所以能比正常对局快好几倍。
 */

import { CURRENT_VERSION, Game, createRpcResponse } from "@gi-tcg/core";
import type { GameData } from "@gi-tcg/core/data";
import type { DeckData } from "@gi-tcg/assets-manager";
import type { Deck } from "@gi-tcg/typings";
import { buildDeck, randomDeck } from "./deck";
import {
  cardWeights,
  characterWeights,
  createLearning,
  recordGame,
  type LearningData,
} from "./learner";
import { fastReply, searchBestAction } from "./search";
import { createAi } from "./player";
import type { AiStyle, AiWeights } from "./evaluate";

export type EvolutionMode = "learned" | "random";

export interface EvolutionProgress {
  done: number;
  total: number;
  wins: [number, number];
  draws: number;
  /** 后手（1 号位）胜率，用来观察是否在进步 */
  winRate: number;
  lastWinner: 0 | 1 | null;
  elapsedMs: number;
}

/** 一局自我对弈的日志（含复现所需的种子与双方牌组） */
export interface EvolutionGameRecord {
  index: number;
  /** 引擎随机种子：seed + 双方牌组即可完整复现这一局 */
  seed: number;
  decks: [Deck, Deck];
  winner: 0 | 1 | null;
  rounds: number;
  at: number;
}

export interface EvolutionOptions {
  /** 对局用：卡牌/角色定义 */
  data: GameData;
  /** 组卡用：游戏自己的牌组数据（含合法性字段） */
  deckData: DeckData;
  games: number;
  learning?: LearningData;
  mode?: EvolutionMode;
  /** 训练课程：真实（隐藏信息采样）还是明牌（全知） */
  information?: "fair" | "perfect";
  /** 每步用轻量搜索决策（默认用快速策略，速度快得多） */
  useSearch?: boolean;
  /** useSearch 时的单步预算 */
  searchBudgetMs?: number;
  seed?: number;
  onProgress?: (progress: EvolutionProgress) => void;
  /** 每打完一局回调一次，供调用方落盘日志 */
  onGame?: (record: EvolutionGameRecord) => void;
  shouldStop?: () => boolean;
  /** 每打几局让出一次事件循环，避免卡住界面 */
  yieldEvery?: number;
}

export interface FastGameResult {
  winner: 0 | 1 | null;
  rounds: number;
}

/** 用轻量搜索决策的一局（慢但更强，用于"课程"训练） */
async function playSearchGame(
  data: GameData,
  decks: readonly [Deck, Deck],
  seed: number,
  options: { information: "fair" | "perfect"; budgetMs: number },
): Promise<FastGameResult> {
  const game = new Game(
    Game.createInitialState({
      decks: [decks[0], decks[1]],
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: seed,
    }),
    { silent: true },
  );
  const rng = makeRng(seed + 7);
  const makeIo = (who: 0 | 1) => ({
    notify: () => {},
    rpc: async (request: Parameters<typeof fastReply>[0]) => {
      if (request.request?.$case === "action") {
        const result = await searchBestAction(request.request.value, {
          who,
          data,
          state: game.state,
          budgetMs: options.budgetMs,
          maxActions: 8,
          maxCandidates: 4,
          perfectInformation: options.information === "perfect",
          rng,
        });
        return {
          response: {
            $case: "action" as const,
            value: {
              chosenActionIndex: result.chosenActionIndex,
              usedDice: result.usedDice,
            },
          },
        };
      }
      return fastReply(request, null, rng);
    },
  });
  game.players[0].io = makeIo(0);
  game.players[1].io = makeIo(1);
  const winner = await game.start();
  return { winner, rounds: game.state.roundNumber };
}

/** 静默打完一局 */
export interface FastGameOptions {
  /** 失误率：按概率从合法动作里随机挑一个，用来体现「实验室 AI 设置」 */
  blunderRate?: number;
  /** 评分权重（传了就走完整 AI 评估，比快速推演慢，但设置全部生效） */
  weights?: Partial<AiWeights>;
  /** 牌组风格 */
  style?: AiStyle;
  /** 本地经验：单卡先验（会改走完整 AI 评估） */
  cardPriors?: ReadonlyMap<number, number>;
}

export async function playFastGame(
  data: GameData,
  decks: readonly [Deck, Deck],
  seed: number,
  options: FastGameOptions = {},
): Promise<FastGameResult> {
  const game = new Game(
    Game.createInitialState({
      decks: [decks[0], decks[1]],
      data,
      versionBehavior: CURRENT_VERSION,
      randomSeed: seed,
    }),
    { silent: true },
  );
  const createRng = makeRng(seed + 1);
  if (options.weights || options.style || options.cardPriors) {
    game.players[0].io = createAi({
      who: 0,
      seed,
      delayMs: 0,
      blunderRate: options.blunderRate,
      weights: options.weights,
      style: options.style,
      cardPriors: options.cardPriors,
      data,
    });
    game.players[1].io = createAi({
      who: 1,
      seed: seed + 7,
      delayMs: 0,
      blunderRate: options.blunderRate,
      weights: options.weights,
      style: options.style,
      data,
    });
    const winner = await game.start();
    return { winner, rounds: game.state.roundNumber };
  }
  const wrap = () => ({
    notify: () => {},
    rpc: async (request: Parameters<typeof fastReply>[0]) => {
      const response = fastReply(request, null, createRng);
      const rate = options.blunderRate ?? 0;
      if (rate <= 0 || createRng() >= rate) {
        return response;
      }
      const payload = request.request;
      if (payload?.$case !== "action") {
        return response;
      }
      const actions = payload.value.action;
      if (actions.length <= 1) {
        return response;
      }
      const index = Math.floor(createRng() * actions.length);
      return createRpcResponse("action", {
        chosenActionIndex: index,
        usedDice: [...actions[index].autoSelectedDice],
      });
    },
  });
  game.players[0].io = wrap();
  game.players[1].io = wrap();
  const winner = await game.start();
  return { winner, rounds: game.state.roundNumber };
}

/**
 * 连续自我对弈并更新经验库。
 * 返回更新后的经验（调用方负责持久化）。
 */
export async function runEvolution(
  options: EvolutionOptions,
): Promise<LearningData> {
  const startedAt = Date.now();
  const learning = options.learning ?? createLearning();
  const mode = options.mode ?? "learned";
  const rng = makeRng(options.seed ?? Date.now());
  const yieldEvery = options.yieldEvery ?? 1;
  const wins: [number, number] = [0, 0];
  let draws = 0;

  for (let i = 0; i < options.games; i++) {
    if (options.shouldStop?.()) {
      break;
    }
    const deckWinRates = new Map(
      Object.entries(learning.decks).map(([key, record]) => [
        key,
        (record.wins + 1) / (record.games + 2),
      ]),
    );
    const weights =
      mode === "learned"
        ? {
            cardWeights: cardWeights(learning),
            characterWeights: characterWeights(learning),
            deckWinRates,
          }
        : { deckWinRates };
    const decks: [Deck, Deck] = [
      mode === "random"
        ? randomDeck(options.deckData, Math.floor(rng() * 1e9))
        : buildDeck({ deckData: options.deckData, seed: Math.floor(rng() * 1e9), ...weights }),
      mode === "random"
        ? randomDeck(options.deckData, Math.floor(rng() * 1e9))
        : buildDeck({ deckData: options.deckData, seed: Math.floor(rng() * 1e9), ...weights }),
    ];
    const gameSeed = Math.floor(rng() * 1e9);
    const { winner, rounds } = options.useSearch
      ? await playSearchGame(options.data, decks, gameSeed, {
          information: options.information ?? "fair",
          budgetMs: options.searchBudgetMs ?? 120,
        })
      : await playFastGame(options.data, decks, gameSeed);
    recordGame(learning, decks, winner);
    options.onGame?.({
      index: i + 1,
      seed: gameSeed,
      decks: [decks[0], decks[1]],
      winner,
      rounds,
      at: Date.now(),
    });
    if (winner === null) {
      draws += 1;
    } else {
      wins[winner] += 1;
    }
    options.onProgress?.({
      done: i + 1,
      total: options.games,
      wins: [wins[0], wins[1]],
      draws,
      winRate: (i + 1 - draws) === 0 ? 0 : wins[1] / (i + 1 - draws),
      lastWinner: winner,
      elapsedMs: Date.now() - startedAt,
    });
    if (yieldEvery > 0 && i % yieldEvery === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  return learning;
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
