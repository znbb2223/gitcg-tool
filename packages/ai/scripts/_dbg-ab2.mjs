import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks.filter(d=>d.chars?.length===3&&d.cards?.length>=28);
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 70000}));
let calls = 0;
const makeAi = (who, seed, deck) => createAi({
  who, seed, delayMs: 0, style: styleOfDeck(deck), data,
  selectAction: async (request, context) => {
    calls++;
    const r = await searchBestAction(request, {who, data, state: game.state, budgetMs: 300, maxActions: 12});
    return {chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice};
  },
});
for (const seat of [0,1]) game.players[seat].io = makeAi(seat, 7+seat, decks[seat]);
const w = await game.start();
console.log("winner:", w, "| selectAction 调用:", calls, "| rounds:", game.state.roundNumber);
