// 从长期经验库里挑"最强牌组"，输出可导入的分享码
import fs from "node:fs";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { DECK_LIBRARY, deckWinRate, summarizeDecks, validateDeck } from "../dist/index.js";

const minGames = Number(process.argv[2] ?? 3);
const learning = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();

const libraryByKey = new Map(
  DECK_LIBRARY.map((deck) => [
    `${deck.characters.join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`,
    deck,
  ]),
);

const rows = Object.entries(learning.decks ?? {})
  .map(([key, record]) => {
    const decided = record.games - record.draws;
    return {
      key,
      record,
      rate: decided > 0 ? record.wins / decided : 0,
      smooth: deckWinRate(learning, key),
      library: libraryByKey.get(key),
    };
  })
  .filter((row) => row.record.games >= minGames)
  .sort((a, b) => (b.smooth ?? 0) - (a.smooth ?? 0));

console.log(`样本：${learning.games} 局，牌组 ${Object.keys(learning.decks ?? {}).length} 副，达标（≥${minGames} 局）${rows.length} 副\n`);
for (const [index, row] of rows.slice(0, 10).entries()) {
  const deck = { characters: row.record.characters, cards: row.record.cards };
  const code = DEFAULT_ASSETS_MANAGER.encode(deck);
  const valid = validateDeck(deck, deckData).valid;
  const label = row.library ? `社区·${row.library.subject}` : "自组";
  console.log(
    `${index + 1}. ${row.record.characters.join("/")}  ${row.record.wins}胜${row.record.games - row.record.wins - row.record.draws}负${row.record.draws}平  ${(row.rate * 100).toFixed(0)}%（平滑 ${((row.smooth ?? 0) * 100).toFixed(0)}%）${valid ? "" : " [非法!]"}  ${label}`,
  );
  console.log(`   ${code}`);
}
console.log("\n" + summarizeDecks(learning, minGames));
