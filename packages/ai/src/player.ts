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

import {
  ActionValidity,
  DiceType,
  PbDiceRequirementType,
  createRpcResponse,
  type Action,
  type ActionRequest,
  type ChooseActiveRequest,
  type Notification,
  type PbGameState,
  type RerollDiceRequest,
  type RpcRequest,
  type RpcResponse,
  type SelectCardRequest,
  type SelectOptionRequest,
  type SwitchHandsRequest,
} from "@gi-tcg/typings";
import { CARD_PRIORS } from "./data/experience-priors";
import { AUTHOR_HINTS } from "./data/author-hints";
import {
  pickAction,
  scoreActions,
  type AiStyle,
  type AiWeights,
  type ShieldDataSource,
} from "./evaluate";

export type AiDifficulty = "easy" | "normal";

export interface AiOptions {
  /** AI 执哪一方（0 = 先手，1 = 后手） */
  who: 0 | 1;
  /** 每次决策前的"思考"延时，单位毫秒。0 表示立即落子 */
  delayMs?: number;
  /** 随机种子；相同种子 + 相同局面会做出相同选择 */
  seed?: number;
  difficulty?: AiDifficulty;
  /** 失误率：以该概率随机选一个合法动作（降低强度的主要手段之一） */
  blunderRate?: number;
  /** 牌组风格（快攻/中速/控制）；传 "random" 每局随机抽一个 */
  style?: AiStyle | "random";
  name?: string;
  /** 评分权重（来自 AI 设置页），缺省用默认值 */
  weights?: Partial<AiWeights>;
  /** 牌库数据：让评分能判断护盾会不会自己消失（不传时按"只能打破"处理） */
  data?: ShieldDataSource;
  /** 牌组指纹（角色+卡牌排序后拼接）：有作者攻略提示时用来做留牌/出牌偏好 */
  deckKey?: string;
  /** 本地对局经验：单卡胜率先验（同时影响留牌与出牌） */
  cardPriors?: ReadonlyMap<number, number>;
  /** 决策日志，默认关闭 */
  log?: (message: string) => void;
  /**
   * 自定义行动选择（例如接入搜索）。返回 null 表示回退到启发式。
   * 搜索需要引擎的内部局面，所以由调用方（持有 Game 的地方）提供闭包。
   */
  selectAction?: (
    request: ActionRequest,
    context: {
      who: 0 | 1;
      state: PbGameState | null;
      heuristicIndex: number;
      /** 每个合法动作的启发式分，搜索可以拿它当先验 */
      heuristicScores: { index: number; score: number }[];
    },
  ) => Promise<{ chosenActionIndex: number; usedDice: DiceType[] } | null>;
}

export interface AiPlayerIO {
  notify: (notification: Notification) => void;
  rpc: (request: RpcRequest) => Promise<RpcResponse>;
}

/** 每回合重投骰子时最多保留的"有用骰"个数（同色牌需要 3 个） */
const MAX_KEEP_PER_TYPE = 3;

const DIFFICULTY_NOISE: Record<AiDifficulty, number> = {
  easy: 6,
  normal: 0.8,
};

/**
 * 一个基于启发式评估的 AI 牌手。
 *
 * 它只使用引擎通过 `notify` / `rpc` 提供的**该玩家可见信息**，不偷看对手手牌，
 * 所以可以被放到服务端当机器人，也可以本地当陪练。
 */
export class AiPlayer implements AiPlayerIO {
  readonly who: 0 | 1;
  readonly name: string;
  private state: PbGameState | null = null;
  private readonly delayMs: number;
  private readonly noise: number;
  private readonly rng: () => number;
  private readonly log: (message: string) => void;
  private readonly selectAction?: AiOptions["selectAction"];
  private readonly blunderRate: number;
  private readonly weights: Partial<AiWeights>;
  private readonly data?: ShieldDataSource;
  private readonly deckKey?: string;
  private readonly cardPriors?: ReadonlyMap<number, number>;
  readonly style: AiStyle;
  /** 上一回合看到的技能费用，用来决定重投时留哪些骰子 */
  private wantedDice = new Set<number>();

  constructor(options: AiOptions) {
    this.who = options.who;
    this.name = options.name ?? `AI(${options.who === 0 ? "先手" : "后手"})`;
    this.delayMs = options.delayMs ?? 0;
    this.noise = DIFFICULTY_NOISE[options.difficulty ?? "normal"];
    this.rng = createRng(options.seed ?? 20260101);
    this.log = options.log ?? (() => {});
    this.selectAction = options.selectAction;
    this.blunderRate = Math.min(Math.max(options.blunderRate ?? 0, 0), 1);
    this.weights = options.weights;
    this.data = options.data;
    this.deckKey = options.deckKey;
    this.cardPriors = options.cardPriors;
    this.style =
      options.style === "random"
        ? (["aggro", "midrange", "control"] as const)[
            Math.floor(Math.random() * 3)
          ]
        : (options.style ?? "midrange");
  }

  notify = (notification: Notification) => {
    if (notification.state) {
      this.state = notification.state;
    }
  };

