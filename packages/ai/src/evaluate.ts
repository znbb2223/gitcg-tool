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
 * 一个"看着能打"的启发式评估器。
 *
 * 引擎在 `rpc("action")` 里会把所有候选动作连同样式化的结算预览（preview）
 * 一起发过来，所以 AI 不需要真的把局面模拟一遍——直接读预览里的伤害、
 * 击杀、元素反应就能做出相当合理的决策。
 */

import { CARD_PRIORS, CHARACTER_PRIORS } from "./data/experience-priors";
import {
  PbDamageType,
  PbDiceRequirementType,
  PbModifyDirection,
  type Action,
  type DiceRequirement,
  type PbGameState,
} from "@gi-tcg/typings";

/** 一次动作对某个护盾的影响：吸掉多少层、有没有直接打碎 */
export interface ShieldHit {
  chip: number;
  broken: number;
}

export interface PreviewSummary {
  /** 对敌方角色造成的伤害总和（已扣过护盾/减伤，引擎预览给的就是结算后的值） */
  damage: number;
  /** 预览中直接击杀的敌方角色数 */
  kills: number;
  /** 触发元素反应的次数 */
  reactions: number;
  /** 敌方身上的负面变化（挂元素、生成负面实体）估计值 */
  debuffs: number;
  /** 自己这边新增的实体（召唤物/支援/装备等）数量 */
  created: number;
  /** 自己的回复量 */
  healed: number;
  /** 敌方护盾的消耗，按护盾牌定义 id 分组——判断这面盾会不会自己消失得查数据 */
  shieldHits: Map<number, ShieldHit>;
  /** 我方新获得的护盾点数 */
  shieldGain: number;
  /** 穿透伤害量：无视护盾与减伤，对面叠盾时格外值钱 */
  piercing: number;
}

/** 引擎里 `shield N` 属性写的就是这个变量，护盾被消耗时它按 DECREASE 变化 */
const SHIELD_VAR_NAME = "shield";

/** 牌库里只要带这些变量，护盾就会自己消失（回合结束或次数用尽），不用急着拆 */
const TEMPORARY_SHIELD_VARS = ["duration", "usage"];

/** 只用到"按 id 查实体定义"的能力，避免把整个 GameData 拖进评分器 */
export interface ShieldDataSource {
  entities: {
    get(definitionId: number): { varConfigs?: Record<string, unknown> } | undefined;
  };
}

/** 护盾实体 id → 归属玩家；预览里的变量变化只带 entityId，得靠局面反查是谁的盾 */
function collectShieldOwners(state: PbGameState): Map<number, 0 | 1> {
  const owners = new Map<number, 0 | 1>();
  for (const who of [0, 1] as const) {
    const player = state.player[who];
    if (!player) {
      continue;
    }
    const entities = [
      ...player.character.flatMap((character) => character.entity),
      ...player.combatStatus,
    ];
    for (const entity of entities) {
      if (entity.variableName === SHIELD_VAR_NAME) {
        owners.set(entity.id, who);
      }
    }
  }
  return owners;
}

/** 某个玩家当前生效的护盾总层数（角色身上的 + 出战状态上的） */
function totalShieldOf(player: PbGameState["player"][number]): number {
  const shields = [
    ...player.character.flatMap((character) => character.entity),
    ...player.combatStatus,
  ].filter((entity) => entity.variableName === SHIELD_VAR_NAME);
  return shields.reduce((sum, entity) => sum + (entity.variableValue ?? 0), 0);
}

/**
 * 这面盾会不会自己消失。钟离「玉璋护盾」这类只有 `shield` 变量的盾，
 * 只能打到 0 才消失；带 duration/usage 的盾会自己到期，拆它就没那么值钱。
 * 没有牌库数据时按"只能打破"处理（当前版本数据里 29 面盾全是这种）。
 */
function isTemporaryShield(
  data: ShieldDataSource | undefined,
  definitionId: number,
): boolean {
  const variables = data?.entities.get(definitionId)?.varConfigs;
  return variables
    ? TEMPORARY_SHIELD_VARS.some((name) =>
        Object.keys(variables).some((key) => key.startsWith(name)),
      )
    : false;
}

function bumpShieldHit(
  hits: Map<number, ShieldHit>,
  definitionId: number,
  chip: number,
  broken: number,
): Map<number, ShieldHit> {
  const previous = hits.get(definitionId) ?? { chip: 0, broken: 0 };
  const next = new Map(hits);
  next.set(definitionId, {
    chip: previous.chip + chip,
    broken: previous.broken + broken,
  });
  return next;
}

