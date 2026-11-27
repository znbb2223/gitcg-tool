import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { stateFeatures } from "../dist/index.js";
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const decks=[{characters:lib[0].chars,cards:lib[0].cards},{characters:lib[5].chars,cards:lib[5].cards}];
const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 7}));
console.log("初始 state 有 players:", !!game.state.players);
try { console.log("stateFeatures:", stateFeatures(game.state, 0).slice(0,4)); }
catch(e) { console.log("stateFeatures 抛错:", e.message); }
const p = game.state.players?.[0];
console.log("player 字段:", p ? Object.keys(p).join(",") : "无");
