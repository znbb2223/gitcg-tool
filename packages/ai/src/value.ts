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
 * 局面价值：决定「现在谁占优」，喂给搜索的截断推演。
 *
 * 三层可叠加，每层都能单独关掉：
 * 1. `handcraftedValue` —— 手工特征（血量/场面/资源/节奏）；
 * 2. `tableValue` —— 局面特征分桶后的历史胜率查表（统计学习）；
 * 3. `nnValue` —— 小型神经网络（ONNX 风格的纯 JSON 权重，纯 JS 前向）。
 */

import type { GameState, PlayerState } from "@gi-tcg/core";

/** 归一化后的局面特征，顺序固定，查表与神经网络共用 */
export const FEATURE_ORDER = [
  "myHp",
  "enemyHp",
  "myAlive",
  "enemyAlive",
  "myActiveHp",
  "enemyActiveHp",
  "myEnergy",
  "enemyEnergy",
  "mySummons",
  "enemySummons",
  "mySupports",
  "enemySupports",
  "myEquip",
  "enemyEquip",
  "myStatus",
  "enemyStatus",
  "myHands",
  "enemyHands",
  "myDice",
  "enemyDice",
  "myPile",
  "enemyPile",
] as const;

export type FeatureName = (typeof FEATURE_ORDER)[number];
export type FeatureVector = number[];

function playerOf(state: GameState, who: 0 | 1): PlayerState {
  return state.players[who];
}

function activeOf(player: PlayerState): PlayerState["characters"][number] | undefined {
  return player.characters.find(
    (character) => character.id === player.activeCharacterId,
  );
}

/** 装备/状态类实体：挂在角色身上的算装备，场上独立的算状态 */
function countAttachments(player: PlayerState): number {
  return player.characters.reduce(
    (sum, character) => sum + character.entities.length,
    0,
  );
}

/** 把局面压成定长特征向量（归一化到大致 0~1 量级） */
export function stateFeatures(state: GameState, who: 0 | 1): FeatureVector {
  const me = playerOf(state, who);
  const enemy = playerOf(state, 1 - who);
  const hpOf = (player: PlayerState) =>
    player.characters.reduce(
      (sum, character) => sum + Math.max(character.variables.health, 0),
      0,
    ) / 30;
  const aliveOf = (player: PlayerState) =>
    player.characters.filter((character) => character.variables.health > 0).length / 3;
  const energyOf = (player: PlayerState) =>
    player.characters.reduce(
      (sum, character) => sum + Math.min(character.variables.energy, character.variables.maxEnergy),
      0,
    ) / 6;
  const activeHpOf = (player: PlayerState) =>
    Math.max(activeOf(player)?.variables.health ?? 0, 0) / 10;

  return [
    hpOf(me),
    hpOf(enemy),
    aliveOf(me),
    aliveOf(enemy),
    activeHpOf(me),
    activeHpOf(enemy),
    energyOf(me),
    energyOf(enemy),
    me.summons.length / 4,
    enemy.summons.length / 4,
    me.supports.length / 4,
    enemy.supports.length / 4,
    countAttachments(me) / 6,
    countAttachments(enemy) / 6,
    me.combatStatuses.length / 4,
    enemy.combatStatuses.length / 4,
    me.hands.length / 10,
    enemy.hands.length / 10,
    me.dice.length / 8,
    enemy.dice.length / 8,
    me.pile.length / 30,
    enemy.pile.length / 30,
  ];
}

/** 旧版价值：血量 + 存活 + 场面 + 手牌 + 骰子，简单线性 */
export function handcraftedValueV1(state: GameState, who: 0 | 1): number {
  const value = (index: 0 | 1) => {
    const player = playerOf(state, index);
    const health = player.characters.reduce(
      (sum, character) => sum + Math.max(character.variables.health, 0),
      0,
    );
    const alive = player.characters.filter(
      (character) => character.variables.health > 0,
    ).length;
    return (
      health +
      alive * 3 +
      player.summons.length * 0.5 +
      player.supports.length * 0.5 +
      player.hands.length * 0.3 +
      player.dice.length * 0.2
    );
  };
  return Math.tanh((value(who) - value(1 - who)) / 12);
}

/** 新版手工价值：在旧版基础上补充能、装备、状态、牌库与出战角色血量 */
const V2_WEIGHTS: Record<FeatureName, number> = {
  myHp: 1,
  enemyHp: -1,
  myAlive: 3,
  enemyAlive: -3,
  myActiveHp: 0.8,
  enemyActiveHp: -0.8,
  myEnergy: 1.6,
  enemyEnergy: -1.6,
  mySummons: 1.4,
  enemySummons: -1.4,
  mySupports: 1.1,
  enemySupports: -1.1,
  myEquip: 0.9,
  enemyEquip: -0.9,
  myStatus: 0.7,
  enemyStatus: -0.7,
  myHands: 0.9,
  enemyHands: -0.9,
  myDice: 0.7,
  enemyDice: -0.7,
  myPile: 0.25,
  enemyPile: -0.25,
};

export function handcraftedValueV2(features: FeatureVector): number {
  const total = FEATURE_ORDER.reduce(
    (sum, name, index) => sum + (features[index] ?? 0) * V2_WEIGHTS[name],
    0,
  );
  return Math.tanh(total / 4.2);
}

/** 历史胜率查表：桶 → { 对局数, 胜场数 } */
export interface FeatureBucket {
  games: number;
  wins: number;
}

export interface FeatureTable {
  kind: "gi-tcg-value-table";
  version: 1;
  buckets: Record<string, FeatureBucket>;
}

