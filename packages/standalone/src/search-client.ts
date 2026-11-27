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

import type { ActionRequest, DiceType } from "@gi-tcg/core";
import { createMemory, type DecisionMemoryData, type MemoryEntry } from "@gi-tcg/ai";
import { loadMemory, saveMemory } from "./learning-storage";

export interface SearchOutcome {
  chosenActionIndex: number;
  usedDice: DiceType[];
  rollouts: number;
  elapsedMs: number;
  cached: boolean;
}

export interface SearchInput {
  version: string;
  who: 0 | 1;
  budgetMs: number;
  /** serializeGameStateLog 的 JSON 字符串 */
  stateLog: string;
  request: ActionRequest;
  heuristicScores?: Record<number, number>;
  /** 明牌模式：AI 直接读取隐藏信息 */
  perfectInformation?: boolean;
  /** 局面价值算法：v1 旧线性 / v2 手工特征（默认） */
  valueMode?: "v1" | "v2";
  /** 是否启用神经网络价值函数 */
  nnEnabled?: boolean;
  /** 是否启用查表价值（与神经网络互斥） */
  tableEnabled?: boolean;
  /** 是否启用搜索（false 时调用方应直接走启发式） */
  searchEnabled?: boolean;
}

/** 搜索 worker 的简单请求/响应封装 */
export class SearchClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, (value: SearchOutcome | null) => void>();
  private nextId = 1;
  private readonly ponderPending = new Map<number, (value: number | null) => void>();
  private readonly memory: DecisionMemoryData =
    loadMemory() ?? createMemory();
  private memorySent = false;
  private memoryDirty = 0;

  constructor() {
    this.worker = new Worker(new URL("./search.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === "ponderResult") {
        const resolvePonder = this.ponderPending.get(message.id);
        if (resolvePonder) {
          this.ponderPending.delete(message.id);
          resolvePonder(message.winRate ?? null);
        }
        return;
      }
      const resolve = this.pending.get(message.id);
      if (!resolve) {
        return;
      }
      this.pending.delete(message.id);
      if (message.memoryKey && message.memoryEntry) {
        this.memory.entries[message.memoryKey] = message.memoryEntry as MemoryEntry;
        this.memoryDirty += 1;
        if (this.memoryDirty >= 5) {
          saveMemory(this.memory);
          this.memoryDirty = 0;
        }
      }
      resolve(
        message.ok
          ? {
              chosenActionIndex: message.chosenActionIndex,
              usedDice: message.usedDice,
              rollouts: message.rollouts,
              elapsedMs: message.elapsedMs,
              cached: Boolean(message.cached),
            }
          : null,
      );
    };
  }

  search(input: SearchInput): Promise<SearchOutcome | null> {
    const id = this.nextId++;
    return new Promise<SearchOutcome | null>((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({
        type: "search",
        id,
        ...input,
        memory: this.memorySent ? undefined : this.memory,
      });
      this.memorySent = true;
      // 兜底：worker 卡死时回退到启发式
      setTimeout(() => {
        if (this.pending.delete(id)) {
          resolve(null);
        }
      }, input.budgetMs + 20_000);
    });
  }

  /** 已记住的局面数（UI 展示用） */
  get rememberedPositions() {
    return Object.keys(this.memory.entries).length;
  }

  /** 对手思考时的后台评估 */
  ponder(input: Omit<SearchInput, "request">): Promise<number | null> {
    const id = this.nextId++;
    return new Promise<number | null>((resolve) => {
      this.ponderPending.set(id, resolve);
      this.worker.postMessage({ type: "ponder", id, ...input });
      setTimeout(() => {
        if (this.ponderPending.delete(id)) {
          resolve(null);
        }
      }, input.budgetMs + 5000);
    });
  }

  terminate() {
    saveMemory(this.memory);
    this.worker.terminate();
    this.pending.clear();
  }
}

/**
 * 并行搜索池：模拟器「搜索推演」默认只用一个 worker，手机上只跑 1 核。
 * 这里按 CPU 核数开多个 worker，同一局面同时搜，取推演条数最多的结果，
 * 既能把多核跑满，也不会改变评分口径。
 */
const SEARCH_POOL_SIZE = Math.max(2, (navigator.hardwareConcurrency ?? 4) - 1);
let searchPool: SearchClient[] | null = null;

function getSearchPool(): SearchClient[] {
  if (!searchPool) {
    searchPool = Array.from({ length: SEARCH_POOL_SIZE }, () => new SearchClient());
  }
  return searchPool;
}

export async function searchParallel(input: SearchInput): Promise<SearchOutcome | null> {
  const outcomes = await Promise.all(getSearchPool().map((client) => client.search(input)));
  const usable = outcomes.filter((item): item is SearchOutcome => item !== null);
  if (usable.length === 0) {
    return null;
  }
  return usable.reduce((best, item) => (item.rollouts > best.rollouts ? item : best));
}

export function getPoolRememberedPositions() {
  return getSearchPool().reduce((sum, client) => sum + client.rememberedPositions, 0);
}
