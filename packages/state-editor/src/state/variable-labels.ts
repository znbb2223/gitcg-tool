/**
 * 状态变量的中文说明。名字来自游戏内部字段（exp / stage5 / usagePerRound…），
 * 直接显示对普通用户没有意义，这里统一翻成看得懂的中文。
 * 未收录的变量会显示「{字段名}（内部变量）」。
 */
export const VARIABLE_LABELS: Record<string, string> = {
  // 通用
  usage: "剩余可用次数",
  usagePerRound: "每回合可用次数",
  usages: "剩余可用次数",
  count: "层数 / 数量",
  stack: "叠加层数",
  stacks: "叠加层数",
  level: "等级",
  exp: "经验值",
  shield: "护盾值",
  health: "生命值",
  hp: "生命值",
  maxHealth: "生命上限",
  maxHp: "生命上限",
  energy: "充能值",
  maxEnergy: "充能上限",
  energyMax: "充能上限",
  dice: "骰子数",
  cost: "费用",
  round: "回合数",
  rounds: "回合数",
  duration: "持续回合",
  turn: "回合",
  turns: "回合数",
  damage: "伤害值",
  heal: "治疗量",
  healed: "已治疗量",
  draw: "抽牌数",
  card: "卡牌",
  cards: "卡牌数",
  // 召唤物 / 状态
  shouldHeal: "是否触发治疗（0 否 / 1 是）",
  shouldDamage: "是否触发伤害（0 否 / 1 是）",
  shouldTrigger: "是否触发（0 否 / 1 是）",
  triggerCount: "已触发次数",
  maxUsage: "最大可用次数",
  // 特定状态（自体重/塔类）
  stage5: "阶段 5 进度",
  stage12: "阶段 12 进度",
  stage: "当前阶段",
  phase: "当前阶段",
  progress: "进度",
  point: "点数",
  points: "点数",
  mark: "标记层数",
  marks: "标记层数",
  stackCount: "叠加层数",
  // 角色状态常见
  skillUsage: "技能可用次数",
  skillUsed: "技能已用次数",
  talentUsed: "天赋已用",
  passiveUsed: "被动已触发",
  revived: "已复活标记",
  deathMark: "死亡标记",
  // 元素相关
  aura: "元素附着",
  element: "元素",
  applyElement: "附着元素",
  // 牌库/手牌
  handCount: "手牌数",
  pileCount: "牌库数",
};

export function variableLabel(key: string) {
  const label = VARIABLE_LABELS[key];
  return label ? `${label}` : `${key}（内部变量）`;
}

export function variableHint(key: string) {
  return VARIABLE_LABELS[key] ? key : "";
}
