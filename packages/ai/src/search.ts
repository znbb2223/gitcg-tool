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
 * 基于真实对局推演的搜索。
 *
 * 做法：把当前局面序列化一份，针对若干个候选动作各开若干局"影子对局"，
 * 用一个廉价策略往后推进若干步（或整局），再用局面评估/胜负给候选动作打分。
 * 这就是最朴素的 rollout 搜索；因为引擎能从任意局面恢复（一次往返 ~0.2 ms），
 * 所以可以放心地在一个思考预算里跑掉几百条线。
 */

import {
  ActionValidity,
  createRpcResponse,
  type Action,
  type ActionRequest,
  type RpcRequest,
  type RpcResponse,
} from "@gi-tcg/typings";
import { DiceType } from "@gi-tcg/typings";
import {
  Game,
  deserializeGameStateLog,
  serializeGameStateLog,
  type EntityState,
  type GameState,
} from "@gi-tcg/core";
import type { GameData } from "@gi-tcg/core/data";
import { costWeight } from "./evaluate";
import { memoryKey, type DecisionMemory } from "./memory";
import { valueOf, type ValueOptions } from "./value";

export interface SearchCandidateStat {
  index: number;
  key: string;
  rollouts: number;
  wins: number;
  losses: number;
  draws: number;
  /** 平均得分：胜 +1 / 平 0 / 负 -1（截断的线用局面评估代替） */
  average: number;
  /** 候选的静态启发式分，用于平手时排序 */
  heuristic: number;
}

export interface SearchOptions {
  who: 0 | 1;
  data: GameData;
  /** 当前真实局面（内部状态，含完整信息） */
  state: GameState;
  /** 思考预算，毫秒 */
  budgetMs: number;
  /** 随机源：推演策略的抖动，以及候选顺序 */
  rng?: () => number;
  /** 最多尝试几个候选动作 */
  maxCandidates?: number;
  /**
   * 每条线最多推进多少个动作（双方各算一个动作）。
   * 0 或不传表示一直下到分出胜负。
   */
  maxActions?: number;
  /** 决策记忆：命中且置信度高时直接复用，顺便压缩思考预算 */
  memory?: DecisionMemory;
  /**
   * 明牌模式：推演时直接使用真实隐藏信息（对手手牌、牌堆顺序）。
   * 默认 false，即"真实模式"——只按公开信息做确定性化采样。
   */
  perfectInformation?: boolean;
  /** 启发式先验分（index → score），用于融合排序与剪枝 */
  heuristicScores?: Map<number, number>;
  /** 局面价值配置：查表 / 神经网络 / 旧版线性的开关 */
  valueOptions?: ValueOptions;
  log?: (message: string) => void;
}

export interface SearchResult {
  chosenActionIndex: number;
  usedDice: DiceType[];
  candidates: SearchCandidateStat[];
  rollouts: number;
  elapsedMs: number;
  /** 是否命中了后台预计算的缓存（命中后仍会复核，但预算更短） */
  cacheHit?: boolean;
  /** 是否直接来自记忆（0 ms 出招） */
  cached: boolean;
}

/** 推演到步数上限时用来中断引擎的哨兵错误 */
class RolloutCutoff extends Error {}

/** 静态排序：不看场上信息，只看这手牌/技能本身能造成什么 */
function rawPriority(action: Action): number {
  const summary = action.preview.reduce(
    (acc, preview) => {
      const mutation = preview.mutation;
      if (mutation?.$case !== "damage" || mutation.value.healKind !== 0) {
        return acc;
      }
      return {
        damage: acc.damage + mutation.value.value,
        kills: acc.kills + (mutation.value.causeDefeated ? 1 : 0),
      };
    },
    { damage: 0, kills: 0 },
  );
  if (action.action?.$case === "declareEnd") {
    return -1000;
  }
  return (
    summary.damage * 1.1 +
    summary.kills * 12 -
    costWeight(action.requiredCost) * 0.12
  );
}