/** 训练出的人类胜率先验；缺数据返回 null */
export function cardPrior(cardId: number): number | null {
  return CARD_PRIORS[cardId] ?? null;
}
export function characterPrior(characterId: number): number | null {
  return CHARACTER_PRIORS[characterId] ?? null;
}

/** 费用折算成"骰子当量"，能量和秘传额外加权 */
export function costWeight(cost: readonly DiceRequirement[]): number {
  return cost.reduce((sum, req) => {
    const weight =
      req.type === PbDiceRequirementType.ENERGY
        ? 1.5
        : req.type === PbDiceRequirementType.LEGEND
          ? 2.5
          : 1;
    return sum + req.count * weight;
  }, 0);
}

/** 把 action.preview 归纳成几个关键指标 */
export function summarizePreview(
  action: Action,
  who: 0 | 1,
  state: PbGameState,
): PreviewSummary {
  const enemyWho = 1 - who;
  const enemyCharacterIds = new Set(
    state.player[enemyWho]?.character.map((c) => c.id) ?? [],
  );
  const shieldOwners = collectShieldOwners(state);

  return action.preview.reduce<PreviewSummary>(
    (summary, preview) => {
      const mutation = preview.mutation;
      if (!mutation) {
        return summary;
      }
      switch (mutation.$case) {
        case "damage": {
          const { targetId, value, causeDefeated, reactionType, healKind, damageType } =
            mutation.value;
          if (healKind !== 0) {
            return enemyCharacterIds.has(targetId)
              ? summary
              : { ...summary, healed: summary.healed + value };
          }
          if (!enemyCharacterIds.has(targetId)) {
            return summary;
          }
          return {
            ...summary,
            damage: summary.damage + value,
            reactions: summary.reactions + (reactionType !== 0 ? 1 : 0),
            kills: summary.kills + (causeDefeated ? 1 : 0),
            piercing:
              summary.piercing + (damageType === PbDamageType.PIERCING ? value : 0),
          };
        }
        case "applyAura": {
          return enemyCharacterIds.has(mutation.value.targetId)
            ? { ...summary, debuffs: summary.debuffs + 0.6 }
            : summary;
        }
        case "createEntity": {
          const { who: ownerWho, entity } = mutation.value;
          // 护盾状态：按层数计价，比"多了一个实体"更贴近实战收益
          const gainedShield =
            ownerWho === who && entity?.variableName === SHIELD_VAR_NAME
              ? (entity.variableValue ?? 0)
              : 0;
          if (ownerWho === enemyWho) {
            return { ...summary, debuffs: summary.debuffs + 0.6 };
          }
          return ownerWho === who
            ? {
                ...summary,
                created: summary.created + 1,
                shieldGain: summary.shieldGain + gainedShield,
              }
            : summary;
        }
        case "removeEntity": {
          const { who: ownerWho, entity } = mutation.value;
          if (ownerWho !== enemyWho || entity?.variableName !== SHIELD_VAR_NAME) {
            return summary;
          }
          // 破盾：永久盾只有打碎才过得去，值得单独记一笔
          return {
            ...summary,
            shieldHits: bumpShieldHit(summary.shieldHits, entity.definitionId, 0, 1),
          };
        }
        case "modifyEntityVar": {
          const { entityId, entityDefinitionId, variableName, direction, oldValue, variableValue } =
            mutation.value;
          // 敌方护盾被吃掉多少层：拆盾本身是有效进展，不该当成"白打"
          if (
            variableName !== SHIELD_VAR_NAME ||
            direction !== PbModifyDirection.DECREASE ||
            shieldOwners.get(entityId) !== enemyWho
          ) {
            return summary;
          }
          const chip = Math.max(oldValue - variableValue, 0);
          return chip > 0
            ? {
                ...summary,
                shieldHits: bumpShieldHit(summary.shieldHits, entityDefinitionId, chip, 0),
              }
            : summary;
        }
        default:
          return summary;
      }
    },
    {
      damage: 0,
      kills: 0,
      reactions: 0,
      debuffs: 0,
      created: 0,
      healed: 0,
      shieldHits: new Map<number, ShieldHit>(),
      shieldGain: 0,
      piercing: 0,
    },
  );
}

export type AiStyle = "aggro" | "midrange" | "control";

