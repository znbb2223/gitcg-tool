import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, styleOfDeck } from "../dist/index.js";

const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks;
const data = getData(CURRENT_VERSION);
const GAMES = Number(process.argv[2] ?? 10);

let decisions = 0;
const t0 = Date.now();
for (let i = 0; i < GAMES; i++) {
  const a = lib[(i*37) % lib.length];
  const b = lib[(i*37+211) % lib.length];
  const decks = [{characters:a.chars,cards:a.cards},{characters:b.chars,cards:b.cards}];
  const game = new Game(Game.createInitialState({decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 5000+i}));
  const count = () => { decisions++; };
  for (const seat of [0,1]) {
    const io = createAi({who:seat, seed:5000+i+seat, delayMs:0, data, style: styleOfDeck(decks[seat])});
    const orig = io.rpc.bind(io);
    io.rpc = async (req) => { if (req.request?.$case === "action") count(); return orig(req); };
    game.players[seat].io = io;
  }
  await game.start();
}
const ms = Date.now() - t0;
console.log(JSON.stringify({
  games: GAMES,
  totalMs: ms,
  msPerGame: +(ms/GAMES).toFixed(1),
  gamesPerSec: +(GAMES/(ms/1000)).toFixed(2),
  decisions,
  decisionsPerGame: +(decisions/GAMES).toFixed(1),
  samplesBothSidesPerGame: +((decisions/GAMES)*2).toFixed(1),
}));
