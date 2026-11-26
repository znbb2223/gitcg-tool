// 从训练快照生成"卡牌/角色强度先验"，供对局评分使用
import fs from "node:fs";

const dir = process.env.SHARD_DIR ?? "/tmp/train-shards";
const cards = new Map();
const chars = new Map();
const add = (map, key, stat) => {
  const acc = map.get(key) ?? { games: 0, wins: 0 };
  acc.games += stat.games;
  acc.wins += stat.wins;
  map.set(key, acc);
};
for (const file of fs.readdirSync(dir)) {
  const shard = JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
  for (const [key, stat] of Object.entries(shard.cards ?? {})) add(cards, key, stat);
  for (const [key, stat] of Object.entries(shard.chars ?? {})) add(chars, key, stat);
}
const toRates = (map, minGames) =>
  Object.fromEntries(
    [...map.entries()]
      .filter(([, stat]) => stat.games >= minGames)
      .map(([key, stat]) => [key, Number((stat.wins / Math.max(stat.games, 1)).toFixed(4))]),
  );
const cardRates = toRates(cards, 60);
const charRates = toRates(chars, 60);
const body = `// 由 scripts/gen-priors.mjs 从训练快照生成（${new Date().toISOString().slice(0, 10)}）
// 卡牌/角色的历史胜率，用作对局评分的先验；数值是 0~1
export const CARD_PRIORS: Record<number, number> = ${JSON.stringify(cardRates)};

export const CHARACTER_PRIORS: Record<number, number> = ${JSON.stringify(charRates)};
`;
fs.writeFileSync("src/data/experience-priors.ts", body);
console.log(`卡牌先验 ${Object.keys(cardRates).length} 张，角色先验 ${Object.keys(charRates).length} 个`);
