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
 * DMC（Deep Monte Carlo）推理：Q(s, a) 由 state-action MLP 给出，不做搜索。
 *
 * 网络结构与 `policy.ts` 的打分器完全一致（同一个 `PolicyWeights` 格式），
 * 区别只在训练目标：策略网模仿"老师选的那一手"，DMC 回归"整局最终胜负"。
 *
 * 出招 = 合法且付得起的候选里 Q 分数最高的一手；训练采样时用 ε 概率随机探索。
 */

import { ActionValidity, type Action, type DiceType } from "@gi-tcg/typings";
import { exposeState, type GameState } from "@gi-tcg/core";
import type { GameData } from "@gi-tcg/core/data";
import { scoreAction, type AiStyle } from "./evaluate";
import { isPayable } from "./player";
import {
  candidateFeatures,
  policyScores,
  type PolicyWeights,
  type ScoredCandidate,
} from "./policy";
import { stateFeatures } from "./value";

export interface DmcWeights extends PolicyWeights {}

export interface DmcOptions {
  who: 0 | 1;
  data: GameData;
  style?: AiStyle;
  /** ε 探索用的随机源 */
  rng?: () => number;
  /** 以该概率在候选里随机选，默认 0（纯贪心） */
  epsilon?: number;
}

export interface DmcChoice {
  chosenActionIndex: number;
  usedDice: DiceType[];
}

/**
 * 候选池：与 AI 自己的一致（合法且付得起），全都付不起时退回全部合法动作，
 * 再不行就退回全部动作——保证永远有得选。
 */
function candidatePool(actions: readonly Action[]): number[] {
  const valid = actions.flatMap((action, index) =>
    action.validity === ActionValidity.VALID ? [index] : [],
  );
  const payable = valid.filter((index) => isPayable(actions[index]));
  if (payable.length > 0) {
    return payable;
  }
  return valid.length > 0 ? valid : actions.map((_, index) => index);
}

/** 给每个候选动作算 Q 分数（顺序与 `candidatePool` 一致） */
export function dmcScoreCandidates(
  weights: DmcWeights,
  actions: readonly Action[],
  state: GameState,
  options: DmcOptions,
): ScoredCandidate[] {
  const { who, data, style } = options;
  const withScore = weights.usesScore ?? weights.actionDim >= 6 + 7;
  const context = withScore
    ? { who, state: exposeState(who, state), data, style }
    : null;
  return candidatePool(actions).map((index) => ({
    index,
    ...candidateFeatures(actions[index], state, who),
    sc: withScore ? scoreAction(actions[index], context!).score : 0,
  }));
}

/** 选一手：ε 概率随机，否则取 Q 最高 */
export function pickDmcAction(
  weights: DmcWeights,
  actions: readonly Action[],
  state: GameState,
  options: DmcOptions,
): DmcChoice | null {
  if (actions.length === 0) {
    return null;
  }
  const { rng = Math.random, epsilon = 0 } = options;
  const candidates = dmcScoreCandidates(weights, actions, state, options);
  if (candidates.length === 0) {
    return null;
  }
  const picked =
    epsilon > 0 && rng() < epsilon
      ? candidates[Math.floor(rng() * candidates.length)]
      : candidates[
          policyScores(
            weights,
            stateFeatures(state, options.who),
            candidates,
          ).reduce(
            (best, score, index, scores) =>
              score > scores[best] ? index : best,
            0,
          )
        ];
  return {
    chosenActionIndex: picked.index,
    usedDice: actions[picked.index].autoSelectedDice ?? [],
  };
}
