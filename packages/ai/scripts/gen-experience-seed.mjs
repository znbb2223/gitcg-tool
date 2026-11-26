// 把无头训练得到的经验固化成模块，让 App 里的 AI 一开局就带着这些经验
import fs from "node:fs";

const learning = JSON.parse(fs.readFileSync("docs/learning.json", "utf8"));
const body = `// 由 scripts/gen-experience-seed.mjs 生成（无头训练产出的经验）
import type { LearningData } from "../learner";

export const EXPERIENCE_SEED: LearningData = ${JSON.stringify({
  kind: "gi-tcg-ai-learning",
  version: 1,
  games: learning.games,
  cards: learning.cards,
  characters: learning.characters,
  decks: learning.decks ?? {},
  updatedAt: 0,
})};
`;
fs.writeFileSync("src/data/experience-seed.ts", body);
const cards = Object.keys(learning.cards ?? {}).length;
const chars = Object.keys(learning.characters ?? {}).length;
const decks = Object.keys(learning.decks ?? {}).length;
console.log(`经验种子：${learning.games} 局 / ${cards} 张牌 / ${chars} 个角色 / ${decks} 副牌组`);
