// 用当前牌组库（含人工/子代理提炼的标签与定位）重建 AI 内置牌组库，
// 这样 styleOfDeck 之类的判断能吃上最新的作者标签。
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const OUT = "/root/workspace/gi-tcg/packages/ai/src/data/deck-library.ts";

const library = JSON.parse(fs.readFileSync(LIB, "utf8"));
const decks = [];

for (const deck of library.decks) {
  if (!deck.code || deck.chars?.length !== 3 || deck.cards?.length !== 30) {
    continue;
  }
  const tags = [
    ...new Set(
      [deck.role, ...(deck.authorTags ?? []), ...(deck.tags ?? [])]
        .filter(Boolean)
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0 && tag.length <= 8),
    ),
  ].slice(0, 6);
  const strategy = [deck.role, deck.guide?.open, deck.guide?.mid]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  decks.push({
    id: deck.id,
    code: deck.code,
    characters: deck.chars,
    cards: deck.cards,
    source: deck.source ?? "",
    subject: (deck.title ?? "").slice(0, 32),
    strategy,
    tags,
    popularity: deck.popularity ?? deck.likes ?? 0,
  });
}

const header = `// 由 scripts/gen-library-from-decklib.mjs 生成（牌组库 ${decks.length} 套，含作者标签）
export interface LibraryDeck {
  id: string;
  code: string;
  characters: number[];
  cards: number[];
  source: string;
  subject: string;
  strategy: string;
  tags: string[];
  popularity: number;
}

export const DECK_LIBRARY: LibraryDeck[] = `;

fs.writeFileSync(OUT, `${header}${JSON.stringify(decks)};\n`);
console.log(
  `生成 ${decks.length} 套 → ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`,
);
