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
 * 后台 ponder：对手思考时，用空闲时间从当前局面自我对弈若干条线，
 * 估计"我现在有多大的赢面"。纯代码、静默模式，不占界面。
 */

import { Game, deserializeGameStateLog, serializeGameStateLog, type GameState } from "@gi-tcg/core";
import type { GameData } from "@gi-tcg/core/data";
import { determinizeState, evaluateState, fastReply } from "./search";

export interface PonderOptions {
  data: GameData;
  state: GameState;
  who: 0 | 1;
  /** 时间预算，毫秒 */
  budgetMs: number;
  /** 明牌模式：直接用真实隐藏信息（默认按公开信息采样） */
  perfectInformation?: boolean;
  /** 每条线最多推进多少动作，0 表示下到结束 */
  maxActions?: number;
  rng?: () => number;
}

export interface PonderResult {
  /** 我方胜率（截断的线用局面评估折算） */
  winRate: number;
  rollouts: number;
  elapsedMs: number;
}

export async function ponderPosition(options: PonderOptions): Promise<PonderResult> {
  const startedAt = Date.now();
  const rng = options.rng ?? Math.random;
  const maxActions = options.maxActions ?? 16;
  const serialized = JSON.stringify(
    serializeGameStateLog([{ state: options.state, canResume: true }]),
  );
  let scoreSum = 0;
  let rollouts = 0;
  const deadline = startedAt + options.budgetMs;

  while (Date.now() < deadline) {
    const restored = deserializeGameStateLog(
      options.data,
      JSON.parse(serialized),
    )[0].state;
    if (!options.perfectInformation) {
      determinizeState(restored, options.who, rng);
    }
    // 推演只需要粗排序，跳过动作预览能显著提高同样时间内的 rollout 数
    const game = new Game(restored, { silent: true, skipPreview: true });
    let actionCount = 0;
    let cutShort = false;
    const responder = async (request: Parameters<typeof fastReply>[0]) => {
      if (request.request?.$case === "action") {
        actionCount += 1;
        if (maxActions > 0 && actionCount > maxActions) {
          cutShort = true;
          throw new Error("ponder cutoff");
        }
      }
      return fastReply(request, null, rng);
    };
    game.players[0].io = { notify: () => {}, rpc: responder };
    game.players[1].io = { notify: () => {}, rpc: responder };
    const winner = await game.start().catch(() => void 0);
    const score = cutShort
      ? (evaluateState(game.state, options.who) + 1) / 2
      : winner === options.who
        ? 1
        : winner === null
          ? 0.5
          : 0;
    scoreSum += score;
    rollouts += 1;
  }

  return {
    winRate: rollouts === 0 ? 0.5 : scoreSum / rollouts,
    rollouts,
    elapsedMs: Date.now() - startedAt,
  };
}
