// 解析卡牌描述，抽出「技能效果」标签（官方筛选里的那一排），并校准费用
import fs from "node:fs";
import path from "node:path";

const ROOT = "/root/workspace/gi-tcg/packages/standalone";
const DATUM = path.join(ROOT, "public/assets-local/api/v5/datum/latest/CHS");
const META = path.join(ROOT, "public/data/filter-meta.json");
const LIB = path.join(ROOT, "public/data/deck-library.json");

/** 官方「技能效果」分类 → 描述里的关键词 */
const EFFECT_RULES = [
  ["discard", /舍弃/],
  ["pick", /挑选/],
  ["preparingSkill", /准备技能|准备.{0,4}技能/],
  ["summon", /召唤/],
  ["heal", /治疗|回复.{0,6}(生命|血量)/],
  ["shield", /护盾|护罩/],
  ["nightsoul", /夜魂/],
  ["bondOfLife", /生命之契/],
  ["technique", /特技/],
  ["piercing", /穿透/],
  ["generateAction", /生成.{0,6}行动牌|加入.{0,4}手牌/],
  ["energy", /充能|元素能量/],
  ["adventure", /冒险地点|冒险/],
  ["draw", /抽.{0,3}张牌|摸.{0,3}张牌/],
];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

const meta = readJson(META);
const library = readJson(LIB);
const cardIds = new Set([...library.decks.flatMap((deck) => deck.cards ?? [])].map(String));

let parsed = 0;
let missing = 0;
const effectCount = new Map();

for (const id of cardIds) {
  let datum;
  try {
    datum = readJson(path.join(DATUM, `${id}.json`));
  } catch {
    missing++;
    continue;
  }
  const text = `${datum.name ?? ""}\n${datum.description ?? ""}\n${datum.rawDescription ?? ""}`;
  const effects = EFFECT_RULES.filter(([, pattern]) => pattern.test(text)).map(([key]) => key);
  const cost = Array.isArray(datum.playCost)
    ? datum.playCost.reduce((sum, req) => sum + (req.count ?? 0), 0)
    : 0;

  const entry = meta.cards[id] ?? { n: "", ty: "", cost: 0, tags: [] };
  meta.cards[id] = {
    ...entry,
    n: datum.name ?? entry.n ?? "",
    cost,
    desc: (datum.description ?? datum.rawDescription ?? "").slice(0, 400),
    effects,
  };
  parsed++;
  for (const effect of effects) {
    effectCount.set(effect, (effectCount.get(effect) ?? 0) + 1);
  }
}

fs.writeFileSync(META, JSON.stringify(meta));
console.log(
  `解析 ${parsed} 张卡（缺资料 ${missing}），效果分布：`,
  [...effectCount.entries()].sort((a, b) => b[1] - a[1]),
);
const size = fs.statSync(META).size / 1024;
console.log(`filter-meta.json → ${size.toFixed(0)}KB`);
