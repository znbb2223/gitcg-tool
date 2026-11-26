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
 * AI 组卡。
 *
 * 不自己发明规则：牌池、可用性、合法性都来自游戏自己的牌组数据
 * （`AssetsManager.getDeckData()`，也就是组卡器 UI 用的那一份），
 * 校验规则也和 `@gi-tcg/deck-builder` 保持一致：
 * - 3 张角色，不能重复；
 * - 30 张行动牌，同名最多 2 张；
 * - `GCG_TAG_LEGEND` / `GCG_TAG_CARD_BLESSING` 整副最多 1 张；
 * - 带 `relatedCharacterId` 的牌（天赋）要求队里有该角色；
 * - 带 `relatedCharacterTag` 的牌（元素共鸣）要求队里至少 2 个该标签角色。
 *
 * AI 只负责"在这套合法牌池里挑哪些、各几张"。
 */

import type { Deck } from "@gi-tcg/typings";
import type {
  DeckData,
  DeckDataActionCardInfo,
  DeckDataCharacterInfo,
} from "@gi-tcg/assets-manager";
import { DECK_LIBRARY, type LibraryDeck } from "./data/deck-library";

const DECK_SIZE = 30;
const MAX_COPIES = 2;
/** 与 deck-builder 的 SINGLETON_REQUIRED_TAGS 一致 */
const SINGLETON_TAGS = ["GCG_TAG_LEGEND", "GCG_TAG_CARD_BLESSING"];
/** 角色卡上的元素标签，用来判断能不能凑元素共鸣 */
const ELEMENT_TAG_PREFIX = "GCG_TAG_ELEMENT_";

export interface DeckBuildOptions {
  deckData: DeckData;
  /** 社区牌组库；不传就用内置的（米游社公开帖抓的） */
  library?: readonly LibraryDeck[];
  /** 直接照搬社区牌组的概率，默认 0.35 */
  copyProbability?: number;
  /** 只在牌组库里挑，不自己组 */
  copyOnly?: boolean;
  /** 牌组胜率（deckKey → 0~1），用来决定"照搬哪套" */
  deckWinRates?: ReadonlyMap<string, number>;
  /** 照搬后微调 1~3 张（创新变体）的概率，默认 0.25 */
  mutateProbability?: number;
  /** 牌组强度偏好：strong=挑赢过的，weak=挑没怎么赢过的，random=随机 */
  deckStrength?: "strong" | "weak" | "random";
  seed?: number;
  /** 学习得到的卡牌偏好（definitionId → 权重，默认 1） */
  cardWeights?: ReadonlyMap<number, number>;
  /** 学习得到的角色偏好 */
  characterWeights?: ReadonlyMap<number, number>;
  log?: (message: string) => void;
}

export interface DeckValidation {
  valid: boolean;
  errors: string[];
}

function isSingleton(card: DeckDataActionCardInfo) {
  return SINGLETON_TAGS.some((tag) => card.tags.includes(tag));
}

/** 这张牌能不能进这套队伍（与组卡器 UI 的过滤逻辑一致） */
export function fitsDeck(
  card: DeckDataActionCardInfo,
  characters: readonly DeckDataCharacterInfo[],
) {
  if (card.relatedCharacterId !== null) {
    return characters.some((character) => character.id === card.relatedCharacterId);
  }
  if (card.relatedCharacterTag !== null) {
    return (
      characters.filter((character) =>
        character.tags.includes(card.relatedCharacterTag!),
      ).length >= 2
    );
  }
  return true;
}

/** 元素标签，例如 "GCG_TAG_ELEMENT_PYRO" */
function elementTagOf(character: DeckDataCharacterInfo) {
  return character.tags.find((tag) => tag.startsWith(ELEMENT_TAG_PREFIX)) ?? null;
}

function pickCharacters(
  characters: DeckDataCharacterInfo[],
  weights: ReadonlyMap<number, number> | undefined,
  rng: () => number,
) {
  const score = (character: DeckDataCharacterInfo) =>
    (weights?.get(character.id) ?? 1) + rng() * 0.5;
  const ranked = [...characters].sort((a, b) => score(b) - score(a));
  const first = ranked[0];
  const element = elementTagOf(first);
  // 优先凑同元素（能吃元素共鸣），凑不到就用第二、第三顺位
  const partner =
    ranked.find(
      (candidate) =>
        candidate.id !== first.id && elementTagOf(candidate) === element,
    ) ?? ranked.find((candidate) => candidate.id !== first.id);
  const third = ranked.find(
    (candidate) => candidate.id !== first.id && candidate.id !== partner?.id,
  );
  return [first, partner, third].filter(
    (character): character is DeckDataCharacterInfo => Boolean(character),
  );
}

