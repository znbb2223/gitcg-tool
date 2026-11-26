import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi } from "../dist/index.js";
const data = getData(CURRENT_VERSION);
const decks = [
  DEFAULT_ASSETS_MANAGER.decode("FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA"),
  DEFAULT_ASSETS_MANAGER.decode("FdHxNj8TAWDQxFkMFkAhyWIYCYDA45wOCUDQ5J0PGEAh9IIPGWDh9p4YC6FgirYRCxAA"),
];
let weakWins = 0, strongWins = 0;
for (let i = 0; i < 20; i++) {
  const weakWho = i % 2;
  const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 500 + i }));
  const ais = [0, 1].map((who) => createAi({ who, seed: 700 + i + who, blunderRate: who === weakWho ? 0.4 : 0 }));
  game.players[0].io = ais[0];
  game.players[1].io = ais[1];
  const winner = await game.start();
  if (winner === weakWho) weakWins++; else if (winner !== null) strongWins++;
}
console.log(`失误率 40% 的一方：${weakWins} 胜 / 正常 AI：${strongWins} 胜`);
