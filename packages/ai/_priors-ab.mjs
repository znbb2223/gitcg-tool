import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import * as NEW from "./dist/index.js";
import * as OLD from "./dist-old/index.js";

const data = getData(CURRENT_VERSION);
const bench = DEFAULT_ASSETS_MANAGER.decode("FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA");
const shield = { characters: [1603, 1602, 1109], cards: [214111,214111,311503,312018,312018,312023,312023,312024,312024,322003,322003,322005,322005,322008,322008,322016,322016,322020,330007,332004,332005,332006,332006,332031,333002,333003,333005,333007,333015,333015] };
const matchups = [["bench", bench], ["护盾", shield]];
for (const [name, deck] of matchups) {
  let nw = 0, ow = 0, dr = 0;
  for (let i = 0; i < 20; i++) {
    const who = i % 2;
    const game = new Game(Game.createInitialState({ decks: [deck, deck], data, versionBehavior: CURRENT_VERSION, randomSeed: 6100 + i }));
    game.players[who].io = NEW.createAi({ who, seed: 6100 + i, delayMs: 0, data });
    game.players[1 - who].io = OLD.createAi({ who: 1 - who, seed: 8100 + i, delayMs: 0, data });
    const w = await game.start();
    if (w === null) dr++; else if (w === who) nw++; else ow++;
  }
  console.log(`${name}：新版 ${nw} / 旧版 ${ow} / 平 ${dr}`);
}
