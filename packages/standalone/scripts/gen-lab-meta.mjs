// 为卡组实验室的筛选生成精简元数据（角色元素 / 行动牌分类）。
// 数据来源与离线资源一致；换数据版本后重跑：
//   node scripts/gen-lab-meta.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("public/assets-local/api/v5/data/latest/CHS");
const OUT = path.resolve("src/lab-meta.json");

const ELEMENTS = new Set([
  "PYRO",
  "HYDRO",
  "ANEMO",
  "ELECTRO",
  "DENDRO",
  "CRYO",
  "GEO",
]);
const FLAGS = {
  heal: /治疗|回复生命|恢复生命/,
  shield: /护盾|护体/,
  summon: /召唤物|召唤/,
  pierce: /穿透/,
  draw: /抽\d?张|抓\d?张|抽牌/,
  reduce: /少花费|减少.*骰子|费用减/,
  react: /元素反应|附着.*元素|造成.*元素伤害/,
};

const characters = JSON.parse(
  fs.readFileSync(path.join(ROOT, "characters.json"), "utf8"),
);
const entities = JSON.parse(
  fs.readFileSync(path.join(ROOT, "entities.json"), "utf8"),
);

const meta = { characters: {}, cards: {} };
for (const ch of characters) {
  const elements = ch.tags
    .filter((tag) => tag.startsWith("GCG_TAG_ELEMENT_"))
    .map((tag) => tag.slice("GCG_TAG_ELEMENT_".length))
    .filter((element) => ELEMENTS.has(element));
  meta.characters[ch.id] = { n: ch.name, e: elements };
}

for (const card of entities) {
  if (card.shareId === null) {
    continue;
  }
  const text = card.description ?? "";
  const flags = Object.entries(FLAGS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([flag]) => flag);
  meta.cards[card.id] = { n: card.name, t: card.type, f: flags };
}

fs.writeFileSync(OUT, JSON.stringify(meta));
console.log(
  `角色 ${Object.keys(meta.characters).length} / 行动牌 ${Object.keys(meta.cards).length} → ${OUT}`,
);
