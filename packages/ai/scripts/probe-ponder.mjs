// 验证后台预计算：每手决策后预计算「我方动作→对手回应→我方下一步」，统计缓存命中
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { actionKey, createAi, precomputeLine, searchBestAction, styleOfDeck } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"))
  .decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const GAMES = Number(process.argv[2] ?? 2);
const BACK_BUDGET = Number(process.argv[3] ?? 2000);
let decisions = 0, recorded = 0, hits = 0, hitGames = 0;

async function playOne(gi) {
  const deckA = lib[(gi * 37) % lib.length], deckB = lib[(gi * 37 + 211) % lib.length];
  const decks = [{ characters: deckA.chars, cards: deckA.cards }, { characters: deckB.chars, cards: deckB.cards }];
  const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 90000 + gi }));
  for (const seat of [0, 1]) {
    game.players[seat].io = createAi({
      who: seat, seed: 1234 + seat, delayMs: 0, style: styleOfDeck(decks[seat]), data,
      selectAction: async (request) => {
        decisions += 1;
        const before = performance.now();
        const r = await searchBestAction(request, { who: seat, data, state: game.state, budgetMs: 150, maxActions: 10, maxCandidates: 8 });
        const elapsed = performance.now() - before;
        const chosen = request.action[r.chosenActionIndex];
        // 模拟后台思考：预算内把「我方这手 → 对手回应 → 我方下一手」算好
        try {
          const res = await precomputeLine(request, {
            who: seat, data, state: game.state, budgetMs: BACK_BUDGET,
            maxActions: 10, maxCandidates: 8, ourActionKey: chosen ? actionKey(chosen) : "",
          });
          if (res.recorded) recorded += 1;
        } catch { /* 预计算失败不影响对局 */ }
        if (elapsed < 40) hits += 1; // 命中缓存的搜索会明显更快
        return { chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice };
      },
    });
  }
  await game.start().catch(() => {});
  hitGames += 1;
}
for (let i = 0; i < GAMES; i += 1) await playOne(i);
console.log(`决策 ${decisions} | 后台记录 ${recorded} 次（${(recorded/decisions*100).toFixed(1)}%）| 前台快速复核 ${hits} 次（${(hits/decisions*100).toFixed(1)}%）`);
