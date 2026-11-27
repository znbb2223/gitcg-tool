import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 7}));
let shown = 0;
for (const seat of [0,1]) {
  const io = createAi({who:seat, seed:8+seat, delayMs:0, data});
  const orig = io.rpc.bind(io);
  io.rpc = async (req) => {
    if (req.request?.$case === "action" && shown < 1) {
      shown++;
      console.log("value keys:", Object.keys(req.request.value));
      console.log("action len:", req.request.value.action?.length);
      const first = req.request.value.action?.[0];
      console.log("first action keys:", first && Object.keys(first));
      console.log("first action.action:", first?.action?.$case);
    }
    const res = await orig(req);
    if (shown === 1 && res) { console.log("resp keys:", Object.keys(res), "chosen:", res.chosenActionIndex); }
    return res;
  };
  game.players[seat].io = io;
}
const w = await game.start();
console.log("winner:", w);
