import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import { ActionValidity } from "@gi-tcg/typings";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"))
  .decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const burstIds = new Set(JSON.parse(fs.readFileSync("/tmp/burst-ids.json", "utf8")).burst);
const BUDGET = Number(process.argv[2] ?? 150);
const GAMES = Number(process.argv[3] ?? 5);
let decisions = 0, validBurstCases = 0, chosenBurst = 0, tunings = 0;

async function playOne(gi) {
  const deckA = lib[(gi * 37) % lib.length], deckB = lib[(gi * 37 + 211) % lib.length];
  const decks = [{ characters: deckA.chars, cards: deckA.cards }, { characters: deckB.chars, cards: deckB.cards }];
  const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 90000 + gi }));
  for (const seat of [0, 1]) {
    game.players[seat].io = createAi({
      who: seat, seed: 1234 + seat, delayMs: 0, style: styleOfDeck(decks[seat]), data,
      selectAction: async (request) => {
        decisions += 1;
        const hasValidBurst = request.action.some(
          (a) => a.action?.$case === "useSkill" && burstIds.has(a.action.value.skillDefinitionId) && a.validity === ActionValidity.VALID,
        );
        if (hasValidBurst) validBurstCases += 1;
        const r = await searchBestAction(request, { who: seat, data, state: game.state, budgetMs: BUDGET, maxActions: 10, maxCandidates: 8 });
        const chosen = request.action[r.chosenActionIndex];
        if (chosen?.action?.$case === "useSkill" && burstIds.has(chosen.action.value.skillDefinitionId)) chosenBurst += 1;
        if (chosen?.action?.$case === "elementalTuning") tunings += 1;
        return { chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice };
      },
    });
  }
  await game.start().catch(() => {});
}
for (let i = 0; i < GAMES; i += 1) await playOne(i);
console.log(`决策 ${decisions} | 合法大招可用 ${validBurstCases} 次（${(validBurstCases/decisions*100).toFixed(1)}%）`);
console.log(`选中大招 ${chosenBurst} 次（占决策 ${(chosenBurst/decisions*100).toFixed(2)}%，占可用 ${(chosenBurst/Math.max(1,validBurstCases)*100).toFixed(1)}%）`);
console.log(`选中元素调和 ${tunings} 次（占决策 ${(tunings/decisions*100).toFixed(2)}%）`);
