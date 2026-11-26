/**
 * 牌组码的卡牌顺序规范：游戏内导出的码按「天赋 → 装备（武器/圣遗物）→ 支援 → 事件 → 料理」排列，
 * 同类按卡牌 id 升序。我们自己在 AI/随机生成后编码时也要先排好，否则出图和分享都会乱。
 */
export interface ActionCardLike {
  type?: string;
  tags?: string[];
}

const RANK = {
  talent: 0,
  equipment: 1,
  support: 2,
  event: 3,
  food: 4,
} as const;

export function cardOrderRank(card: ActionCardLike | undefined): number {
  const tags = card?.tags ?? [];
  if (tags.includes("GCG_TAG_TALENT")) {
    return RANK.talent;
  }
  if (tags.includes("GCG_TAG_WEAPON") || tags.includes("GCG_TAG_ARTIFACT")) {
    return RANK.equipment;
  }
  if (card?.type === "GCG_CARD_ASSIST") {
    return RANK.support;
  }
  if (tags.includes("GCG_TAG_FOOD")) {
    return RANK.food;
  }
  return RANK.event;
}

/** 返回排好序的新数组，不改动入参 */
export function sortCardsForShare<T>(
  cards: readonly number[],
  getCard: (id: number) => ActionCardLike | undefined,
): number[] {
  return [...cards].sort(
    (a, b) => cardOrderRank(getCard(a)) - cardOrderRank(getCard(b)) || a - b,
  );
}
