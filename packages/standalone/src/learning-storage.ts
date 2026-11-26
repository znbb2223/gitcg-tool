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

import { EXPERIENCE_SEED, mergeLearning, mergeLearningDedup } from "@gi-tcg/ai";
import type { MemoryEntry } from "@gi-tcg/ai";
import type {
  DecisionMemoryData,
  EvolutionGameRecord,
  LearningData,
} from "@gi-tcg/ai";
import { GAME_VERSION } from "@gi-tcg/ai";

const STORAGE_KEY = "gi-tcg-ai-learning-v1";

/**
 * 读经验：优先本地存档；没有（或样本比内置种子少）就用内置种子。
 * 内置种子是离线跑出来的经验，保证 AI 一开局就不是"白板"。
 */
function withVersion(learning: LearningData): LearningData {
  if (!learning.gameVersion) {
    learning.gameVersion = GAME_VERSION;
  }
  if (!learning.versions) {
    learning.versions = {
      [GAME_VERSION]: {
        games: learning.games,
        wins: 0,
        draws: 0,
      },
    };
  }
  return learning;
}

export function loadLearning(): LearningData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return withVersion(structuredClone(EXPERIENCE_SEED));
    }
    const parsed = JSON.parse(raw) as LearningData;
    if (parsed?.kind !== "gi-tcg-ai-learning" || parsed.version !== 1) {
      return withVersion(structuredClone(EXPERIENCE_SEED));
    }
    return withVersion(
      parsed.games >= EXPERIENCE_SEED.games
        ? parsed
        : structuredClone(EXPERIENCE_SEED),
    );
  } catch {
    return withVersion(structuredClone(EXPERIENCE_SEED));
  }
}

export function saveLearning(learning: LearningData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(learning));
  } catch {
    // 存不下就下次再说，训练结果在内存里仍然有效
  }
}

export function clearLearning() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const MEMORY_KEY = "gi-tcg-ai-memory-v1";

/** 读回决策记忆（复用过的局面） */
export function loadMemory(): DecisionMemoryData | null {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DecisionMemoryData;
    if (parsed?.kind !== "gi-tcg-ai-memory" || parsed.version !== 1) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveMemory(memory: DecisionMemoryData) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

const GAME_LOG_KEY = "gi-tcg-ai-game-log-v1";
/** 训练日志最多保留的局数，避免把 localStorage 塞爆 */
const GAME_LOG_LIMIT = 2000;

export function loadGameRecords(): EvolutionGameRecord[] {
  try {
    const raw = localStorage.getItem(GAME_LOG_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EvolutionGameRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendGameRecords(records: EvolutionGameRecord[]) {
  if (records.length === 0) {
    return;
  }
  try {
    const all = [...loadGameRecords(), ...records];
    const trimmed = all.slice(-GAME_LOG_LIMIT);
    localStorage.setItem(GAME_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // 写不进去就算了，控制台里还有
  }
}

/** 导出对局日志：学习数据 + 决策记忆 + 对局日志，便于继承或离线分析 */
export function exportExperience(): string {
  return JSON.stringify(
    {
      kind: "gi-tcg-ai-experience-bundle",
      version: 1,
      exportedAt: new Date().toISOString(),
      learning: loadLearning() ?? EXPERIENCE_SEED,
      memory: loadMemory(),
      games: loadGameRecords(),
    },
    null,
    1,
  );
}

/** 导入对局日志：学习数据合并、记忆取访问次数多的、日志追加并去重 */
export function importExperience(raw: string): { games: number; decks: number } {
  const parsed = JSON.parse(raw);
  if (parsed?.kind !== "gi-tcg-ai-experience-bundle") {
    throw new Error("不是对局日志文件");
  }
  const current = loadLearning() ?? EXPERIENCE_SEED;
  const merged = parsed.learning
    ? mergeLearningDedup(current, parsed.learning)
    : current;
  saveLearning(merged);

  const memory = loadMemory() ?? null;
  if (parsed.memory?.entries) {
    const target = memory ?? { kind: "gi-tcg-ai-memory", version: 1, entries: {} };
    for (const [key, entry] of Object.entries(
      parsed.memory.entries as Record<string, MemoryEntry>,
    )) {
      const existing = target.entries[key];
      if (!existing || existing.visits < entry.visits) {
        target.entries[key] = entry;
      }
    }
    saveMemory(target);
  }
  if (Array.isArray(parsed.games)) {
    appendGameRecords(parsed.games);
  }
  return { games: merged.games, decks: Object.keys(merged.decks ?? {}).length };
}
