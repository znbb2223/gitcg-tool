// 大规模筛选赛：1600 套广场牌组随机配对，每套固定局数，交替先后手抵消偏差
// 用法: node scripts/swarm-tournament.mjs <shardIndex> <shardTotal> [gamesPerDeck]
import fs from "node:fs";
import { CURRENT_VERSION } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import {
  DECK_LIBRARY, createLearning, playFastGame, recordGame, validateDeck,
} from "../dist/index.js";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";

const shardIndex = Number(process.argv[2] ?? 0);
const shardTotal = Number(process.argv[3] ?? 1);
const gamesPerDeck = Number(process.argv[4] ?? 2);
const data = getData(CURRENT_VERSION);
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();

const decks = DECK_LIBRARY.filter((deck) => validateDeck(deck, deckData).valid)
  .map((deck) => ({ characters: deck.characters, cards: deck.cards, label: deck.subject }));
const learning = createLearning();
let seed = 1_000_000 + shardIndex * 100_000;
const started = Date.now();
let games = 0;

for (let i = shardIndex; i < decks.length; i += shardTotal) {
  const me = decks[i];
  for (let g = 0; g < gamesPerDeck; g++) {
    const opponent = decks[Math.floor(Math.random() * decks.length)];
    if (opponent === me) continue;
    const meFirst = g % 2 === 0;
    const pair = meFirst ? [me, opponent] : [opponent, me];
    const winner = await playFastGame(data, pair, seed++);
    recordGame(learning, pair, winner);
    games += 1;
    if (games % 200 === 0) {
      const rate = (games / ((Date.now() - started) / 1000)).toFixed(2);
      console.log(`shard ${shardIndex}: ${games} 局，${rate} 局/秒`);
    }
  }
}

fs.writeFileSync(
  `docs/learning-shard-${shardIndex}.json`,
  JSON.stringify(learning, null, 1),
);
console.log(`shard ${shardIndex} 完成：${games} 局，用时 ${((Date.now() - started) / 1000).toFixed(0)}s`);