  rpc = async (request: RpcRequest): Promise<RpcResponse> => {
    await sleep(this.delayMs);
    const payload = request.request;
    if (!payload) {
      throw new Error("empty rpc request");
    }
    switch (payload.$case) {
      case "rerollDice":
        return createRpcResponse("rerollDice", this.decideReroll(payload.value));
      case "switchHands":
        return createRpcResponse(
          "switchHands",
          this.decideSwitchHands(payload.value),
        );
      case "chooseActive":
        return createRpcResponse(
          "chooseActive",
          this.decideActive(payload.value),
        );
      case "action":
        return createRpcResponse(
          "action",
          await this.decideAction(payload.value.action),
        );
      case "selectCard":
        return createRpcResponse(
          "selectCard",
          this.decideSelectCard(payload.value),
        );
      case "selectOption":
        return createRpcResponse(
          "selectOption",
          this.decideSelectOption(payload.value),
        );
    }
  };

  private get me() {
    return this.state?.player[this.who];
  }

  /**
   * 开局抓牌阶段：按攻略里"起手留低费、高费换掉"的思路，
   * 把总费用 ≥3 的牌换掉（最多 2 张）。
   */
  private decideSwitchHands(_request: SwitchHandsRequest) {
    const hand = this.me?.handCard ?? [];
    if (hand.length < 5) {
      return { removedHandIds: [] };
    }
    // 作者攻略里的留牌建议（人工分析出来的 keep 列表）
    const hint = this.deckKey ? AUTHOR_HINTS[this.deckKey] : undefined;
    const hintKeep = new Set(hint?.keep ?? []);
    // 起手：高费换掉，但训练胜率高的牌（先验）即使贵也尽量留；攻略点名要留的直接减分
    const keepScore = (card: { definitionId: number; definitionCost: ReadonlyArray<{ count: number }> }) => {
      const cost = card.definitionCost.reduce((sum, req) => sum + req.count, 0);
      const prior = CARD_PRIORS[card.definitionId];
      // 本地对局经验：留牌阶段也给单卡先验一点权重，和全局先验叠加但幅度更小
      const localPrior = this.cardPriors?.get(card.definitionId) ?? 0;
      const base = cost - (prior === undefined ? 0 : (prior - 0.5) * 6) - localPrior * 4;
      return hintKeep.has(card.definitionId) ? base - 3 : base;
    };
    const removedHandIds = [...hand]
      .sort((left, right) => keepScore(right) - keepScore(left))
      .filter((card) => keepScore(card) >= 3)
      .slice(0, 2)
      .map((card) => card.id);
    if (removedHandIds.length > 0) {
      this.log(`${this.name} 换掉起手高费牌 ${JSON.stringify(removedHandIds)}`);
    }
    return { removedHandIds };
  }

  /** 重投骰子：留住万能骰和"可能会用到的元素骰" */
  private decideReroll(_request: RerollDiceRequest) {
    const dice = this.me?.dice ?? [];
    if (dice.length === 0) {
      return { diceToReroll: [] };
    }
    const wanted = this.collectWantedDice();
    const kept = new Map<number, number>();
    const diceToReroll = dice.filter((die) => {
      if (die === DiceType.Omni) {
        return false;
      }
      if (die === DiceType.Void) {
        return true;
      }
      const keptCount = kept.get(die) ?? 0;
      if (wanted.has(die) && keptCount < MAX_KEEP_PER_TYPE) {
        kept.set(die, keptCount + 1);
        return false;
      }
      return true;
    });
    this.log(
      `${this.name} 重投 ${JSON.stringify(diceToReroll)}（留 ${dice.length - diceToReroll.length} 颗）`,
    );
    return { diceToReroll };
  }

  /** 换人：选择血量最健康的角色 */
  private decideActive(request: ChooseActiveRequest) {
    const candidates = (this.me?.character ?? []).filter(
      (c) => request.candidateIds.includes(c.id) && !c.defeated,
    );
    const chosen = candidates.reduce<(typeof candidates)[number] | null>(
      (best, cur) =>
        best === null || activeScore(cur) > activeScore(best) ? cur : best,
      null,
    );
    return {
      activeCharacterId: chosen?.id ?? request.candidateIds[0] ?? 0,
    };
  }