/**
 * 隐藏信息处理：推演前把"我不知道的信息"重新随机化。
 *
 * 直接拿引擎内部状态推演会顺带看到对手手牌和双方牌堆顺序——那是作弊。
 * 所以每条线开始前：
 * - 对手的"手牌 + 牌堆"洗在一起重新发（只知道张数，不知道具体是哪几张）；
 * - 自己的牌堆也洗一遍（我们同样不知道下一抽）。
 * 这样搜索只用到"自己手牌 + 双方已公开的信息"。
 */
export function determinizeState(
  state: GameState,
  who: 0 | 1,
  rng: () => number,
): void {
  const players = state.players as unknown as {
    hands: EntityState[];
    pile: EntityState[];
  }[];
  const enemy = players[1 - who];
  const pool = [...enemy.hands, ...enemy.pile];
  const handSize = enemy.hands.length;

  // 按概率分布采样：便宜的、即打即用的牌更容易被留在手里
  const weighted = pool.map((entity) => ({
    entity,
    weight: handLikelihood(entity),
  }));
  const hand: EntityState[] = [];
  for (let i = 0; i < handSize && weighted.length > 0; i++) {
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let target = rng() * total;
    const index = weighted.findIndex((item) => {
      target -= item.weight;
      return target <= 0;
    });
    const [picked] = weighted.splice(Math.max(index, 0), 1);
    hand.push(picked.entity);
  }
  enemy.hands = hand;
  enemy.pile = shuffle([...weighted.map((item) => item.entity)], rng);
  shuffleInPlace(players[who].pile, rng);
}

/**
 * 一张牌"还在对手手里"的先验权重。
 * 用的是公开信息：牌的类别与费用（打不出去的高费牌更容易被留在手里等时机）。
 */
function handLikelihood(entity: EntityState): number {
  const definition = entity.definition;
  const cost = definition.skills?.[0]?.initiativeSkillConfig?.requiredCost;
  let total = 0;
  if (cost) {
    for (const [, count] of cost) {
      total += count;
    }
  }
  const costBonus = total <= 1 ? 1.45 : total <= 2 ? 1.15 : 0.85;
  const typeBonus =
    definition.type === "eventCard"
      ? 1.1
      : definition.type === "equipment"
        ? 1.0
        : 0.95;
  return costBonus * typeBonus;
}

/** 32 位小 rng，给推演用 */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  shuffleInPlace(items, rng);
  return items;
}

