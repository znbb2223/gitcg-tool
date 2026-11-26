import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { buildDeck, createAi, randomDeck, validateDeck } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const REF = DEFAULT_ASSETS_MANAGER.decode("FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA");

let ok = 0;
for (let seed = 1; seed <= 8; seed++) {
  const deck = seed % 2 ? buildDeck({ deckData, seed }) : randomDeck(deckData, seed);
  const check = validateDeck(deck, deckData);
  const code = DEFAULT_ASSETS_MANAGER.encode(deck);
  const roundTrip = JSON.stringify(DEFAULT_ASSETS_MANAGER.decode(code)) === JSON.stringify(deck);
  console.log(
    `${seed % 2 ? "策略组卡" : "随机组卡"} seed ${seed}: ${check.valid ? "合法" : "非法 " + check.errors.join(";")} | ${deck.characters.join(",")} | ${deck.cards.length} 张 | ${code.length} 字符 | 往返 ${roundTrip ? "OK" : "FAIL"}`,
  );
  if (check.valid) ok++;
}
console.log(`合法 ${ok}/8`);

const built = buildDeck({ deckData, seed: 7 });
const game = new Game(Game.createInitialState({ decks: [built, REF], data, versionBehavior: CURRENT_VERSION, randomSeed: 5 }));
game.players[0].io = createAi({ who: 0, seed: 1 });
game.players[1].io = createAi({ who: 1, seed: 2 });
const winner = await game.start();
console.log(`自组卡对局：${winner === null ? "平" : `玩家${winner} 胜`}，${game.state.roundNumber} 回合`);
