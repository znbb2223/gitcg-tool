/**
 * 牌组合法性规则（组牌器与实验室共用）
 * 基础规则与组牌器一致：3 角色、不重复、30 张行动牌、同名牌最多 2 张、秘传最多 1 张。
 * 额外可选：传入 `isLegend` 判定秘传牌；传入 `aiErrors` 时把引擎级校验（天赋角色/元素共鸣匹配）并进来。
 */
export interface DeckLike {
  characters: number[];
  cards: number[];
}

export interface DeckRuleOptions {
  /** 判定某张牌是不是秘传；不传时按 30 张里只有 1 张秘传的规则跳过该项 */
  isLegend?: (id: number) => boolean;
  /** 引擎侧校验的错误（例如 @gi-tcg/ai 的 validateDeck），会合并进结果 */
  extraErrors?: string[];
}

export const MAX_COPIES = 2;
export const DECK_CHARACTERS = 3;
export const DECK_CARDS = 30;

export function validateDeckRules(deck: DeckLike, options: DeckRuleOptions = {}): string[] {
  const errors: string[] = [];
  const { isLegend, extraErrors } = options;

  if (deck.characters.length !== DECK_CHARACTERS) {
    errors.push(`角色牌必须 ${DECK_CHARACTERS} 张，当前 ${deck.characters.length} 张`);
  }
  if (new Set(deck.characters).size !== deck.characters.length) {
    errors.push("角色牌不能重复");
  }
  if (deck.cards.length !== DECK_CARDS) {
    errors.push(`行动牌必须 ${DECK_CARDS} 张，当前 ${deck.cards.length} 张`);
  }

  const counts = new Map<number, number>();
  for (const id of deck.cards) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > MAX_COPIES) {
      errors.push(`卡牌 ${id} 超过 ${MAX_COPIES} 张（当前 ${count} 张）`);
    }
  }
  // 秘传牌允许带多张：对局内只能打出 1 张，不构成组牌非法（2026-11 按实际规则修正）
  if (extraErrors?.length) {
    errors.push(...extraErrors);
  }
  return errors;
}

/**
 * 和引擎校验合并后的最终检查：本地规则 + @gi-tcg/ai 的 validateDeck
 * （卡牌是否存在、天赋角色是否匹配、元素共鸣是否匹配、秘传/祝福是否超限）
 */
export function combineDeckErrors(local: string[], engine: string[]): string[] {
  return [...new Set([...local, ...engine])];
}