export interface AiWeights {
  damage: number;
  kills: number;
  debuffs: number;
  created: number;
  healed: number;
  cardValue: number;
  /** 每点被打掉的敌方护盾（拆盾给后续伤害开路） */
  shieldChip: number;
  /** 每打碎一个敌方护盾（永久盾只有打碎才过得去） */
  shieldBreak: number;
  /** 每点我方获得的护盾（护盾吸收的伤害等价于回血） */
  shieldGain: number;
  /** 每点穿透伤害的额外加成；只在对面有盾时生效 */
  piercing: number;
  /** 卡牌胜率先验的权重（来自训练经验库） */
  cardPrior: number;
  /** 角色胜率先验的权重（换人、选谁出战） */
  charPrior: number;
  /** 骰子经济：己方骰子比对方多时更激进（每多 1 个骰子的加成） */
  diceEcon: number;
  /** 场面差：场面落后时，铺召唤物/支援更值钱（每落后 1 个单位的加成） */
  boardPressure: number;
}

export const DEFAULT_AI_WEIGHTS: AiWeights = {
  damage: 1.1,
  kills: 12,
  debuffs: 0.4,
  created: 0.45,
  healed: 0.5,
  cardValue: 0.7,
  shieldChip: 0.6,
  shieldBreak: 1,
  shieldGain: 0.3,
  piercing: 0.3,
  cardPrior: 0.6,
  charPrior: 0.4,
  diceEcon: 0.05,
  boardPressure: 0.12,
};

export interface ScoreContext {
  who: 0 | 1;
  state: PbGameState;
  /** 牌组风格：影响进攻/防守权重 */
  style?: AiStyle;
  /** 噪声幅度；平手时用来制造一点随机性 */
  noise?: number;
  rng?: () => number;
  /** 可配置的评分权重（AI 设置页） */
  weights?: Partial<AiWeights>;
  /** 牌库数据：用来判断对面上的是"只能打破"的盾还是"会自己到期"的盾 */
  data?: ShieldDataSource;
  /** 作者攻略里点名优先出的牌：给一点出牌加成（不改变其他评分） */
  authorCards?: ReadonlySet<number>;
  /** 上面那批牌的加成幅度 */
  authorBonus?: number;
  /** 本地对局经验：单卡胜率先验（cardId → -0.3..0.3 的加成） */
  cardPriors?: ReadonlyMap<number, number>;
}

export interface ScoredAction {
  index: number;
  score: number;
  reason: string;
}

/**
 * 给一个候选动作打分。分数越高越想执行。
 * 权重是拍脑袋定的，但每一项都有明确理由，方便后续调参。
 */
