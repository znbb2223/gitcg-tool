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
 * AI 的"经验记忆"。
 *
 * 不是神经网络，而是最朴素、可解释、可持久化的统计学习：
 * 每打完一局，把胜负记到该局双方用到的每张牌 / 每个角色头上；
 * 组卡时按平滑后的胜率 + 探索加成挑牌——带得越少越探索，赢得多越爱带。
 * 这样自我对弈几百局之后，卡池里"能赢的牌"会自然浮上来。
 */

import type { Deck } from "@gi-tcg/typings";

export interface LearningEntry {
  games: number;
  wins: number;
  draws: number;
}

/** 一副具体牌组的长期战绩 */
export interface DeckRecord {
  characters: number[];
  cards: number[];
  games: number;
  wins: number;
  draws: number;
  /** 来源：社区库/自组 */
  origin?: "library" | "built";
  subject?: string;
  tags?: string[];
  strategies?: string;
  updatedAt: number;
}

/** 当前卡池/平衡性版本；换版本后经验库要分桶统计 */
export const GAME_VERSION = "7.2.0";

export interface VersionRecord {
  games: number;
  wins: number;
  draws: number;
}

export interface GameLogEntry {
  a: number[];
  b: number[];
  w: 0 | 1 | null;
  at: number;
}

export interface LearningData {
  kind: "gi-tcg-ai-learning";
  version: 1;
  /** 去重用的对局流水（可能缺省，老存档没有） */
  gameLog?: GameLogEntry[];
  /** 这份经验主要来自哪个版本（最近一次写入的版本） */
  gameVersion?: string;
  /** 按版本分桶的战绩，换版本后可对比新旧环境 */
  versions?: Record<string, VersionRecord>;
  /** 累计自我对弈局数 */
  games: number;
  cards: Record<string, LearningEntry>;
  characters: Record<string, LearningEntry>;
  /** 整副牌组的战绩（key = 牌组指纹），用来指导以后"照搬哪套"和"哪套强" */
  decks: Record<string, DeckRecord>;
  updatedAt: number;
}

export function createLearning(): LearningData {
  return {
    kind: "gi-tcg-ai-learning",
    version: 1,
    gameVersion: GAME_VERSION,
    versions: { [GAME_VERSION]: { games: 0, wins: 0, draws: 0 } },
    games: 0,
    cards: {},
    characters: {},
    decks: {},
    updatedAt: Date.now(),
  };
}

function bump(
  bucket: Record<string, LearningEntry>,
  id: number,
  result: { win: boolean; draw: boolean },
) {
  const entry = bucket[id] ?? { games: 0, wins: 0, draws: 0 };
  entry.games += 1;
  entry.wins += result.win ? 1 : 0;
  entry.draws += result.draw ? 1 : 0;
  bucket[id] = entry;
}

/** 牌组指纹：角色 + 排序后的卡牌 */
export function deckKey(deck: Deck): string {
  return `${deck.characters.join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`;
}

/** 记录一局的结果（双方牌组都会计入） */
export function recordGame(
  learning: LearningData,
  decks: readonly [Deck, Deck],
  winner: 0 | 1 | null,
): LearningData {
  decks.forEach((deck, who) => {
    const result = {
      win: winner === who,
      draw: winner === null,
    };
    for (const card of deck.cards) {
      bump(learning.cards, card, result);
    }
    for (const character of deck.characters) {
      bump(learning.characters, character, result);
    }
  });
  decks.forEach((deck, who) => {
    const key = deckKey(deck);
    const record = learning.decks[key] ?? {
      characters: [...deck.characters],
      cards: [...deck.cards],
      games: 0,
      wins: 0,
      draws: 0,
      updatedAt: 0,
    };
    record.games += 1;
    record.wins += winner === who ? 1 : 0;
    record.draws += winner === null ? 1 : 0;
    record.updatedAt = Date.now();
    learning.decks[key] = record;
  });
  learning.gameLog ??= [];
  learning.gameLog.push({
    a: [...decks[0].characters, ...decks[0].cards],
    b: [...decks[1].characters, ...decks[1].cards],
    w: winner,
    at: Date.now(),
  });
  if (learning.gameLog.length > 20000) {
    learning.gameLog.splice(0, learning.gameLog.length - 20000);
  }
  learning.games += 1;
  learning.updatedAt = Date.now();
  learning.gameVersion = GAME_VERSION;
  const versionRecord = (learning.versions ??= {})[GAME_VERSION] ?? {
    games: 0,
    wins: 0,
    draws: 0,
  };
  versionRecord.games += 1;
  versionRecord.wins += winner === 0 ? 1 : 0;
  versionRecord.draws += winner === null ? 1 : 0;
  learning.versions[GAME_VERSION] = versionRecord;
  return learning;
}

