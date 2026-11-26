// 牌组库「训练」后台 worker：拿指定牌组和牌组库里的对手对打，统计胜负，不渲染棋盘
/// <reference lib="webworker" />

import getData from "@gi-tcg/data";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import { createAi, deckKeyOf, playFastGame, styleOfDeck } from "@gi-tcg/ai";

interface Deck {
  characters: number[];
  cards: number[];
}

interface StartMessage {
  type: "start";
  deck: Deck;
  opponents: Deck[];
  games: number;
  deadline: number;
  /** 快速自对弈：用 fastReply 推演，不走完整 AI 评估，速度快很多 */
  method?: "fast" | "deep";
  /** 牌组库「AI 设置」里的参数（只影响训练，不影响其它页面） */
  aiSettings?: {
    delayMs?: number;
    blunderRate?: number;
    style?: "aggro" | "midrange" | "control" | "random";
    weights?: Record<string, number>;
  };
}

interface ProgressMessage {
  type: "progress";
  played: number;
  wins: number;
  losses: number;
  draws: number;
  rounds: number;
}

interface OpponentStat {
  index: number;
  games: number;
  opponentWins: number;
}

interface DoneMessage extends ProgressMessage {
  type: "done";
  stopped: boolean;
  opponentStats: OpponentStat[];
}

const data = getData(CURRENT_VERSION);

self.addEventListener("message", async (event: MessageEvent<StartMessage>) => {
  const message = event.data;
  if (message?.type !== "start") {
    return;
  }
  const { deck, opponents, games, deadline } = message;
  const aiSettings = message.aiSettings ?? {};
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let rounds = 0;
  let played = 0;
  let stopped = false;
  const opponentStats = new Map<number, OpponentStat>();

  const style = styleOfDeck(deck);
  const deckKey = deckKeyOf(deck);

  for (let i = 0; i < games; i++) {
    if (Date.now() > deadline) {
      stopped = true;
      break;
    }
    const opponentIndex = Math.floor(Math.random() * opponents.length);
    const opponent = opponents[opponentIndex];
    if (!opponent) {
      break;
    }
    const stat = opponentStats.get(opponentIndex) ?? { index: opponentIndex, games: 0, opponentWins: 0 };
    const seed = 500000 + Math.floor(Math.random() * 900000);
    try {
      if (message.method === "fast") {
        const result = await playFastGame(data, [deck, opponent], seed, {
          blunderRate: aiSettings.blunderRate,
        });
        played++;
        rounds += result.rounds ?? 0;
        stat.games += 1;
        if (result.winner === 0) {
          wins++;
        } else if (result.winner === 1) {
          losses++;
          stat.opponentWins += 1;
        } else {
          draws++;
        }
        opponentStats.set(opponentIndex, stat);
        // 快速自对弈也要逐局上报进度，日志才能像深度强化一样实时更新
        self.postMessage({
          type: "progress",
          played,
          wins,
          losses,
          draws,
          rounds,
        });
        continue;
      }
      const game = new Game(
        Game.createInitialState({
          decks: [deck, opponent],
          data,
          versionBehavior: CURRENT_VERSION,
          randomSeed: seed,
        }),
        { silent: true },
      );
      game.players[0].io = createAi({
        who: 0,
        seed,
        delayMs: 0,
        blunderRate: aiSettings.blunderRate,
        weights: aiSettings.weights as never,
        style: aiSettings.style && aiSettings.style !== "random" ? aiSettings.style : style,
        data,
        deckKey,
      });
      game.players[1].io = createAi({
        who: 1,
        seed: seed + 7,
        delayMs: 0,
        blunderRate: aiSettings.blunderRate,
        weights: aiSettings.weights as never,
        style: styleOfDeck(opponent),
        data,
      });
      const winner = await game.start();
      played++;
      rounds += game.state.roundNumber ?? 0;
      stat.games += 1;
      if (winner === 0) {
        wins++;
      } else if (winner === 1) {
        losses++;
        stat.opponentWins += 1;
      } else {
        draws++;
      }
      opponentStats.set(opponentIndex, stat);
    } catch {
      // 单局异常不打断训练
    }
    self.postMessage({
      type: "progress",
      played,
      wins,
      losses,
      draws,
      rounds,
    });
  }

  const done: DoneMessage = {
    type: "done",
    played,
    wins,
    losses,
    draws,
    rounds,
    stopped,
    opponentStats: [...opponentStats.values()],
  };
  self.postMessage(done);
});
