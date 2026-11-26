// 从「作者说明 + 人工分析」里抽出可执行打法提示，供 AI 使用：
// keep = 起手该留的卡（来自 open 段），play = 中期优先打的卡（来自 mid 段）
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const OUT = "/root/workspace/gi-tcg/packages/ai/src/data/author-hints.ts";

const library = JSON.parse(fs.readFileSync(LIB, "utf8"));
const cardNames = library.cards;
const idByName = new Map();
for (const [id, name] of Object.entries(cardNames)) {
  const text = String(name).trim();
  if (text.length >= 2) {
    idByName.set(text, Number(id));
  }
}

const namesIn = (text) => {
  const hit = [];
  for (const [name, id] of idByName) {
    if (text.includes(name)) {
      hit.push(id);
    }
    if (hit.length >= 8) {
      break;
    }
  }
  return [...new Set(hit)];
};

const hints = {};
let analyzed = 0;
for (const deck of library.decks) {
  if (!deck.authorTags && !deck.role) {
    continue;
  }
  analyzed++;
  const openText = `${deck.guide?.open ?? ""} ${deck.note ?? ""}`.slice(0, 400);
  const midText = `${deck.guide?.mid ?? ""} ${deck.note ?? ""}`.slice(0, 400);
  const keep = namesIn(openText).filter((id) => deck.cards.includes(id));
  const play = namesIn(midText).filter((id) => deck.cards.includes(id) && !keep.includes(id));
  if (!keep.length && !play.length) {
    continue;
  }
  const key = `${[...deck.chars].sort((a, b) => a - b).join(",")}|${[...deck.cards]
    .sort((a, b) => a - b)
    .join(",")}`;
  hints[key] = { keep: keep.slice(0, 5), play: play.slice(0, 5) };
}

const lines = [
  "// 由 scripts/gen-author-hints.mjs 生成：来自作者说明的人工分析，喂给 AI 的起手/优先出牌提示",
  "export interface AuthorHint {",
  "  keep: number[];",
  "  play: number[];",
  "}",
  "",
  "export const AUTHOR_HINTS: Record<string, AuthorHint> = " + JSON.stringify(hints, null, 0) + ";",
  "",
  "export const AUTHOR_HINT_COUNT = " + Object.keys(hints).length + ";",
  "",
];
fs.writeFileSync(OUT, lines.join("\n"));
console.log(`分析牌组 ${analyzed} 套，生成提示 ${Object.keys(hints).length} 条 → ${OUT}`);
