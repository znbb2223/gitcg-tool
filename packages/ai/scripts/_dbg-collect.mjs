import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, stateFeatures, styleOfDeck } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 11}));
const counts = {0:0,1:0};
for (const seat of [0,1]) {
  const io = createAi({who:seat, seed:11+seat, delayMs:0, data, style: styleOfDeck(decks[seat])});
  const orig = io.rpc.bind(io);
  io.rpc = async (req) => {
    if (req.request?.$case === "action") counts[seat]++;
    return orig(req);
  };
  game.players[seat].io = io;
}
const w = await game.start();
console.log("winner", w, "action requests per seat:", counts, "rounds:", game.state.roundNumber);