export function scoreAction(
  action: Action,
  ctx: ScoreContext,
): { score: number; reason: string } {
  const { who, state } = ctx;
  const me = state.player[who];
  const enemy = state.player[1 - who];
  const summary = summarizePreview(action, who, state);
  const cost = costWeight(action.requiredCost);
  const myActive = me?.character.find((c) => c.id === me.activeCharacterId);
  const notes: string[] = [];

  // 局面层面的三个系数：抢血、卡差、节奏
  const weights = { ...DEFAULT_AI_WEIGHTS, ...(ctx.weights ?? {}) };
  const enemyHp = enemy?.character.reduce(
    (sum, character) => sum + Math.max(character.health, 0),
    0,
  ) ?? 30;
  const myHp = me?.character.reduce(
    (sum, character) => sum + Math.max(character.health, 0),
    0,
  ) ?? 30;
  /** 对面血越少，打伤害越值钱；我们自己血少时要更谨慎地换血 */
  const raceFactor = enemyHp <= 15 ? 1.35 : enemyHp <= 22 ? 1.18 : 1.0;
  const caution = myHp <= 12 ? 0.9 : 1.0;
  /** 手牌少的时候别乱甩牌，卡差会崩 */
  const cardPressure = (me?.handCard.length ?? 0) <= 2 ? -0.35 : 0;
  /** 快速行动不交节奏 */
  const speedBonus = action.isFast ? 0.25 : 0;
  /**
   * 骰子经济：己方骰子比对方多时，进攻更划算（对面没资源反击）；
   * 少于对方时保守一点，避免把骰子浪费在收益不确定的动作上。
   */
  const diceGap =
    (me?.dice.length ?? 0) - (enemy?.dice.length ?? 0);
  const diceEcon =
    1 + Math.max(-0.15, Math.min(0.25, diceGap * weights.diceEcon));
  /**
   * 场面差：对面召唤物/支援更多时，自己铺场的边际价值更高（追平场面）；
   * 自己场面领先时，铺场收益递减，不如直接打伤害。
   */
  // 注意：预览局面里字段名是 summon/support（单数），不是 summons/supports
  const boardGap =
    (enemy?.summon?.length ?? 0) +
    (enemy?.support?.length ?? 0) -
    ((me?.summon?.length ?? 0) + (me?.support?.length ?? 0));
  const boardPressure =
    1 + Math.max(-0.2, Math.min(0.45, boardGap * weights.boardPressure));
  // 按牌组风格调权重：快攻抢血、控制苟活、中速均衡
  const style = ctx.style ?? "midrange";
  const styleDamage = style === "aggro" ? 1.15 : style === "control" ? 0.9 : 1;
  const styleHeal = style === "aggro" ? 0.7 : style === "control" ? 1.4 : 1;
  const styleDebuff = style === "control" ? 1.25 : 1;
  // 攻略里的"斩杀线"：把对面出战角色压到 3 血以内，下一动就很危险
  const enemyActive = enemy?.character.find(
    (character) => character.id === enemy.activeCharacterId,
  );
  const pressureBonus =
    enemyActive && summary.damage > 0 && enemyActive.health - summary.damage <= 3
      ? 0.8
      : 0;
  /** 对面有盾时，穿透伤害是唯一能稳定推进的伤害来源 */
  const enemyShield = enemy ? totalShieldOf(enemy) : 0;
  // 永久盾（只能打到 0）拆一点就是一点进展；会自己到期的盾拆了纯亏节奏，只给零头
  let shieldChip = 0;
  let shieldBreak = 0;
  let shieldScore = summary.shieldGain * weights.shieldGain;
  for (const [definitionId, hit] of summary.shieldHits) {
    const temporary = isTemporaryShield(ctx.data, definitionId);
    shieldChip += hit.chip;
    shieldBreak += hit.broken;
    shieldScore += temporary
      ? hit.chip * weights.shieldChip * 0.25
      : hit.chip * weights.shieldChip + hit.broken * weights.shieldBreak;
  }
  if (enemyShield > 0) {
    shieldScore += summary.piercing * weights.piercing;
  }
  if (shieldChip > 0) {
    notes.push(`拆盾${shieldChip}`);
  }
  if (shieldBreak > 0) {
    notes.push(`破盾${shieldBreak}`);
  }
  if (summary.piercing > 0 && enemyShield > 0) {
    notes.push(`穿透${summary.piercing}`);
  }

  const score = (() => {
    const act = action.action;
    if (!act) {
      return 0;
    }
    switch (act.$case) {
      case "useSkill": {
        const needsEnergy = costWeight(action.requiredCost) > 0 && action.requiredCost.some(
          (req) => req.type === PbDiceRequirementType.ENERGY && req.count > 0,
        );
        if (needsEnergy) {
          // 充能来之不易：不能击杀就先攒着（攻略里常说的"大招留给关键目标"）
          notes.push("大招");
          return summary.kills > 0
            ? 6 + summary.damage * 1.2 - cost * 0.05
            : -0.6 + summary.damage * 0.2 - cost * 0.05;
        }
        const damageScore =
          summary.damage * weights.damage * raceFactor * caution * styleDamage * diceEcon +
          summary.kills * weights.kills +
          summary.reactions * 1.6 +
          pressureBonus +
          summary.debuffs * (weights.debuffs / 0.4) * 0.4 * styleDebuff +
          summary.created * (weights.created / 0.45) * 0.3 * boardPressure +
          (myActive
            ? Math.min(
                summary.healed,
                Math.max(myActive.maxHealth - myActive.health, 0),
              ) * (weights.healed / 0.5) * 0.6 * styleHeal
            : 0) -
          cost * 0.12 +
          shieldScore +
          // 伤害全被护盾吃掉不等于白打：至少拆了盾，不能再按"空过"罚分
          (summary.damage === 0 && cost > 0 && summary.shieldChip === 0 ? -0.8 : 0) +
          // 伤害被护盾吃掉时，能挂状态/铺召唤物的技能仍然有价值
          (summary.damage === 0 &&
          (summary.debuffs > 0 || summary.created > 0)
            ? 0.6
            : 0);
        notes.push(
          `伤害${summary.damage}`,
          ...(summary.kills ? [`击杀${summary.kills}`] : []),
          `费${cost}`,
        );
        return damageScore;
      }
      case "playCard": {
        if (act.value.willBeEffectless) {
          notes.push("无效果");
          return -8;
        }
        const value =
          summary.damage * (weights.damage / 1.1) * raceFactor * caution * styleDamage +
          summary.kills * weights.kills +
          summary.debuffs * (weights.debuffs / 0.4) * 0.4 * styleDebuff +
          summary.created * (weights.created / 0.45) * 0.45 * boardPressure +
          summary.healed * (weights.healed / 0.5) * 0.5 * styleHeal +
          shieldScore +
          // 经验库先验：历史胜率高的牌，同等条件下优先
          (cardPrior(act.value.cardDefinitionId) !== null
            ? (cardPrior(act.value.cardDefinitionId) - 0.5) * weights.cardPrior
            : 0) +
          // 本地经验：打过的对局里胜率高的牌，轻微加权（幅度受 cardPriors 限制）
          (ctx.cardPriors?.get(act.value.cardDefinitionId) ?? 0) +
          // 作者攻略点名优先出的牌：轻微加权，不盖过斩杀/清场判断
          (ctx.authorCards?.has(act.value.cardDefinitionId) ? (ctx.authorBonus ?? 0.35) : 0) +
          // 打牌基础分：装备/支援/事件即使没有即时收益，也有长期价值。
          (action.preview.length === 0 ? weights.cardValue : weights.cardValue * 0.5) +
          cardPressure +
          speedBonus -
          cost * 0.1;
        notes.push(`出牌${act.value.cardDefinitionId}`, `费${cost}`);
        return value;
      }
      case "switchActive": {
        const switchTo = me?.character.find(
          (c) => c.id === act.value.characterId,
        );
        const activeHp = myActive?.health ?? 0;
        const targetHp = switchTo?.health ?? 0;
        const priorBonus =
          (characterPrior(act.value.characterId) ?? 0.5) * weights.charPrior -
          0.5 * weights.charPrior;
        notes.push(`换人${activeHp}→${targetHp}`);
        // 攻略共识：主动切人要花 1 个骰子，收益不到 1 骰就别切；
        // 只有"保核心/躲斩杀"这种收益明确的操作才值得
        if (activeHp <= 4 && targetHp > activeHp) {
          return 1.4 - cost * 0.1 + priorBonus;
        }
        if (targetHp <= 2) {
          return -2 - cost * 0.1;
        }
        // 满血空切没有收益：对面没在斩杀线上时，硬切只是浪费一次行动
        if (activeHp > 4 && targetHp <= activeHp) {
          return -1.6 - cost * 0.1;
        }
        return -0.9 - cost * 0.1 + priorBonus;
      }
      case "elementalTuning": {
        // 调和：把一张手牌换成骰子。手牌多、或者骰子不够时才值得做
        const handCount = me?.handCard.length ?? 0;
        notes.push("调和");
        return handCount >= 6 ? 0.1 : -0.5;
      }
      case "declareEnd": {
        const diceLeft = me?.dice.length ?? 0;
        notes.push("结束回合");
        // 还有骰子却直接结束 = 这一回合白给，重罚
        const wastePenalty = diceLeft >= 3 ? -6 : diceLeft > 0 ? -3 : 0;
        return -100 + (diceLeft === 0 ? 5 : 0) + wastePenalty;
      }
      default:
        return 0;
    }
  })();

  const jitter =
    ctx.noise && ctx.rng ? (ctx.rng() - 0.5) * ctx.noise : 0;
  return { score: score + jitter, reason: notes.join(" ") };
}

/** 给所有合法动作打分（按传入顺序返回） */
export function scoreActions(
  actions: readonly Action[],
  validIndexes: readonly number[],
  ctx: ScoreContext,
): ScoredAction[] {
  return validIndexes.map((index) => {
    const { score, reason } = scoreAction(actions[index], ctx);
    return { index, score, reason };
  });
}

/** 在所有合法动作里挑分数最高的一个 */
export function pickAction(
  actions: readonly Action[],
  validIndexes: readonly number[],
  ctx: ScoreContext,
): ScoredAction {
  const scored = validIndexes.map((index) => {
    const { score, reason } = scoreAction(actions[index], ctx);
    return { index, score, reason };
  });
  const best = scored.reduce<ScoredAction | null>(
    (acc, cur) => (acc === null || cur.score > acc.score ? cur : acc),
    null,
  );
  return best ?? { index: validIndexes[0] ?? 0, score: 0, reason: "" };
}
