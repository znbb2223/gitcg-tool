// 合并并行筛选赛的分片经验，写回 learning.json 并重新生成经验种子
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createLearning, mergeLearning } from "../dist/index.js";

let learning = createLearning();
try {
  learning = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));
} catch {}
let merged = 0;
for (const name of fs.readdirSync("docs")) {
  if (/^learning-(shard|batch)-\d+\.json$/.test(name)) {
    learning = mergeLearning(learning, JSON.parse(fs.readFileSync(`docs/${name}`, "utf8")));
    merged += 1;
    continue;
  }
  if (/^progress-batch-\d+\.json$/.test(name)) {
    const saved = JSON.parse(fs.readFileSync(`docs/${name}`, "utf8"));
    if (saved.learning) {
      learning = mergeLearning(learning, saved.learning);
      merged += 1;
    }
  }
}
fs.writeFileSync("docs/learning.json", JSON.stringify(learning, null, 1));
console.log(`合并 ${merged} 个分片：累计 ${learning.games} 局 / ${Object.keys(learning.decks).length} 副牌组`);

spawnSync("node", ["scripts/gen-experience-seed.mjs"], { stdio: "inherit" });

const ranked = Object.values(learning.decks)
  .filter((deck) => deck.games >= 2)
  .map((deck) => ({
    deck,
    rate: deck.wins / Math.max(deck.games - deck.draws, 1),
  }))
  .sort((a, b) => b.rate - a.rate || b.deck.games - a.deck.games)
  .slice(0, 20);
console.log(`\n达标牌组（≥2 局）共 ${Object.values(learning.decks).filter(d => d.games >= 2).length} 副，前 20：`);
for (const [index, item] of ranked.entries()) {
  const code = DEFAULT_ASSETS_MANAGER.encode({ characters: item.deck.characters, cards: item.deck.cards });
  console.log(`${index + 1}. ${item.deck.characters.join("/")}  ${item.deck.wins}胜${item.deck.games - item.deck.wins - item.deck.draws}负  ${(item.rate * 100).toFixed(0)}%  (${item.deck.games} 局)`);
  console.log(`   ${code}`);
}
