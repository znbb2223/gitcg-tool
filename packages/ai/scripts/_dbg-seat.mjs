import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, styleOfDeck } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const results = [];
for (let i = 0; i < 10; i++) {
  const a = lib[(i*37)%lib.length], b = lib[(i*37+211)%lib.length];
  const decks=[{characters:a.chars,cards:a.cards},{characters:b.chars,cards:b.cards}];
  const g = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 70000+i*97}));
  for (const s of [0,1]) g.players[s].io = createAi({who:s, seed:70000+i*97+s, delayMs:0, data, style: styleOfDeck(decks[s])});
  const w = await g.start();
  results.push(w);
}
console.log("winner 分布:", JSON.stringify(results.reduce((acc,w)=>{acc[w===null?"draw":w]=(acc[w===null?"draw":w]??0)+1;return acc;},{})));
console.log("明细:", results.join(","));
