import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { buildDeck, DECK_LIBRARY, validateDeck } from "../dist/index.js";
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
console.log("库内牌组:", DECK_LIBRARY.length);
let copied = 0, ok = 0;
for (let seed = 1; seed <= 20; seed++) {
  let hit = false;
  const deck = buildDeck({ deckData, seed, copyProbability: 0.5, log: (m) => { if (m.includes("照搬")) hit = true; } });
  if (hit) copied++;
  if (validateDeck(deck, deckData).valid) ok++;
}
console.log(`20 次组卡：照搬 ${copied} 次，合法 ${ok}/20`);
console.log("示例:", DECK_LIBRARY.slice(0,3).map(d => `${d.subject} [${d.tags.join("/")}]`).join(" | "));
