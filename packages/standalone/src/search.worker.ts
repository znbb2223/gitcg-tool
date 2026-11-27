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
 * 搜索 worker：把"深想"放到后台线程，主线程不卡。
 * 主线程只需要把当前局面序列化（~12 KB）和这次的动作请求发过来。
 */

/// <reference lib="webworker" />

import getData from "@gi-tcg/data";
import { deserializeGameStateLog, type Version } from "@gi-tcg/core";
import type { ActionRequest } from "@gi-tcg/core";
import {
  createMemory,
  createMemoryAdapter,
  memoryKey,
  ponderPosition,
  searchBestAction,
  VALUE_NN,
  type DecisionMemoryData,
} from "@gi-tcg/ai";

interface SearchMessage {
  type: "search";
  id: number;
  version: string;
  who: 0 | 1;
  budgetMs: number;
  /** serializeGameStateLog 的 JSON 字符串 */
  stateLog: string;
  request: ActionRequest;
  heuristicScores?: Record<number, number>;
  perfectInformation?: boolean;
  valueMode?: "v1" | "v2";
  nnEnabled?: boolean;
  tableEnabled?: boolean;
  /** 只在第一次请求时传，之后 worker 自己记着 */
  memory?: DecisionMemoryData;
}

interface PonderMessage {
  type: "ponder";
  id: number;
  version: string;
  who: 0 | 1;
  budgetMs: number;
  stateLog: string;
  perfectInformation?: boolean;
}

let memoryData: DecisionMemoryData = createMemory();
let memoryReady = false;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (
  event: MessageEvent<SearchMessage | PonderMessage>,
) => {
  const message = event.data;
  if (message.type === "ponder") {
    try {
      const data = getData(message.version as Version);
      const state = deserializeGameStateLog(
        data,
        JSON.parse(message.stateLog),
      )[0].state;
      const result = await ponderPosition({
        data,
        state,
        who: message.who,
        budgetMs: message.budgetMs,
        // 查表数据目前随经验库下发，未装载时 tableValue 返回 null，不影响结果
        valueOptions: {
          mode: message.valueMode ?? "v2",
          nn: message.nnEnabled ? VALUE_NN : null,
          nnWeight: 0.45,
          table: null,
          tableWeight: message.tableEnabled ? 0.3 : 0,
        },
        maxActions: 16,
        perfectInformation: message.perfectInformation,
        // 后台胜率估算同样只按公开信息猜牌，否则读数虚高
        realisticHidden: true,
      });
      ctx.postMessage({
        type: "ponderResult",
        id: message.id,
        winRate: result.winRate,
        rollouts: result.rollouts,
      });
    } catch {
      ctx.postMessage({ type: "ponderResult", id: message.id, winRate: null });
    }
    return;
  }
  if (message.type !== "search") {
    return;
  }
  if (!memoryReady && message.memory) {
    memoryData = message.memory;
    memoryReady = true;
  }
  try {
    const data = getData(message.version as Version);
    const state = deserializeGameStateLog(
      data,
      JSON.parse(message.stateLog),
    )[0].state;
    const memory = createMemoryAdapter(memoryData);
    const key = memoryKey(message.stateLog, message.request);
    const result = await searchBestAction(message.request, {
      who: message.who,
      data,
      state,
      budgetMs: message.budgetMs,
      maxActions: 10,
      maxCandidates: 8,
      // 推演内部跳过动作预览：实测同等预算下 rollout 数 ×2~3，胜率 +13.9 点
      skipRolloutPreview: true,
      // 不再读取对手真实手牌/牌堆内容：按牌组库先验猜牌（A 方案）
      realisticHidden: true,
      memory,
      perfectInformation: message.perfectInformation,
      heuristicScores: message.heuristicScores
        ? new Map(Object.entries(message.heuristicScores).map(([k, v]) => [Number(k), v]))
        : undefined,
    });
    ctx.postMessage({
      type: "result",
      id: message.id,
      ok: true,
      chosenActionIndex: result.chosenActionIndex,
      usedDice: result.usedDice,
      rollouts: result.rollouts,
      elapsedMs: result.elapsedMs,
      candidates: result.candidates,
      cached: result.cached,
      memoryKey: key,
      memoryEntry: memoryData.entries[key] ?? null,
    });
  } catch (error) {
    ctx.postMessage({
      type: "result",
      id: message.id,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
