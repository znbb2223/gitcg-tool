// 定向锦标赛：从经验库里挑高分牌组互相循环对战，产出可信排名
import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import {
  DECK_LIBRARY, createAi, deckWinRate, recordGame, styleOfDeck,
} from "../dist/index.js";

const deckCount = Number(process.argv[2] ?? 12);
const gamesPerPair = Number(process.argv[3] ?? 4);
const data = getData(CURRENT_VERSION);
const learning = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));

// 候选：先取经验库里打过的、胜率高的；不够就按广场热度补
const played = Object.entries(learning.decks ?? {})
  .map(([key, record]) => ({ key, record, smooth: deckWinRate(learning, key) ?? 0.5 }))
  .filter((item) => item.record.games >= 2)
  .sort((a, b) => b.smooth - a.smooth)
  .map((item) => ({ characters: item.record.characters, cards: item.record.cards, label: `经验·${item.record.characters.join("/")}` }));

const picks = [...played];
if (picks.length < deckCount) {
  const hot = [...DECK_LIBRARY].sort((a, b) => b.popularity - a.popularity);
  for (const entry of hot) {
    if (picks.length >= deckCount) break;
    const key = `${entry.characters.join(",")}|${[...entry.cards].sort((x, y) => x - y).join(",")}`;
    if (picks.some((p) => `${p.characters.join(",")}|${[...p.cards].sort((x, y) => x - y).join(",")}` === key)) continue;
    picks.push({ characters: entry.characters, cards: entry.cards, label: `广场·${entry.subject}` });
  }
}
const decks = picks.slice(0, deckCount);
console.log(`参赛牌组 ${decks.length} 副，每对 ${gamesPerPair} 局`);

const stats = decks.map((deck) => ({ deck, games: 0, wins: 0, draws: 0 }));
let firstWins = 0, secondWins = 0;
const recordKey = (deck) => `${deck.characters.join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`;
let seed = 90000;
for (let i = 0; i < decks.length; i++) {
  for (let j = i + 1; j < decks.length; j++) {
    for (let g = 0; g < gamesPerPair; g++) {
      const firstIsI = g % 2 === 0;
      const a = firstIsI ? decks[i] : decks[j];
      const b = firstIsI ? decks[j] : decks[i];
      const gameSeed = seed++;
      const game = new Game(
        Game.createInitialState({ decks: [a, b], data, versionBehavior: CURRENT_VERSION, randomSeed: gameSeed }),
      );
      game.players[0].io = createAi({ who: 0, seed: gameSeed + 1, style: styleOfDeck(a) });
      game.players[1].io = createAi({ who: 1, seed: gameSeed + 2, style: styleOfDeck(b) });
      const winner = await game.start();
      if (winner === 0) firstWins++; else if (winner === 1) secondWins++;
      recordGame(learning, [a, b], winner);
      const si = firstIsI ? stats[i] : stats[j];
      const sj = firstIsI ? stats[j] : stats[i];
      si.games += 1; sj.games += 1;
      if (winner === null) { si.draws += 1; sj.draws += 1; }
      else if (winner === 0) si.wins += 1; else sj.wins += 1;
    }
  }
}

fs.writeFileSync("docs/learning.json", JSON.stringify(learning, null, 1));
const ranked = stats
  .map((s) => ({ ...s, rate: s.games ? s.wins / s.games : 0 }))
  .sort((a, b) => b.rate - a.rate);
console.log(`\n先手 ${firstWins} 胜 / 后手 ${secondWins} 胜（用来判断先后手偏差）`);
console.log("\n排名：");
for (const [index, item] of ranked.entries()) {
  const code = DEFAULT_ASSETS_MANAGER.encode({ characters: item.deck.characters, cards: item.deck.cards });
  console.log(`${index + 1}. ${item.deck.characters.join("/")}  ${item.wins}胜${item.games - item.wins - item.draws}负${item.draws}平  ${(item.rate * 100).toFixed(0)}%  ${item.deck.label}`);
  console.log(`   ${code}`);
}