function shuffleInPlace<T>(items: T[], rng: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/** 推演时用到的局面信息（只取推演策略需要的那一点） */
export interface RolloutContext {
  enemyCharacterIds: Set<number>;
  health: Map<number, number>;
}

function rolloutContext(state: GameState, side: 0 | 1): RolloutContext {
  const enemy = state.players[1 - side];
  return {
    enemyCharacterIds: new Set(enemy.characters.map((c) => c.id)),
    health: new Map(enemy.characters.map((c) => [c.id, c.variables.health])),
  };
}

/** 推演策略用的评分：能打死就优先打死，其余看伤害/费用 */
function rolloutPriority(action: Action, ctx: RolloutContext | null): number {
  if (action.action?.$case === "declareEnd") {
    return -1000;
  }
  if (action.preview.length === 0) {
    // 跳过预览的推演：按动作类型和费用粗排，够用即可
    const kind = action.action?.$case;
    const base =
      kind === "useSkill" ? 6 : kind === "playCard" ? 5 : kind === "switchActive" ? 3 : 1;
    const cost = (action.requiredCost ?? []).reduce((sum, req) => sum + req.count, 0);
    return base - cost * 0.2;
  }
  const summary = action.preview.reduce(
    (acc, preview) => {
      const mutation = preview.mutation;
      if (mutation?.$case !== "damage" || mutation.value.healKind !== 0) {
        return acc;
      }
      const { targetId, value, causeDefeated } = mutation.value;
      const isEnemy = ctx ? ctx.enemyCharacterIds.has(targetId) : true;
      if (!isEnemy) {
        return acc;
      }
      const health = ctx?.health.get(targetId);
      const lethal = causeDefeated || (health !== undefined && value >= health);
      return {
        damage: acc.damage + value,
        kills: acc.kills + (lethal ? 1 : 0),
        reactions: acc.reactions + (mutation.value.reactionType !== 0 ? 1 : 0),
      };
    },
    { damage: 0, kills: 0, reactions: 0 },
  );
  const creates = action.preview.filter(
    (preview) => preview.mutation?.$case === "createEntity",
  ).length;
  return (
    summary.damage * 1.1 +
    summary.kills * 12 +
    summary.reactions * 0.8 +
    creates * 0.3 -
    costWeight(action.requiredCost) * 0.12
  );
}

/** 给动作取一个稳定的"指纹"，用来在恢复后的局面里找回同一个动作 */
export function actionKey(action: Action): string {
  const act = action.action;
  switch (act?.$case) {
    case "useSkill":
      return `skill:${act.value.skillDefinitionId}:${act.value.targetIds.join(",")}`;
    case "playCard":
      return `card:${act.value.cardId}:${act.value.targetIds.join(",")}`;
    case "switchActive":
      return `switch:${act.value.characterId}`;
    case "elementalTuning":
      return `tune:${act.value.removedCardId}`;
    case "declareEnd":
      return "end";
    default:
      return "unknown";
  }
}

/** 指纹退化成"同一类动作"，用于目标 id 对不上的情况 */
function actionFamily(action: Action): string {
  const act = action.action;
  switch (act?.$case) {
    case "useSkill":
      return `skill:${act.value.skillDefinitionId}`;
    case "playCard":
      return `card:${act.value.cardDefinitionId}`;
    case "switchActive":
      return "switch";
    case "elementalTuning":
      return "tune";
    case "declareEnd":
      return "end";
    default:
      return "unknown";
  }
}

/**
 * 推演用的廉价策略：不读局面，只看请求本身。
 * 目标是快（约 5 ms 一个动作）而不是强——强的那部分交给搜索。
 */
export function fastReply(
  request: RpcRequest,
  pendingKey: string | null,
  rng: () => number,
  ctx: RolloutContext | null = null,
): RpcResponse {
  const payload = request.request;
  if (!payload) {
    throw new Error("empty request");
  }
  switch (payload.$case) {
    case "action": {
      const actions = payload.value.action;
      if (pendingKey !== null) {
        const exact = actions.findIndex((a) => actionKey(a) === pendingKey);
        if (exact >= 0) {
          return createRpcResponse("action", {
            chosenActionIndex: exact,
            usedDice: [...actions[exact].autoSelectedDice],
          });
        }
        const family = actions.findIndex(
          (a) => actionFamily(a) === pendingKey,
        );
        if (family >= 0) {
          return createRpcResponse("action", {
            chosenActionIndex: family,
            usedDice: [...actions[family].autoSelectedDice],
          });
        }
      }
      const valid = actions.flatMap((action, index) =>
        action.validity === ActionValidity.VALID ? [index] : [],
      );
      if (valid.length === 0) {
        return createRpcResponse("action", {
          chosenActionIndex: 0,
          usedDice: [],
        });
      }
      // 用抖动版的优先级做软最大化，保证不同的推演线不完全一样
      const best = valid.reduce((acc, index) => {
        const score = rolloutPriority(actions[index], ctx) + (rng() - 0.5) * 1.5;
        const bestScore =
          rolloutPriority(actions[acc], ctx) + (rng() - 0.5) * 1.5;
        return score > bestScore ? index : acc;
      });
      return createRpcResponse("action", {
        chosenActionIndex: best,
        usedDice: [...actions[best].autoSelectedDice],
      });
    }
    case "chooseActive":
      return createRpcResponse("chooseActive", {
        activeCharacterId: payload.value.candidateIds[0] ?? 0,
      });
    case "rerollDice":
      return createRpcResponse("rerollDice", { diceToReroll: [] });
    case "switchHands":
      return createRpcResponse("switchHands", { removedHandIds: [] });
    case "selectCard":
      return createRpcResponse("selectCard", {
        selectedDefinitionId: payload.value.candidateDefinitionIds[0] ?? 0,
      });
    case "selectOption":
      return createRpcResponse("selectOption", { selectedIndex: 0 });
  }
}

/**
 * 谁更占优，返回 [-1, 1]。
 *
 * 具体算法在 `value.ts`：手工特征（默认）→ 可选叠加历史胜率查表 → 可选叠加小神经网络，
 * 三层都能单独开关，用 `configureValue` 配置。
 */
export function evaluateState(state: GameState, who: 0 | 1): number {
  return valueOf(state, who);
}

/**
 * 对当前局面做一次有时间上限的搜索，返回要执行的动作。
 *
 * 预算分配是"轮流给每个候选一次推演"，候选多时也不会把时间全花在第一手上。
 */
/** 后台预计算好的决策：局面指纹 → 推荐动作 */
const precomputed = new Map<string, { actionKey: string; at: number }>();
let cacheHitCount = 0;
/** 取走并清零「后台预计算命中」计数（实验统计用） */
export function takeCacheHitCount(): number {
  const value = cacheHitCount;
  cacheHitCount = 0;
  return value;
}
const PRECOMPUTE_TTL_MS = 5 * 60_000;

/** 记录后台算好的一手（供下一回合命中） */
export function recordPrecomputed(state: GameState, actionKeyValue: string): void {
  const key = JSON.stringify(serializeGameStateLog([{ state, canResume: true }]));
  precomputed.set(key, { actionKey: actionKeyValue, at: Date.now() });
  if (precomputed.size > 64) {
    const oldest = [...precomputed.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) precomputed.delete(oldest[0]);
  }
}

function lookupPrecomputed(stateKey: string): string | null {
  const hit = precomputed.get(stateKey);
  if (!hit) return null;
  if (Date.now() - hit.at > PRECOMPUTE_TTL_MS) {
    precomputed.delete(stateKey);
    return null;
  }
  return hit.actionKey;
}


/**
 * 后台预计算：从当前局面出发，模拟「我方这一手 → 对手最可能的回应」，
 * 到达我方下一个决策点后跑一次短搜索，把结论写进缓存。
 * 前台轮到那个局面时，就能用更短的时间复核。
 */
export async function precomputeLine(
  request: ActionRequest,
  options: SearchOptions & { ourActionKey?: string },
): Promise<{ recorded: boolean }> {
  const { who, data, state } = options;
  const budgetMs = options.budgetMs ?? 2000;
  const wanted = options.ourActionKey ?? null;
  if (wanted === null) {
    return { recorded: false };
  }
  const serialized = JSON.stringify(
    serializeGameStateLog([{ state, canResume: true }]),
  );
  const restored = deserializeGameStateLog(data, JSON.parse(serialized))[0].state;
  const game = new Game(restored, { silent: true, skipPreview: true });
  const rng = makeRng(Math.floor(Math.random() * 0x7fffffff));
  let forced = false;
  let capturedState: GameState | null = null;
  let capturedRequest: ActionRequest | null = null;
  for (const seat of [0, 1]) {
    game.players[seat].io = {
      notify: () => {},
      rpc: (rpcRequest: RpcRequest) => {
        if (rpcRequest.request?.$case === "action") {
          const body = rpcRequest.request.value;
          if (seat === who && !forced) {
            // 我方这一手按前台选定的动作走
            const index = body.action.findIndex((action) => actionKey(action) === wanted);
            if (index >= 0) {
              forced = true;
              return createRpcResponse("action", {
                chosenActionIndex: index,
                usedDice: [...body.action[index].autoSelectedDice],
              });
            }
          }
          if (seat === who && forced && capturedState === null) {
            // 再次轮到我方 → 这就是要预计算的局面
            capturedState = game.state;
            capturedRequest = rpcRequest.request.value;
          }
        }
        return fastReply(rpcRequest, null, rng);
      },
    };
  }
  await game.start().catch(() => void 0);
  if (!capturedState || !capturedRequest) {
    return { recorded: false };
  }
  const result = await searchBestAction(capturedRequest, {
    ...options,
    state: capturedState,
    budgetMs,
    memory: undefined,
    cachedBudgetMs: undefined,
  });
  const chosen = capturedRequest.action[result.chosenActionIndex];
  if (!chosen) {
    return { recorded: false };
  }
  recordPrecomputed(capturedState, actionKey(chosen));
  return { recorded: true };
}

/**
 * 出战角色的大招计划：还差几个同元素骰、能量够不够。
 * 大招不合法（NO_DICE）时它进不了候选，所以必须在「还能调和凑骰」的回合提前规划。
 */
function burstPlanOf(
  state: GameState,
  who: 0 | 1,
): { diceGap: number; energyFull: boolean; needed: Set<number> } | null {
  const me = state.players[who];
  const active = me.characters.find(
    (character) => character.id === me.activeCharacterId,
  );
  const burst = active?.definition.skills?.find(
    (skill) => skill.skillType === "burst",
  );
  const required = burst?.initiativeSkillConfig?.requiredCost;
  if (!required) {
    return null;
  }
  let diceNeed = 0;
  let energyNeed = 0;
  const needed = new Set<number>();
  for (const [type, count] of required) {
    if (type === DiceType.ENERGY) {
      energyNeed += count;
    } else {
      diceNeed += count;
      needed.add(type);
    }
  }
  const matching = me.dice.filter(
    (die) => needed.has(die) || die === DiceType.Omni,
  ).length;
  return {
    diceGap: Math.max(0, diceNeed - matching),
    energyFull: active.variables.energy >= Math.min(energyNeed, active.variables.maxEnergy),
    needed,
  };
}

export async function searchBestAction(
  request: ActionRequest,
  options: SearchOptions,
): Promise<SearchResult> {
  const startedAt = Date.now();
  const { who, data, state, budgetMs } = options;
  const rng = options.rng ?? Math.random;
  // 公共随机数：同一"推演序号"在所有候选上使用同一个种子，
  // 比较候选时面对的是同一批随机世界，方差小很多。
  const baseSeed = Math.floor(rng() * 0x7fffffff);
  const maxCandidates = options.maxCandidates ?? 8;
  const maxActions = options.maxActions ?? 0;
  const log = options.log ?? (() => {});
  const actions = request.action;

  const validIndexes = actions.flatMap((action, index) =>
    action.validity === ActionValidity.VALID ? [index] : [],
  );
  // 大招计划：能量已满但缺骰子时，优先用元素调和凑骰；骰子够了就把大招顶上去
  const playStateKey = JSON.stringify(serializeGameStateLog([{ state, canResume: true }]));
  const cachedKey = lookupPrecomputed(playStateKey);
  const cachedIndex = cachedKey === null
    ? -1
    : actions.findIndex((action) => actionKey(action) === cachedKey);
  if (cachedIndex >= 0) {
    cacheHitCount += 1;
  }
  const plan = options.burstPlan === false ? null : burstPlanOf(state, who);
  const tuningBoost = plan && plan.energyFull && plan.diceGap > 0 ? 3.2 : 0;
  const burstBoost = plan && plan.energyFull && plan.diceGap === 0 ? 3.5 : 0;
  const priorOf = (index: number) => {
    const action = actions[index];
    const kind = action.action?.$case;
    let bonus = 0;
    if (index === cachedIndex) {
      // 后台已经算过这一手：大概率是对的，顶到最前，但仍要跑搜索验证
      bonus += 4;
    }
    if (tuningBoost > 0 && kind === "elementalTuning") {
      bonus = tuningBoost;
    } else if (burstBoost > 0 && kind === "useSkill") {
      const skillId = action.action.value.skillDefinitionId;
      const active = state.players[who].characters.find(
        (character) => character.id === state.players[who].activeCharacterId,
      );
      const isBurst = active?.definition.skills?.some(
        (skill) => skill.skillType === "burst" && skill.id === skillId,
      );
      if (isBurst) {
        bonus = burstBoost;
      }
    }
    return rawPriority(action) + bonus;
  };
  const heuristicOrder = [...validIndexes].sort((a, b) => priorOf(b) - priorOf(a));
  const candidates = heuristicOrder.slice(0, maxCandidates);
  const fallbackIndex = heuristicOrder[0] ?? 0;
  const fallback = {
    chosenActionIndex: fallbackIndex,
    usedDice: [...(actions[fallbackIndex]?.autoSelectedDice ?? [])],
  };
  if (candidates.length <= 1 || budgetMs <= 0) {
    return {
      ...fallback,
      candidates: [],
      rollouts: 0,
      elapsedMs: Date.now() - startedAt,
      cached: false,
    };
  }

  const serialized = JSON.stringify(
    serializeGameStateLog([{ state, canResume: true }]),
  );
  // 已经能直接打死一个人：别想了，直接出手（省下的时间给别的回合）
  const lethal = candidates.filter((index) =>
    actions[index].preview.some(
      (preview) =>
        preview.mutation?.$case === "damage" &&
        preview.mutation.value.causeDefeated,
    ),
  );
  if (lethal.length === 1) {
    const chosen = actions[lethal[0]];
    return {
      chosenActionIndex: lethal[0],
      usedDice: [...chosen.autoSelectedDice],
      candidates: [],
      rollouts: 0,
      elapsedMs: Date.now() - startedAt,
      cached: false,
    };
  }

  const key = memoryKey(serialized, request);
  const remembered = options.memory?.get(key) ?? null;
  // 见过不止一次、且上次结论足够自信：直接复用，0 ms 出招
  // 同一局面反复得出同一手（决策稳定），或搜索给出的胜率很高，就零耗时复用
  if (
    remembered &&
    remembered.visits >= 2 &&
    (remembered.sameCount >= 2 || remembered.confidence >= 0.7)
  ) {
    const cachedIndex = actions.findIndex(
      (action) => actionKey(action) === remembered.actionKey,
    );
    if (cachedIndex >= 0) {
      const cachedAction = actions[cachedIndex];
      options.memory?.record(
        key,
        remembered.actionKey,
        remembered.confidence,
        budgetMs,
      );
      return {
        chosenActionIndex: cachedIndex,
        usedDice: [...cachedAction.autoSelectedDice],
        candidates: [],
        rollouts: 0,
        elapsedMs: Date.now() - startedAt,
        cached: true,
      };
    }
  }
  // 经验越多、分支越少，越不需要想那么久
  const visits = remembered?.visits ?? 0;
  // 分支越少越不用算；见过的局面也越算越快
  const branchingScale =
    candidates.length <= 2 ? 0.25 : candidates.length <= 4 ? 0.6 : 1;
  // 后台算过的局面：前台只花一小段时间复核，剩下的时间省下来
  const cachedBudget =
    cachedIndex >= 0 ? Math.min(budgetMs, options.cachedBudgetMs ?? budgetMs * 0.35) : budgetMs;
  const effectiveBudget =
    cachedBudget * (visits === 0 ? 1 : visits === 1 ? 0.6 : 0.4) * branchingScale;

  const stats: SearchCandidateStat[] = candidates.map((index) => ({
    index,
    key: actionKey(actions[index]),
    rollouts: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    average: 0,
    heuristic: priorOf(index),
  }));
  const scoreSums = candidates.map(() => 0);

  /** 跑一局影子对局 */
  const playout = async (statIndex: number, rolloutIndex: number) => {
    const policyRng = makeRng(baseSeed + rolloutIndex);
    const stat = stats[statIndex];
    const restored = deserializeGameStateLog(
      data,
      JSON.parse(serialized),
    )[0].state;
    if (!options.perfectInformation) {
      determinizeState(restored, who, policyRng);
    }
    const game = new Game(restored, {
      silent: true,
      skipPreview: options.skipRolloutPreview ?? false,
    });
    let pendingKey: string | null = stat.key;
    let actionCount = 0;
    let cutShort = false;
    const responder = (side: 0 | 1, withPending: boolean) => async (
      rpcRequest: RpcRequest,
    ) => {
      if (rpcRequest.request?.$case === "action") {
        actionCount += 1;
        if (maxActions > 0 && actionCount > maxActions) {
          cutShort = true;
          throw new RolloutCutoff("rollout depth reached");
        }
        if (withPending && pendingKey !== null) {
          const key = pendingKey;
          pendingKey = null;
          return fastReply(
            rpcRequest,
            key,
            policyRng,
            rolloutContext(game.state, side),
          );
        }
      }
      return fastReply(
        rpcRequest,
        null,
        policyRng,
        rolloutContext(game.state, side),
      );
    };
    game.players[who].io = { notify: () => {}, rpc: responder(who, true) };
    game.players[1 - who].io = {
      notify: () => {},
      rpc: responder(1 - who, false),
    };

    const winner = await game.start().catch((error: unknown) => {
      if (cutShort) {
        return void 0;
      }
      throw error;
    });

    const score = cutShort
      ? valueOf(game.state, who, options.valueOptions)
      : winner === who
        ? 1
        : winner === null
          ? 0
          : -1;
    stat.rollouts += 1;
    scoreSums[statIndex] += score;
    stat.average = scoreSums[statIndex] / stat.rollouts;
    if (cutShort) {
      stat.draws += 1;
    } else if (winner === who) {
      stat.wins += 1;
    } else if (winner === null) {
      stat.draws += 1;
    } else {
      stat.losses += 1;
    }
  };

  const deadline = startedAt + effectiveBudget;
  let rollouts = 0;
  // 第一阶段：每个候选先给一条线，粗筛
  for (const index of stats.keys()) {
    if (Date.now() >= deadline) {
      break;
    }
    await playout(index, rollouts);
    rollouts += 1;
  }
  // 第二阶段：把剩余时间砸进当前前三名
  while (Date.now() < deadline) {
    const ranked = [...stats.keys()].sort(
      (a, b) => stats[b].average - stats[a].average,
    );
    const pool = ranked.slice(0, 3);
    const target = pool.reduce((acc, index) =>
      stats[index].rollouts < stats[acc].rollouts ? index : acc,
    );
    await playout(target, rollouts);
    rollouts += 1;
  }

  // 推演结果和启发式先验加权融合，避免低预算下被噪声带偏
  const blended = stats.map((stat) => {
    if (stat.rollouts === 0) {
      return Number.NEGATIVE_INFINITY;
    }
    const prior =
      options.heuristicScores?.get(stat.index) ?? stat.heuristic;
    return stat.average * 0.75 + Math.tanh(prior / 4) * 0.25;
  });
  const bestIndex = blended.reduce(
    (acc, score, index) => (score > blended[acc] ? index : acc),
    0,
  );
  const best = stats[bestIndex];
  log(
    `搜索完成：${rollouts} 条线 / ${stats.length} 个候选 / ${Date.now() - startedAt} ms，` +
      stats
        .map(
          (stat) =>
            `#${stat.index} ${(stat.average * 100).toFixed(0)}%（${stat.rollouts} 线）`,
        )
        .join(" "),
  );
  if (best.rollouts === 0) {
    return {
      ...fallback,
      candidates: stats,
      rollouts,
      elapsedMs: Date.now() - startedAt,
      cached: false,
    };
  }
  const chosen = actions[best.index];
  const elapsedMs = Date.now() - startedAt;
  options.memory?.record(
    key,
    actionKey(chosen),
    (best.average + 1) / 2,
    Math.max(budgetMs - elapsedMs, 0),
  );
  return {
    chosenActionIndex: best.index,
    usedDice: [...chosen.autoSelectedDice],
    candidates: stats,
    rollouts,
    elapsedMs,
    cached: false,
  };
}
