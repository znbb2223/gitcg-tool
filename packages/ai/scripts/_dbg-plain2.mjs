import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi } from "../dist/index.js";
const all = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const lib = all.filter(d => d.chars?.length === 3 && d.cards?.length >= 28);
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
console.log("deckA:", decks[0].characters.length, "chars,", decks[0].cards.length, "cards");
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 7}));
for (const seat of [0,1]) {
  const io = createAi({who:seat, seed:8+seat, delayMs:0, data});
  const orig = io.rpc.bind(io);
  io.rpc = async (req) => {
    try { return await orig(req); }
    catch (e) { console.log(`seat${seat} rpc error:`, e.message, "|", (e.stack||"").split("\n")[1]?.trim()); throw e; }
  };
  game.players[seat].io = io;
}
const w = await game.start();
console.log("winner:", w, "rounds:", game.state.roundNumber);
