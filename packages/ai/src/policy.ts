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
 * 策略网络推理：给「局面 + 某个候选动作」打分，分数最高的就是选择。
 *
 * 和价值网络的区别：价值网络给局面打一个分；策略网络对每个候选各打一个分，
 * 对同一局面的候选取 argmax。它替代的是搜索（快），不是评估（准）。
 *
 * 候选编码必须和 `tools/train_policy.py` 的 `encode_action` 逐位一致，
 * 类别顺序也是模型的一部分，改了就要重训。
 */

import type { GameState } from "@gi-tcg/core";
import type { Action } from "@gi-tcg/typings";

export const ACTION_KINDS = [
  "useSkill",
  "playCard",
  "switchActive",
  "elementalTuning",
  "declareEnd",
  "none",
] as const;

export interface CandidateFeatures {
  /** 动作类别，取值见 ACTION_KINDS */
  k: string;
  cost: number;
  dmg: number;
  kill: number;
  fast: number;
  tgtHp: number;
  end: number;
}

/** 候选动作特征：类别、费用、目标血量、能否击杀、是否快攻、是否结束 */
export function candidateFeatures(
  action: Action,
  state: GameState,
  who: 0 | 1,
): CandidateFeatures {
  const enemy = state.players[1 - who];
  const enemyIds = new Set(enemy.characters.map((character) => character.id));
  const summary = (action.preview ?? []).reduce(
    (acc, preview) => {
      const mutation = preview.mutation;
      if (mutation?.$case === "damage" && enemyIds.has(mutation.value.targetId)) {
        acc.damage += mutation.value.value;
        acc.kill += mutation.value.causeDefeated ? 1 : 0;
      }
      return acc;
    },
    { damage: 0, kill: 0 },
  );
  const kind = action.action?.$case ?? "none";
  const enemyActive = enemy.characters.find(
    (character) => character.id === enemy.activeCharacterId,
  );
  return {
    k: kind,
    cost: (action.requiredCost ?? []).reduce((sum, req) => sum + req.count, 0),
    dmg: Math.min(summary.damage, 10) / 10,
    kill: summary.kill > 0 ? 1 : 0,
    fast: action.isFast ? 1 : 0,
    tgtHp: Math.max(enemyActive?.variables.health ?? 0, 0) / 10,
    end: kind === "declareEnd" ? 1 : 0,
  };
}

export interface PolicyWeights {
  stateDim: number;
  actionDim: number;
  /** 训练时是否把启发式打分当输入；为 false 时推理不必先跑启发式 */
  usesScore?: boolean;
  actionKinds: string[];
  mean: number[];
  std: number[];
  layers: { w: number[][]; act: string }[];
}

export type ScoredCandidate = CandidateFeatures & {
  /** 启发式打分：训练时也作为输入特征，推理时必须现算 */
  sc: number;
};

/** 每个候选各打一个分，调用方取最大值对应的动作 */
export function policyScores(
  weights: PolicyWeights,
  stateVector: readonly number[],
  candidates: readonly ScoredCandidate[],
): number[] {
  const withScore =
    weights.usesScore ??
    weights.actionDim >= ACTION_KINDS.length + 7;
  return candidates.map((candidate) => {
    let current = [...stateVector, ...encodeCandidate(candidate, withScore)].map(
      (value, index) =>
        (value - (weights.mean[index] ?? 0)) / (weights.std[index] || 1),
    );
    for (const layer of weights.layers) {
      current = layer.w.map((row) =>
        row.reduce(
          (sum, weight, index) =>
            sum + weight * (index === current.length ? 1 : current[index] ?? 0),
          0,
        ),
      );
      current = current.map((value) => activate(value, layer.act));
    }
    return current[0] ?? 0;
  });
}

function encodeCandidate(
  candidate: ScoredCandidate,
  withScore: boolean,
): number[] {
  return [
    ...ACTION_KINDS.map((kind) => (candidate.k === kind ? 1 : 0)),
    candidate.cost,
    candidate.dmg,
    candidate.kill,
    candidate.fast,
    candidate.tgtHp,
    candidate.end,
    ...(withScore ? [candidate.sc] : []),
  ];
}

function activate(value: number, act: string): number {
  if (act === "relu") {
    return Math.max(value, 0);
  }
  if (act === "tanh") {
    return Math.tanh(value);
  }
  return value;
}
