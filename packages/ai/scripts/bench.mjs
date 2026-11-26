// 搜索 AI vs 启发式 AI 的无头对战测试
// 用法: node packages/ai/scripts/bench.mjs [budgetMs] [maxActions] [games]
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi, searchBestAction } from "../dist/index.js";

const D0 = "FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA";
const D1 = "FdHxNj8TAWDQxFkMFkAhyWIYCYDA45wOCUDQ5J0PGEAh9IIPGWDh9p4YC6FgirYRCxAA";
const budget = Number(process.argv[2] ?? 2000);
const maxActions = Number(process.argv[3] ?? 6);
const games = Number(process.argv[4] ?? 4);
const perfect = process.argv[5] === "perfect";
const data = getData(CURRENT_VERSION);
const decks = [DEFAULT_ASSETS_MANAGER.decode(D0), DEFAULT_ASSETS_MANAGER.decode(D1)];

const makeAi = (who, seed, isSearch, gameRef) =>
  createAi({
    who,
    seed,
    delayMs: 0,
    ...(isSearch
      ? {
          selectAction: async (request, context) => {
            const result = await searchBestAction(request, {
              who,
              data,
              state: gameRef.current.state,
              budgetMs: budget,
              maxActions,
              rng: Math.random,
              perfectInformation: perfect,
              heuristicScores: new Map(
                context.heuristicScores.map((entry) => [entry.index, entry.score]),
              ),
            });
            return { chosenActionIndex: result.chosenActionIndex, usedDice: result.usedDice };
          },
        }
      : {}),
  });

let searchWins = 0, baseWins = 0, draws = 0;
for (let i = 0; i < games; i++) {
  const game = new Game(
    Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 100 + i }),
  );
  const gameRef = { current: game };
  const searchWho = i % 2;
  const baseWho = 1 - searchWho;
  const ais = [];
  ais[searchWho] = makeAi(searchWho, 2000 + i, true, gameRef);
  ais[baseWho] = makeAi(baseWho, 3000 + i, false, gameRef);
  game.players[searchWho].io = ais[searchWho];
  game.players[baseWho].io = ais[baseWho];
  const t = Date.now();
  const winner = await game.start();
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  if (winner === null) draws++;
  else if (winner === searchWho) searchWins++;
  else baseWins++;
  console.log(`第 ${i + 1} 局：${winner === null ? "平" : winner === searchWho ? "搜索AI 胜" : "启发式 胜"}（${game.state.roundNumber} 回合，${secs}s）`);
}
console.log(`\n搜索 AI ${searchWins} 胜 / 启发式 ${baseWins} 胜 / 平 ${draws}（预算 ${budget}ms，深度 ${maxActions || "整局"}）`);
