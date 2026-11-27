import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, stateFeatures, FEATURE_NAMES } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"))
  .decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
console.log("特征维度:", FEATURE_NAMES.length, "| 末尾四项:", FEATURE_NAMES.slice(-4).join(", "));

const rows = [];
const deckA = lib[3], deckB = lib[50];
const game = new Game(Game.createInitialState({
  decks: [{ characters: deckA.chars, cards: deckA.cards }, { characters: deckB.chars, cards: deckB.cards }],
  data, versionBehavior: CURRENT_VERSION, randomSeed: 4242,
}));
for (const seat of [0, 1]) {
  game.players[seat].io = createAi({
    who: seat, seed: 7 + seat, delayMs: 0, data,
    selectAction: async () => {
      const f = stateFeatures(game.state, seat);
      rows.push(f.slice(-4));
      return undefined;
    },
  });
}
await game.start().catch(() => {});
const n = rows.length;
const avg = (i) => (rows.reduce((s, r) => s + r[i], 0) / n).toFixed(3);
console.log(`采样 ${n} 次决策`);
console.log(`  骰子缺口均值 ${avg(0)} | 能量缺口均值 ${avg(1)} | 大招就绪率 ${avg(2)} | 可调和手牌 ${avg(3)}`);
console.log("  样例:", rows.slice(0, 3).map((r) => r.map((v) => v.toFixed(2)).join("/")));
