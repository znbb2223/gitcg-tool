// 分批筛选赛（支持断点续跑）：每次处理一批牌组，进度逐局落盘。
// 遇到引擎死循环时由 supervisor 杀掉进程，重启后从下一局继续。
// 用法: node scripts/batch-tournament.mjs <batch> <batchSize> <gamesPerDeck>
import fs from "node:fs";
import { CURRENT_VERSION } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import {
  DECK_LIBRARY, createLearning, mergeLearning, playFastGame, recordGame, validateDeck,
} from "../dist/index.js";

const batch = Number(process.argv[2] ?? 0);
const batchSize = Number(process.argv[3] ?? 400);
const gamesPerDeck = Number(process.argv[4] ?? 2);
const progressPath = `docs/progress-batch-${batch}.json`;
const donePath = `docs/learning-batch-${batch}.done`;

const data = getData(CURRENT_VERSION);
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const all = DECK_LIBRARY.filter(
  (deck) => deck.source === "cardsquare" && validateDeck(deck, deckData).valid,
).map((deck) => ({ characters: deck.characters, cards: deck.cards }));
const decks = all.slice(batch * batchSize, (batch + 1) * batchSize);

let learning = createLearning();
let startIndex = 0;
if (fs.existsSync(progressPath)) {
  const saved = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  learning = mergeLearning(createLearning(), saved.learning);
  // attempts>0 说明这套牌上一轮把引擎卡死了：跳过它继续
  startIndex = (saved.index ?? 0) + (saved.attempts > 0 ? 1 : 0);
  console.log(`batch ${batch}: 续跑，从第 ${startIndex} 套开始（跳过卡死 ${saved.attempts > 0 ? saved.index : "-"}）`);
}
let seed = 2_000_000 + batch * 10_000 + startIndex;
for (let i = startIndex; i < decks.length; i++) {
  const me = decks[i];
  fs.writeFileSync(progressPath, JSON.stringify({ index: i, attempts: 0, learning }));
  for (let g = 0; g < gamesPerDeck; g++) {
    const opponent = all[Math.floor(Math.random() * all.length)];
    const pair = g % 2 === 0 ? [me, opponent] : [opponent, me];
    const winner = await playFastGame(data, pair, seed++);
    recordGame(learning, pair, winner);
  }
  fs.writeFileSync(progressPath, JSON.stringify({ index: i + 1, attempts: 0, learning }));
  fs.appendFileSync(`/tmp/batch-${batch}.log`, `batch ${batch}: ${i + 1}/${decks.length} 套\n`);
}
fs.writeFileSync(`docs/learning-batch-${batch}.json`, JSON.stringify(learning, null, 1));
fs.writeFileSync(donePath, "done");
console.log(`batch ${batch} 完成`);