/**
 * 平滑胜率 + 探索加成。
 * 没见过的牌给 0.55（略高于平均，鼓励试新）；样本越多越相信统计值。
 */
function weightOf(entry: LearningEntry | undefined, baseline: number) {
  if (!entry || entry.games === 0) {
    return baseline + 0.05;
  }
  const rate = (entry.wins + 2) / (entry.games + 4);
  const explore = 0.3 / Math.sqrt(1 + entry.games);
  return rate + explore;
}

export function cardWeights(learning: LearningData): Map<number, number> {
  return new Map(
    Object.entries(learning.cards).map(([id, entry]) => [
      Number(id),
      weightOf(entry, 0.5),
    ]),
  );
}

export function characterWeights(learning: LearningData): Map<number, number> {
  return new Map(
    Object.entries(learning.characters).map(([id, entry]) => [
      Number(id),
      weightOf(entry, 0.5),
    ]),
  );
}

/** 给人类看的"总结"：哪些牌赢得多、哪些是坑 */
export function summarizeLearning(
  learning: LearningData,
  minGames = 3,
): string {
  const ranked = Object.entries(learning.cards)
    .map(([id, entry]) => ({
      id: Number(id),
      games: entry.games,
      rate: entry.wins / Math.max(entry.games, 1),
    }))
    .filter((entry) => entry.games >= minGames)
    .sort((a, b) => b.rate - a.rate);
  if (ranked.length === 0) {
    return `还没有足够样本（当前 ${learning.games} 局自我对弈）。`;
  }
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(-5).reverse();
  const fmt = (entry: { id: number; games: number; rate: number }) =>
    `${entry.id}（${(entry.rate * 100).toFixed(0)}% / ${entry.games} 局）`;
  return [
    `共 ${learning.games} 局自我对弈，涉及 ${ranked.length} 种行动牌。`,
    `最常赢：${top.map(fmt).join("、")}`,
    `最常输：${bottom.map(fmt).join("、")}`,
  ].join("\n");
}

/** localStorage / 文件都能放：合并两份经验 */
/** 牌组胜率（平滑后），用来给"照搬"排序 */
export function deckWinRate(learning: LearningData, key: string): number | null {
  const record = learning.decks[key];
  if (!record || record.games === 0) {
    return null;
  }
  return (record.wins + 1) / (record.games + 2);
}

/** 给"组卡总结"用的文字：哪些组合赢得多、哪些牌赢得多 */
export function summarizeDecks(learning: LearningData, minGames = 2): string {
  const decks = Object.entries(learning.decks)
    .map(([key, record]) => ({
      key,
      ...record,
      rate: record.wins / Math.max(record.games - record.draws, 1),
    }))
    .filter((deck) => deck.games >= minGames)
    .sort((a, b) => b.rate - a.rate);
  if (decks.length === 0) {
    return `还没有足够的牌组样本（当前 ${learning.games} 局）。`;
  }
  // 角色组合的胜率：看"哪些搭配能赢"
  const pairs = new Map<string, { games: number; wins: number }>();
  for (const deck of decks) {
    const chars = [...deck.characters].sort((a, b) => a - b);
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const key = `${chars[i]}+${chars[j]}`;
        const entry = pairs.get(key) ?? { games: 0, wins: 0 };
        entry.games += deck.games;
        entry.wins += deck.wins;
        pairs.set(key, entry);
      }
    }
  }
  const rankedPairs = [...pairs.entries()]
    .filter(([, value]) => value.games >= minGames)
    .map(([key, value]) => ({ key, rate: value.wins / value.games, games: value.games }))
    .sort((a, b) => b.rate - a.rate);
  const topDecks = decks.slice(0, 5).map(
    (deck) =>
      `${deck.characters.join("/")}（${(deck.rate * 100).toFixed(0)}% / ${deck.games} 局${deck.origin === "library" ? " · 社区" : ""}）`,
  );
  const topPairs = rankedPairs.slice(0, 5).map(
    (pair) => `${pair.key}（${(pair.rate * 100).toFixed(0)}%）`,
  );
  return [
    `共记录 ${decks.length} 副牌组 / ${learning.games} 局。`,
    `最强牌组：${topDecks.join("、")}`,
    `最强双人组合：${topPairs.join("、")}`,
  ].join("\n");
}

