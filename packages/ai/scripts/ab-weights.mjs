// 验证进化出来的权重：与默认权重对打（镜像配对，全新 seed 区间）
// 用法: node ab-weights.mjs --weights=/tmp/evolve-best.json --pairs=40
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_AI_WEIGHTS, createAi, styleOfDeck } from "../dist/index.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, value = "true"] = item.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const PAIRS = Number(args.pairs ?? 40);
const OFFSET = Number(args.offset ?? 500);
const tuned = JSON.parse(fs.readFileSync(args.weights ?? "/tmp/evolve-best.json", "utf8")).weights;

const data = getData(CURRENT_VERSION);
const library = JSON.parse(
  fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"),
).decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);

async function playOne(pair, aSeat) {
  const deckA = library[(pair * 41) % library.length];
  const deckB = library[(pair * 41 + 173) % library.length];
  const decks = [
    { characters: deckA.chars, cards: deckA.cards },
    { characters: deckB.chars, cards: deckB.cards },
  ];
  const seed = 90000 + pair * 131;
  const game = new Game(
    Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: seed }),
  );
  for (const seat of [0, 1]) {
    game.players[seat].io = createAi({
      who: seat,
      seed: seed + seat,
      delayMs: 0,
      style: styleOfDeck(decks[seat]),
      data,
      weights: seat === aSeat ? tuned : DEFAULT_AI_WEIGHTS,
    });
  }
  return game.start();
}

let aWin = 0;
let bWin = 0;
for (let i = 0; i < PAIRS; i += 1) {
  const pair = OFFSET + i;
  const first = await playOne(pair, 0);
  const second = await playOne(pair, 1);
  if (first === 0) aWin += 1;
  if (first === 1) bWin += 1;
  if (second === 1) aWin += 1;
  if (second === 0) bWin += 1;
  if ((i + 1) % 10 === 0) {
    console.log(`对 ${i + 1}/${PAIRS}: 进化 ${aWin} - ${bWin} 默认`);
  }
}
const total = aWin + bWin;
console.log(
  `\nRESULT ${JSON.stringify({ pairs: PAIRS, games: total, tunedWin: aWin, defaultWin: bWin, winRate: total ? +(aWin / total).toFixed(4) : null })}`,
);
