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
 * 决策记忆：见过、想清楚过的局面直接复用结论。
 *
 * 作用有两个：
 * 1. 提强度——同一局面第二次遇到时，用上次搜索里胜率最高的那手；
 * 2. 降耗时——命中且置信度高时 0 ms 出招，没命中也会按"来过几次"缩短预算。
 *
 * 记忆是纯数据（JSON），可以和学习经验一起存本地。
 */

import type { ActionRequest } from "@gi-tcg/typings";

export interface MemoryEntry {
  /** 上次选中的动作指纹 */
  actionKey: string;
  visits: number;
  /** 富化置信度：搜索里最优候选的平均分折算到 0~1 */
  confidence: number;
  /** 连续几次做出同一选择（决策稳定度） */
  sameCount: number;
  /** 累计省下的思考时间（毫秒），仅用于展示 */
  savedMs: number;
}

export interface DecisionMemoryData {
  kind: "gi-tcg-ai-memory";
  version: 1;
  entries: Record<string, MemoryEntry>;
}

export interface DecisionMemory {
  get(key: string): MemoryEntry | null;
  record(key: string, actionKey: string, confidence: number, savedMs: number): void;
}

export function createMemory(): DecisionMemoryData {
  return { kind: "gi-tcg-ai-memory", version: 1, entries: {} };
}

/** FNV-1a 32 位，够用来当局面指纹 */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 局面指纹 = 序列化局面 + 可选动作集合。
 * 动作集合排序后参与哈希，避免同一局面因动作顺序不同而重复记忆。
 */
export function memoryKey(
  serializedState: string,
  request: ActionRequest,
): string {
  const actions = request.action
    .map((action) => {
      const act = action.action;
      if (!act) {
        return "?";
      }
      switch (act.$case) {
        case "useSkill":
          return `s${act.value.skillDefinitionId}:${act.value.targetIds.join(".")}`;
        case "playCard":
          return `c${act.value.cardId}`;
        case "switchActive":
          return `w${act.value.characterId}`;
        case "elementalTuning":
          return `t${act.value.removedCardId}`;
        case "declareEnd":
          return "e";
      }
    })
    .sort()
    .join(",");
  return `${hash(serializedState)}:${hash(actions)}`;
}

export function createMemoryAdapter(
  data: DecisionMemoryData,
): DecisionMemory {
  return {
    get(key) {
      return data.entries[key] ?? null;
    },
    record(key, actionKey, confidence, savedMs) {
      const entry = data.entries[key] ?? {
        actionKey,
        visits: 0,
        confidence: 0,
        sameCount: 0,
        savedMs: 0,
      };
      entry.sameCount =
        entry.actionKey === actionKey ? entry.sameCount + 1 : 1;
      entry.actionKey = actionKey;
      entry.visits += 1;
      // 置信度做指数平滑，避免一局波动就改变直觉
      entry.confidence = entry.confidence * 0.3 + confidence * 0.7;
      entry.savedMs += savedMs;
      data.entries[key] = entry;
    },
  };
}

/** 记忆规模（给 UI 展示"经验"用） */
export function memorySize(data: DecisionMemoryData): number {
  return Object.keys(data.entries).length;
}
