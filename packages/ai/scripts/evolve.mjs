// 自我对弈训练：node packages/ai/scripts/evolve.mjs [局数] [learned|random]
import { CURRENT_VERSION } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import fs from "node:fs";
import {
  buildDeck,
  cardWeights,
  characterWeights,
  runEvolution,
  summarizeDecks,
  summarizeLearning,
  validateDeck,
} from "../dist/index.js";

const games = Number(process.argv[2] ?? 20);
const mode = process.argv[3] ?? "random";
const data = getData(CURRENT_VERSION);
// 有历史经验就接着练，不要覆盖
let existing = null;
try {
  existing = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));
} catch {
  existing = null;
}
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const started = Date.now();

const learning = await runEvolution({
  data,
  learning: existing ?? undefined,
  deckData,
  games,
  mode,
  seed: 20260101,
  onProgress: (progress) => {
    if (progress.done === 1 || progress.done % 5 === 0) {
      const perGame = (progress.elapsedMs / progress.done / 1000).toFixed(2);
      console.log(
        `进度 ${progress.done}/${progress.total} | 先手 ${progress.wins[0]} 胜 / 后手 ${progress.wins[1]} 胜 / 平 ${progress.draws} | ${perGame}s 一局`,
      );
    }
  },
});

console.log("\n" + summarizeLearning(learning));
console.log("\n" + summarizeDecks(learning));
fs.writeFileSync("docs/learning.json", JSON.stringify(learning, null, 1));
const learned = buildDeck({
  deckData,
  seed: 7,
  cardWeights: cardWeights(learning),
  characterWeights: characterWeights(learning),
});
const check = validateDeck(learned, deckData);
console.log(
  `\n训练后的牌组：角色 ${learned.characters.join(",")}，行动牌 ${learned.cards.length} 张，${check.valid ? "合法" : check.errors.join(";")}`,
);
console.log(`总耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
