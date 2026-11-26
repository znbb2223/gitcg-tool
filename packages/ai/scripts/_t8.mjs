import { CURRENT_VERSION } from "@gi-tcg/core";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { buildDeck, DECK_LIBRARY, validateDeck } from "../dist/index.js";
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
console.log("库内牌组:", DECK_LIBRARY.length);
let copied = 0, built = 0, ok = 0;
for (let seed = 1; seed <= 10; seed++) {
  const deck = buildDeck({ deckData, seed, copyProbability: 0.5, log: (m) => { if (m.includes("照搬")) copied++; else built++; } });
  if (validateDeck(deck, deckData).valid) ok++;
}
console.log(`10 次组卡：照搬 ${copied} 次 / 自组 ${built} 次 / 全部合法 ${ok}/10`);
const forced = buildDeck({ deckData, seed: 1, copyOnly: true });
const lib = DECK_LIBRARY[0];
console.log("强制照搬是否等于库条目:", JSON.stringify(forced.cards) === JSON.stringify(lib.cards));