export function mergeLearning(
  a: LearningData,
  b: LearningData,
): LearningData {
  const merged = createLearning();
  merged.games = a.games + b.games;
  for (const [key, record] of [
    ...Object.entries(a.decks ?? {}),
    ...Object.entries(b.decks ?? {}),
  ]) {
    const current = merged.decks[key] ?? {
      characters: record.characters,
      cards: record.cards,
      games: 0,
      wins: 0,
      draws: 0,
      updatedAt: 0,
    };
    current.games += record.games;
    current.wins += record.wins;
    current.draws += record.draws;
    merged.decks[key] = current;
  }
  for (const bucket of ["cards", "characters"] as const) {
    for (const [id, entry] of [
      ...Object.entries(a[bucket]),
      ...Object.entries(b[bucket]),
    ]) {
      const current = merged[bucket][id] ?? { games: 0, wins: 0, draws: 0 };
      current.games += entry.games;
      current.wins += entry.wins;
      current.draws += entry.draws;
      merged[bucket][id] = current;
    }
  }
  return merged;
}


function logKey(entry: GameLogEntry): string {
  return `${entry.a.join(",")}|${entry.b.join(",")}|${entry.w}|${entry.at}`;
}

/**
 * 去重合并两份经验。
 * - 双方都有对局流水时：按流水并集重算，绝不重复计数；
 * - 只有聚合数据（老版本导出）时：按牌组指纹取 max，避免简单相加翻倍。
 */
export function mergeLearningDedup(
  a: LearningData,
  b: LearningData,
): LearningData {
  const logs = new Map<string, GameLogEntry>();
  for (const entry of [...(a.gameLog ?? []), ...(b.gameLog ?? [])]) {
    logs.set(logKey(entry), entry);
  }
  if (logs.size > 0) {
    const merged = createLearning();
    for (const entry of logs.values()) {
      const deckA: Deck = {
        characters: entry.a.slice(0, 3),
        cards: entry.a.slice(3),
      };
      const deckB: Deck = {
        characters: entry.b.slice(0, 3),
        cards: entry.b.slice(3),
      };
      recordGame(merged, [deckA, deckB], entry.w);
      const last = merged.gameLog![merged.gameLog!.length - 1];
      last.at = entry.at;
    }
    merged.gameVersion = a.gameVersion ?? b.gameVersion ?? merged.gameVersion;
    return merged;
  }

  // 无流水：保守取并集，每个 key 取较大的样本数
  const merged = createLearning();
  for (const bucket of ["cards", "characters"] as const) {
    const keys = new Set([
      ...Object.keys(a[bucket]),
      ...Object.keys(b[bucket]),
    ]);
    for (const key of keys) {
      const x = a[bucket][key];
      const y = b[bucket][key];
      const games = Math.max(x?.games ?? 0, y?.games ?? 0);
      const wins =
        (x?.games ?? 0) >= (y?.games ?? 0) ? x?.wins ?? 0 : y?.wins ?? 0;
      const draws =
        (x?.games ?? 0) >= (y?.games ?? 0) ? x?.draws ?? 0 : y?.draws ?? 0;
      merged[bucket][key] = { games, wins, draws };
    }
  }
  const deckKeys = new Set([
    ...Object.keys(a.decks ?? {}),
    ...Object.keys(b.decks ?? {}),
  ]);
  for (const key of deckKeys) {
    const x = a.decks?.[key];
    const y = b.decks?.[key];
    const base = (x?.games ?? 0) >= (y?.games ?? 0) ? x : y;
    if (base) {
      merged.decks[key] = { ...base, updatedAt: Math.max(x?.updatedAt ?? 0, y?.updatedAt ?? 0) };
    }
  }
  merged.games = Math.max(a.games, b.games);
  merged.gameVersion = a.gameVersion ?? b.gameVersion;
  merged.versions = { ...(a.versions ?? {}), ...(b.versions ?? {}) };
  return merged;
}
