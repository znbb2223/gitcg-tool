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
 * 后台训练 worker：两个 AI 在代码层面快速自我对弈，不渲染任何棋盘。
 * 主线程只收到进度（局数）和经验规模，用来画进度条。
 */

/// <reference lib="webworker" />

import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { CURRENT_VERSION, type Version } from "@gi-tcg/core";
import {
  createLearning,
  runEvolution,
  type EvolutionMode,
  type LearningData,
} from "@gi-tcg/ai";

interface StartMessage {
  type: "start";
  games: number;
  mode: EvolutionMode;
  learning: LearningData | null;
  seed?: number;
  version?: string;
  information?: "fair" | "perfect";
  useSearch?: boolean;
  searchBudgetMs?: number;
}

interface StopMessage {
  type: "stop";
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let stopping = false;

ctx.onmessage = async (event: MessageEvent<StartMessage | StopMessage>) => {
  const message = event.data;
  if (message.type === "stop") {
    stopping = true;
    return;
  }
  if (message.type !== "start") {
    return;
  }
  stopping = false;
  const data = getData((message.version ?? CURRENT_VERSION) as Version);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const learning = message.learning ?? createLearning();
  const result = await runEvolution({
    data,
    deckData,
    games: message.games,
    mode: message.mode,
    information: message.information,
    useSearch: message.useSearch,
    searchBudgetMs: message.searchBudgetMs,
    seed: message.seed,
    learning,
    shouldStop: () => stopping,
    onGame: (record) => {
      ctx.postMessage({ type: "game", record });
    },
    onProgress: (progress) => {
      ctx.postMessage({
        type: "progress",
        done: progress.done,
        total: progress.total,
        games: learning.games,
        cards: Object.keys(learning.cards).length,
        characters: Object.keys(learning.characters).length,
        // 每 10 局回传一次经验快照，主线程顺手存进 localStorage
        learning: progress.done % 10 === 0 ? learning : undefined,
      });
    },
  });
  ctx.postMessage({ type: "done", learning: result });
};
