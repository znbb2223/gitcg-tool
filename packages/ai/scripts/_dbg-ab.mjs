import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 3}));
let calls = 0;
const ai0 = createAi({who:0, seed:3, delayMs:0, data, style: styleOfDeck(decks[0]), selectAction: async (req, ctx) => {
  calls++;
  const r = await searchBestAction(req, {who:0, data, state: game.state, budgetMs:200, maxActions:12});
  return {chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice};
}});
console.log("typeof selectAction:", typeof ai0.selectAction, "| has rpc:", typeof ai0.rpc, "| state:", ai0.state);
game.players[0].io = ai0;
game.players[1].io = createAi({who:1, seed:4, delayMs:0, data, style: styleOfDeck(decks[1])});
const w = await game.start();
console.log("winner:", w, "selectAction calls:", calls);