/** 牌组指纹，与 learner.deckKey 保持一致 */
function deckKeyOf(deck: { characters: number[]; cards: number[] }) {
  return `${deck.characters.join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`;
}

/**
 * 在现有牌组上换掉 1~3 张牌（保持 30 张与合法性）。
 * 这是"创新"的来源：强牌组的局部变异。
 */
export function mutateDeck(
  deck: Deck,
  deckData: DeckData,
  rng: () => number,
): { deck: Deck; changed: number } {
  const characters = deck.characters
    .map((id) => deckData.characters.get(id))
    .filter((character): character is DeckDataCharacterInfo => Boolean(character));
  const pool = [...deckData.actionCards.values()].filter((card) =>
    fitsDeck(card, characters),
  );
  const cards = [...deck.cards];
  const countOf = (id: number) => cards.filter((c) => c === id).length;
  let changed = 0;
  const tries = 1 + Math.floor(rng() * 3);
  for (let t = 0; t < tries; t++) {
    const index = Math.floor(rng() * cards.length);
    const candidate = pool[Math.floor(rng() * pool.length)];
    if (
      countOf(candidate.id) >= MAX_COPIES ||
      isSingleton(candidate) && countOf(candidate.id) >= 1 ||
      cards[index] === candidate.id
    ) {
      continue;
    }
    cards[index] = candidate.id;
    changed += 1;
  }
  return { deck: { characters: deck.characters, cards }, changed };
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 默认权重：便宜的事件牌与装备牌更泛用 */
function defaultWeight(card: DeckDataActionCardInfo) {
  const base =
    card.type === "GCG_CARD_MODIFY" ? 1.2 : card.type === "GCG_CARD_ASSIST" ? 1.15 : 1.0;
  return base + (card.diceCost <= 1 ? 0.1 : 0) - card.diceCost * 0.02;
}

/**
 * 生成一副合法牌组：按学到的权重挑 3 个角色，再按权重把 30 张填满。
 */
export function buildDeck(options: DeckBuildOptions): Deck {
  const { deckData } = options;
  const rng = createRng(options.seed ?? 1);
  const log = options.log ?? (() => {});
  const characters = [...deckData.characters.values()];
  const cards = [...deckData.actionCards.values()];

  // 有时候直接照搬社区牌组（打法也一起记在库里）
  const library = options.library ?? DECK_LIBRARY;
  const copyProbability = options.copyOnly ? 1 : (options.copyProbability ?? 0.35);
  if (library.length > 0 && rng() < copyProbability) {
    // 按历史胜率加权选一套社区牌组（没打过的按 0.5 探索）
    const strength = options.deckStrength ?? "strong";
    const weighted = library.map((deck) => {
      const rate = options.deckWinRates?.get(deckKeyOf(deck)) ?? 0.5;
      const weight =
        strength === "weak" ? 1.05 - rate : strength === "random" ? 1 : rate;
      return { deck, weight: Math.max(weight, 0.01) };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let target = rng() * total;
    const picked =
      weighted.find((item) => {
        target -= item.weight;
        return target <= 0;
      })?.deck ?? library[0];
    log(`照搬社区牌组：${picked.subject || picked.id}`);
    const copied: Deck = {
      characters: [...picked.characters],
      cards: [...picked.cards],
    };
    // 有时候在照搬的基础上改 1~3 张，制造新变体去测
    if (rng() < (options.mutateProbability ?? 0.25)) {
      const mutated = mutateDeck(copied, deckData, rng);
      log(`  微调 ${mutated.changed} 张，形成新变体`);
      return mutated.deck;
    }
    return copied;
  }

  const team = pickCharacters(characters, options.characterWeights, rng);
  const weakDeck = options.deckStrength === "weak";
  const weightOf = (card: DeckDataActionCardInfo) => {
    const base = options.cardWeights?.get(card.id) ?? defaultWeight(card) + 1;
    return (weakDeck ? 1.6 - Math.min(base, 1.5) : base) + rng() * 0.2;
  };

  const picked: number[] = [];
  const counts = new Map<number, number>();
  const add = (id: number, copies: number) => {
    for (let i = 0; i < copies; i++) {
      if (picked.length >= DECK_SIZE) {
        return;
      }
      const used = counts.get(id) ?? 0;
      if (used >= MAX_COPIES) {
        return;
      }
      picked.push(id);
      counts.set(id, used + 1);
    }
  };

  const legal = cards.filter((card) => fitsDeck(card, team));

  // 秘传/祝福牌：规则上可以带多张，但一局只能打出 1 张，多带等于占位，
  // 所以组牌时只挑 1~2 种、每种 1 张（软约束，不是非法）
  const singletons = legal
    .filter(isSingleton)
    .sort((a, b) => weightOf(b) - weightOf(a))
    .slice(0, picked.length + 25 >= DECK_SIZE ? 2 : 1);

  // 天赋牌：只带队里角色的
  const talents = legal
    .filter((card) => card.relatedCharacterId !== null)
    .sort((a, b) => weightOf(b) - weightOf(a));

  const rest = legal
    .filter((card) => !isSingleton(card))
    .sort((a, b) => weightOf(b) - weightOf(a));

  // 1. 每个角色的天赋牌各带 2 张
  const takenCharacters = new Set<number>();
  for (const talent of talents) {
    if (picked.length >= DECK_SIZE) {
      break;
    }
    if (takenCharacters.has(talent.relatedCharacterId!)) {
      continue;
    }
    takenCharacters.add(talent.relatedCharacterId!);
    add(talent.id, MAX_COPIES);
  }

  // 2. 秘传/祝福牌：每种 1 张
  for (const card of singletons) {
    add(card.id, 1);
  }

  // 3. 其余按权重填满
  for (const card of rest) {
    if (picked.length >= DECK_SIZE) {
      break;
    }
    add(card.id, MAX_COPIES);
  }

  const deck: Deck = {
    characters: team.map((character) => character.id),
    cards: picked,
  };
  log(
    `组卡完成：${deck.characters.join("/")} + ${deck.cards.length} 张`,
  );
  return deck;
}

/**
 * 随机但合法的牌组。
 * 规则照抄 `@gi-tcg/deck-builder` 的 `generateRandomDeck`：
 * 3 个随机角色，天赋/共鸣按角色过滤，秘传只放一张。
 */
export function randomDeck(deckData: DeckData, seed = Date.now()): Deck {
  const rng = createRng(seed);
  const characters = shuffle([...deckData.characters.values()], rng).slice(0, 3);
  const pool = shuffle(
    [...deckData.actionCards.values()].filter((card) => fitsDeck(card, characters)),
    rng,
  ).flatMap((card) => (isSingleton(card) ? [card] : [card, card]));

  const cards: number[] = [];
  while (cards.length < DECK_SIZE && pool.length > 0) {
    cards.push(pool.pop()!.id);
  }
  return { characters: characters.map((character) => character.id), cards };
}

/** 校验牌组合法性（规则与组卡器一致） */
export function validateDeck(deck: Deck, deckData: DeckData): DeckValidation {
  const errors: string[] = [];
  if (deck.characters.length !== 3) {
    errors.push(`角色牌必须是 3 张，当前 ${deck.characters.length} 张`);
  }
  if (new Set(deck.characters).size !== deck.characters.length) {
    errors.push("角色牌重复");
  }
  const team = deck.characters
    .map((id) => deckData.characters.get(id))
    .filter((character): character is DeckDataCharacterInfo =>
      Boolean(character),
    );
  if (team.length !== deck.characters.length) {
    errors.push("存在数据里不存在的角色");
  }
  if (deck.cards.length !== DECK_SIZE) {
    errors.push(`行动牌必须是 ${DECK_SIZE} 张，当前 ${deck.cards.length} 张`);
  }

  const counts = new Map<number, number>();
  for (const id of deck.cards) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    const card = deckData.actionCards.get(id);
    if (!card) {
      errors.push(`行动牌 ${id} 不存在`);
      continue;
    }
    if (!fitsDeck(card, team)) {
      errors.push(`${id} 与队伍不匹配（天赋角色/元素共鸣）`);
    }
  }
  for (const [id, count] of counts) {
    const card = deckData.actionCards.get(id);
    if (count > MAX_COPIES) {
      errors.push(`${id} 超过 ${MAX_COPIES} 张`);
    }
    // 秘传/祝福牌：整副可以带多张，只是对局里只能打出 1 张，不属于组牌非法
  }
  return { valid: errors.length === 0, errors };
}

/**
 * 按牌组标签推断打法风格（社区牌组的 tags / strategy 已经存进库里）。
 * 快攻抢血、控制苟活、其余按中速处理。
 */
export function styleOfDeck(deck: Deck): "aggro" | "midrange" | "control" {
  const key = deckKeyOf(deck);
  const entry = DECK_LIBRARY.find((item) => deckKeyOf(item) === key);
  const text = [entry?.subject ?? "", ...(entry?.tags ?? []), entry?.strategy ?? ""].join(" ");
  if (/(快攻|速攻|otk|爆发|抢血|两回合)/i.test(text)) {
    return "aggro";
  }
  if (/(控制|回血|防守|苟|中慢速|运营)/i.test(text)) {
    return "control";
  }
  return "midrange";
}
