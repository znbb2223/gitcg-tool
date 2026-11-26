import { DECK_LIBRARY, styleOfDeck } from "../dist/index.js";
const stats = new Map();
for (const deck of DECK_LIBRARY) {
  const style = styleOfDeck(deck);
  stats.set(style, (stats.get(style) ?? 0) + 1);
}
console.log("库内风格分布:", [...stats.entries()]);
for (const deck of DECK_LIBRARY.slice(0, 6)) {
  console.log(`- ${styleOfDeck(deck).padEnd(8)} ${deck.subject.slice(0, 30)} [${deck.tags.join("/")}]`);
}
