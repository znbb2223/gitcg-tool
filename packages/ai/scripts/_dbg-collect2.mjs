import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, stateFeatures } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 7}));
const samples = []; let decisions = 0;
for (const seat of [0,1]) {
  const io = createAi({who:seat, seed:8+seat, delayMs:0, data});
  const original = io.rpc.bind(io);
  io.rpc = async (request) => {
    if (request.request?.$case !== "action") return original(request);
    const v = request.request.value;
    console.log("REQ value keys:", Object.keys(v), "| typeof action:", typeof v.action, "| isArray:", Array.isArray(v.action));
    const snapshot = { features: [], round: game.state.roundNumber, candidates: Array.isArray(v.action) ? v.action.length : -1 };
    decisions++;
    try {
      const response = await original(request);
      snapshot.action = "x"; snapshot.index = response?.chosenActionIndex;
      samples.push({ seat, ...snapshot });
      return response;
    } catch (e) {
      console.log("RPC THREW:", e.message, "\nSTACK:", (e.stack||"").split("\n").slice(0,4).join(" | "));
      throw e;
    }
  };
  game.players[seat].io = io;
}
try {
  const w = await game.start();
  console.log("winner:", w, "| decisions:", decisions, "| samples:", samples.length);
} catch (e) { console.log("ERROR:", e.message); }
