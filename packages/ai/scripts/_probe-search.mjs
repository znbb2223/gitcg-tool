import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction } from "../dist/index.js";

const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const d = lib[0];
const game = new Game(Game.createInitialState({decks:[{characters:d.chars,cards:d.cards},{characters:lib[1].chars,cards:lib[1].cards}], data, versionBehavior: CURRENT_VERSION, randomSeed: 42}));
let calls = 0;
game.players[0].io = createAi({who:0, seed:42, delayMs:0, data, selectAction: async (request, ctx) => {
  calls++;
  const r = await searchBestAction(request, {who:0, data, state: game.state, budgetMs: 150, maxActions: 40});
  if (calls === 1) console.log("result keys:", Object.keys(r), "candidates:", r.candidates?.length, "rollouts:", r.rollouts);
  return {chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice};
}});
game.players[1].io = createAi({who:1, seed:43, delayMs:0, data});
const w = await game.start();
console.log("winner:", w, "calls:", calls);
