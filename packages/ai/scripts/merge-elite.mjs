// 合并两个精英赛分片，输出总排名；并把经验写回 learning.json
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";

const shards = ["docs/elite-shard-0.json", "docs/elite-shard-1.json"]
  .filter((p) => fs.existsSync(p))
  .map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
const base = shards[0];
const total = base.stats.map((s) => ({ games: s.games, wins: s.wins }));
for (const shard of shards.slice(1)) {
  shard.stats.forEach((s, i) => {
    total[i].games += s.games;
    total[i].wins += s.wins;
  });
}
const ranked = base.ranked
  .map((item, i) => ({ deck: item.deck, ...total[i], rate: total[i].games ? total[i].wins / total[i].games : 0 }))
  .sort((a, b) => b.rate - a.rate);

fs.writeFileSync("docs/learning.json", JSON.stringify(base.learning, null, 1));
spawnSync("node", ["scripts/gen-experience-seed.mjs"], { stdio: "inherit" });

console.log(`\n精英赛总排名（两分片合计 ${total.reduce((s, t) => s + t.games, 0)} 局）：`);
for (const [index, item] of ranked.entries()) {
  const code = DEFAULT_ASSETS_MANAGER.encode({ characters: item.deck.characters, cards: item.deck.cards });
  console.log(`${index + 1}. ${item.deck.characters.join("/")}  ${item.wins}胜${item.games - item.wins}负  ${(item.rate * 100).toFixed(0)}%（${item.games} 局）`);
  console.log(`   ${code}`);
}