  /** 行动：挑分数最高的合法动作 */
  private async decideAction(actions: readonly Action[]) {
    const validIndexes = actions.flatMap((action, index) =>
      action.validity === ActionValidity.VALID ? [index] : [],
    );
    if (validIndexes.length === 0) {
      return { chosenActionIndex: 0, usedDice: [] };
    }
    // 记住技能费用，下一轮重投骰子时用得上
    for (const index of validIndexes) {
      for (const req of actions[index].requiredCost) {
        if (req.type >= PbDiceRequirementType.CRYO && req.type <= PbDiceRequirementType.DENDRO) {
          this.wantedDice.add(req.type);
        }
      }
    }
    if (this.state === null) {
      return { chosenActionIndex: validIndexes[0], usedDice: [] };
    }
    const usable = validIndexes.filter((index) => isPayable(actions[index]));
    const pool = usable.length > 0 ? usable : validIndexes;
    const authorHints = this.deckKey ? AUTHOR_HINTS[this.deckKey] : undefined;
    const best = pickAction(actions, pool, {
      who: this.who,
      state: this.state,
      noise: this.noise,
      rng: this.rng,
      style: this.style,
      weights: this.weights,
      data: this.data,
      authorCards: authorHints?.play?.length ? new Set(authorHints.play) : undefined,
      authorBonus: 0.35,
      cardPriors: this.cardPriors,
    });
    // 难度控制：按失误率随机出一手（故意变弱）
    if (this.blunderRate > 0 && this.rng() < this.blunderRate) {
      const randomIndex = pool[Math.floor(this.rng() * pool.length)];
      const randomAction = actions[randomIndex];
      this.log(`${this.name} 失误（难度设定）→ #${randomIndex}`);
      return {
        chosenActionIndex: randomIndex,
        usedDice: [...randomAction.autoSelectedDice],
      };
    }
    const chosen = actions[best.index];
    this.log(
      `${this.name} 启发式首选 #${best.index} ${describeAction(chosen)}（${best.reason}）`,
    );
    if (this.selectAction) {
      const heuristicScores = scoreActions([...actions], pool, {
        who: this.who,
        state: this.state,
        style: this.style,
        weights: this.weights,
        data: this.data,
      });
      const custom = await this.selectAction({ action: [...actions] }, {
        who: this.who,
        state: this.state,
        heuristicIndex: best.index,
        heuristicScores,
      });
      if (custom) {
        return custom;
      }
    }
    return {
      chosenActionIndex: best.index,
      usedDice: [...chosen.autoSelectedDice],
    };
  }

  /** 某些卡牌要求选择一张牌（如千织选武器）：没有牌面信息时取第一张 */
  private decideSelectCard(request: SelectCardRequest) {
    return {
      selectedDefinitionId: request.candidateDefinitionIds[0] ?? 0,
    };
  }

  /** 弹窗选项：优先选"造成伤害"的那个，否则选第一项 */
  private decideSelectOption(request: SelectOptionRequest) {
    const attackIndex = request.options.findIndex(
      (option) => option.text.includes("伤害") || option.text.includes("造成"),
    );
    return { selectedIndex: attackIndex >= 0 ? attackIndex : 0 };
  }

  /** 汇总"可能会用到的元素骰" */
  private collectWantedDice(): Set<number> {
    const wanted = new Set<number>(this.wantedDice);
    for (const card of this.me?.handCard ?? []) {
      for (const req of card.definitionCost) {
        if (
          req.type >= PbDiceRequirementType.CRYO &&
          req.type <= PbDiceRequirementType.DENDRO
        ) {
          wanted.add(req.type);
        }
      }
    }
    const active = this.me?.character.find(
      (c) => c.id === this.me?.activeCharacterId,
    );
    const element = active ? elementOfCharacter(active.definitionId) : null;
    if (element !== null) {
      wanted.add(element);
    }
    // 攻略要点：别把"无效骰"无脑全重投——手里有要同色的牌（武器等）时，
    // 留数量最多的那种元素骰，凑同色用
    const wantsAligned = (this.me?.handCard ?? []).some((card) =>
      card.definitionCost.some((req) => req.type === 8 && req.count >= 2),
    );
    if (wantsAligned) {
      const counts = new Map<number, number>();
      for (const die of this.me?.dice ?? []) {
        if (die >= 1 && die <= 7) {
          counts.set(die, (counts.get(die) ?? 0) + 1);
        }
      }
      const mostCommon = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (mostCommon && mostCommon[1] >= 2) {
        wanted.add(mostCommon[0]);
      }
    }
    return wanted;
  }
}

export function createAi(options: AiOptions): AiPlayer {
  return new AiPlayer(options);
}

function isPayable(action: Action): boolean {
  const needsDice = action.requiredCost.some(
    (req) =>
      req.type !== PbDiceRequirementType.ENERGY &&
      req.type !== PbDiceRequirementType.LEGEND,
  );
  return !needsDice || action.autoSelectedDice.length > 0;
}

function describeAction(action: Action): string {
  const act = action.action;
  if (!act) {
    return "未知动作";
  }
  switch (act.$case) {
    case "useSkill":
      return `技能 ${act.value.skillDefinitionId}`;
    case "playCard":
      return `出牌 ${act.value.cardDefinitionId}`;
    case "switchActive":
      return `换人 ${act.value.characterDefinitionId}`;
    case "elementalTuning":
      return `调和 ${act.value.removedCardId}`;
    case "declareEnd":
      return "宣布结束";
  }
}

/**
 * 角色定义 id 的前两位编码了元素（1101 冰、1201 水、1301 火、1401 雷、
 * 1501 风、1601 岩、1701 草）。拿不到牌库定义时的兜底。
 */
function elementOfCharacter(definitionId: number): number | null {
  if (definitionId < 1100 || definitionId >= 1800) {
    return null;
  }
  return Math.floor(definitionId / 100) % 10;
}

function activeScore(character: {
  health: number;
  maxHealth: number;
  energy: number;
}) {
  return character.health + character.energy * 0.5;
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

function sleep(ms: number) {
  return ms > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();
}
