import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, deckKeyOf, styleOfDeck } from "../dist/index.js";

const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"));
const withHints = lib.decks.filter((d) => (d.authorTags ?? []).length && d.games >= 5).slice(0, 40);
const data = getData(CURRENT_VERSION);
const GAMES = Number(process.argv[2] ?? 20);

async function run(useHints) {
  let win = 0, lose = 0, draw = 0;
  for (let i = 0; i < Math.min(GAMES, withHints.length); i++) {
    const d = withHints[i];
    const deck = { characters: d.chars, cards: d.cards };
    const opponent = withHints[(i + 7) % withHints.length];
    const deckB = { characters: opponent.chars, cards: opponent.cards };
    const game = new Game(Game.createInitialState({
      decks: [deck, deckB], data, versionBehavior: CURRENT_VERSION, randomSeed: 90000 + i * 13,
    }));
    const key = deckKeyOf(deck);
    game.players[0].io = createAi({ who: 0, seed: 90000 + i * 13, delayMs: 0, style: styleOfDeck(deck), data, deckKey: useHints ? key : undefined });
    game.players[1].io = createAi({ who: 1, seed: 90001 + i * 13, delayMs: 0, style: styleOfDeck(deckB), data });
    const winner = await game.start();
    if (winner === 0) win++; else if (winner === 1) lose++; else draw++;
  }
  return { win, lose, draw };
}

const base = await run(false);
const hinted = await run(true);
console.log("不带攻略提示:", base);
console.log("带攻略提示  :", hinted);