export function createFeatureTable(): FeatureTable {
  return { kind: "gi-tcg-value-table", version: 1, buckets: {} };
}

/** 粗分桶：每维取 4 档，避免桶数爆炸 */
function bucketOf(value: number): number {
  return Math.min(3, Math.max(0, Math.floor(value * 4)));
}

export function featureKey(features: FeatureVector): string {
  return features.map(bucketOf).join("");
}

export function recordBucket(
  table: FeatureTable,
  features: FeatureVector,
  won: boolean,
): void {
  const key = featureKey(features);
  const bucket = table.buckets[key] ?? { games: 0, wins: 0 };
  bucket.games += 1;
  bucket.wins += won ? 1 : 0;
  table.buckets[key] = bucket;
}

/** 平滑后的胜率 → [-1, 1]；样本不足返回 null */
export function tableValue(
  table: FeatureTable | null | undefined,
  features: FeatureVector,
  minGames = 30,
): number | null {
  if (!table) {
    return null;
  }
  const bucket = table.buckets[featureKey(features)];
  if (!bucket || bucket.games < minGames) {
    return null;
  }
  // 拉普拉斯平滑：先验按 50% 算，样本越多越相信统计值
  const smoothed = (bucket.wins + minGames * 0.5) / (bucket.games + minGames);
  return smoothed * 2 - 1;
}

export function mergeFeatureTables(
  target: FeatureTable,
  source: FeatureTable,
): FeatureTable {
  for (const [key, bucket] of Object.entries(source.buckets)) {
    const current = target.buckets[key] ?? { games: 0, wins: 0 };
    target.buckets[key] = {
      games: current.games + bucket.games,
      wins: current.wins + bucket.wins,
    };
  }
  return target;
}

/** 小型全连接网络：每层 weights[bias] + 矩阵乘 */
export interface NnLayer {
  /** 每个神经元一行：长度 = 上一层输出 + 1（末位是偏置） */
  w: number[][];
  /** "relu" 或 "tanh"（最后一层一般 tanh） */
  act: "relu" | "tanh" | "linear";
}

export interface NnWeights {
  kind: "gi-tcg-value-nn";
  version: 1;
  /** 特征标准化参数，训练时一并导出 */
  mean: number[];
  std: number[];
  layers: NnLayer[];
}

function activate(value: number, act: NnLayer["act"]): number {
  if (act === "relu") {
    return value > 0 ? value : 0;
  }
  return act === "tanh" ? Math.tanh(value) : value;
}

/** 纯 JS 前向；权重缺失或维度不符返回 null */
export function nnValue(
  weights: NnWeights | null | undefined,
  features: FeatureVector,
): number | null {
  if (!weights || weights.layers.length === 0) {
    return null;
  }
  // 特征维度对不上说明权重是旧版本训的，直接放弃，避免用错数据打分
  if (weights.mean.length !== features.length) {
    return null;
  }
  let current = features.map(
    (value, index) =>
      (value - (weights.mean[index] ?? 0)) / (weights.std[index] || 1),
  );
  for (const layer of weights.layers) {
    const next = layer.w.map((row) =>
      row.reduce(
        (sum, weight, index) => sum + weight * (index === current.length ? 1 : current[index] ?? 0),
        0,
      ),
    );
    current = next.map((value) => activate(value, layer.act));
  }
  const output = current[0] ?? 0;
  return Math.max(-1, Math.min(1, output));
}

export interface ValueOptions {
  /** "v1" 用旧版线性价值，"v2" 用手工特征版 */
  mode?: "v1" | "v2";
  table?: FeatureTable | null;
  /** 桶内样本少于该值时不信查表 */
  minTableGames?: number;
  /** 查表结果与手工价值的混合权重（0~1） */
  tableWeight?: number;
  nn?: NnWeights | null;
  /** 神经网络结果与手工价值的混合权重（0~1） */
  nnWeight?: number;
  /** 额外收集回调：每评估一次局面喂一次，训练脚本用来攒样本 */
  onSample?: (features: FeatureVector, value: number, state: GameState, who: 0 | 1) => void;
}

let currentOptions: ValueOptions = { mode: "v2" };

/** 全局配置：脚本 / 应用启动时调一次即可，评估函数本身保持无状态 */
export function configureValue(options: Partial<ValueOptions>): void {
  currentOptions = { ...currentOptions, ...options };
}

export function getValueOptions(): ValueOptions {
  return currentOptions;
}

/** 局面价值，返回 [-1, 1]；正数表示 `who` 占优 */
export function valueOf(state: GameState, who: 0 | 1, options?: ValueOptions): number {
  const config = options ? { ...currentOptions, ...options } : currentOptions;
  if (config.mode === "v1") {
    return handcraftedValueV1(state, who);
  }
  const features = stateFeatures(state, who);
  const handcrafted = handcraftedValueV2(features);
  config.onSample?.(features, handcrafted, state, who);
  const blended = (() => {
    const tableValueNow = tableValue(
      config.table,
      features,
      config.minTableGames ?? 30,
    );
    const nnValueNow = nnValue(config.nn, features);
    const tableWeight = tableValueNow === null ? 0 : config.tableWeight ?? 0.5;
    const nnWeight = nnValueNow === null ? 0 : config.nnWeight ?? 0.4;
    const totalWeight = 1 + tableWeight + nnWeight;
    return (
      (handcrafted + (tableValueNow ?? 0) * tableWeight + (nnValueNow ?? 0) * nnWeight) /
      totalWeight
    );
  })();
  return Math.max(-1, Math.min(1, blended));
}
