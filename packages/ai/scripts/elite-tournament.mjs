// 精英赛：Top N 牌组循环对战，产出精细排名
// 用法: node scripts/elite-tournament.mjs <shard> <shardTotal> [topN=20] [gamesPerPair=2]
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi, deckWinRate, recordGame, styleOfDeck } from "../dist/index.js";

const shard = Number(process.argv[2] ?? 0);
const shardTotal = Number(process.argv[3] ?? 1);
const topN = Number(process.argv[4] ?? 20);
const gamesPerPair = Number(process.argv[5] ?? 2);
const data = getData(CURRENT_VERSION);
const learning = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));

const picks = Object.entries(learning.decks)
  .filter(([, record]) => record.games >= 2)
  .map(([key, record]) => ({ key, record, smooth: deckWinRate(learning, key) ?? 0.5 }))
  .sort((a, b) => b.smooth - a.smooth)
  .slice(0, topN)
  .map((item) => ({ key: item.key, characters: item.record.characters, cards: item.record.cards }));

const pairs = [];
for (let i = 0; i < picks.length; i++) {
  for (let j = i + 1; j < picks.length; j++) pairs.push([i, j]);
}

const stats = picks.map(() => ({ games: 0, wins: 0 }));
let seed = 3_000_000 + shard * 10_000;
let played = 0;
const started = Date.now();

for (let p = shard; p < pairs.length; p += shardTotal) {
  const [i, j] = pairs[p];
  for (let g = 0; g < gamesPerPair; g++) {
    const firstIsI = g % 2 === 0;
    const a = firstIsI ? picks[i] : picks[j];
    const b = firstIsI ? picks[j] : picks[i];
    const gameSeed = seed++;
    const game = new Game(
      Game.createInitialState({
        decks: [a, b],
        data,
        versionBehavior: CURRENT_VERSION,
        randomSeed: gameSeed,
      }),
    );
    game.players[0].io = createAi({ who: 0, seed: gameSeed + 1, style: styleOfDeck(a) });
    game.players[1].io = createAi({ who: 1, seed: gameSeed + 2, style: styleOfDeck(b) });
    const winner = await game.start();
    recordGame(learning, [a, b], winner);
    const si = firstIsI ? stats[i] : stats[j];
    const sj = firstIsI ? stats[j] : stats[i];
    si.games += 1;
    sj.games += 1;
    if (winner === 0) si.wins += 1;
    else if (winner === 1) sj.wins += 1;
    played += 1;
  }
  fs.writeFileSync(`docs/elite-shard-${shard}.json`, JSON.stringify({ learning, stats }));
  if (played % 20 === 0) {
    console.log(`shard ${shard}: ${played} 局，${((Date.now() - started) / played).toFixed(0)}ms/局`);
  }
}

const ranked = picks
  .map((deck, index) => ({ deck, ...stats[index], rate: stats[index].games ? stats[index].wins / stats[index].games : 0 }))
  .sort((a, b) => b.rate - a.rate);
console.log(`\nshard ${shard} 排名：`);
for (const [index, item] of ranked.entries()) {
  const code = DEFAULT_ASSETS_MANAGER.encode({ characters: item.deck.characters, cards: item.deck.cards });
  console.log(`${index + 1}. ${item.deck.characters.join("/")}  ${item.wins}胜${item.games - item.wins}负  ${(item.rate * 100).toFixed(0)}%（${item.games} 局）`);
  console.log(`   ${code}`);
}
fs.writeFileSync(`docs/elite-shard-${shard}.json`, JSON.stringify({ learning, stats, ranked }, null, 1));
