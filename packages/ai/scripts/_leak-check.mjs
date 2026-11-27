// C0 验收：篡改对手 initialPile，44 维状态特征应当完全不变（不再泄漏对手牌组）
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import fs from "node:fs";
import { stateFeatures, FEATURE_NAMES } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const library = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8")).decks;
const usable = library.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const decks = [
  { characters: usable[0].chars, cards: usable[0].cards },
  { characters: usable[3].chars, cards: usable[3].cards },
];
const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 7 }));
const state = game.state;
const before = stateFeatures(state, 0);
// 换一副完全不同的牌组当作"对手真实牌堆"，再算一次
const other = usable[500];
state.players[1].initialPile = other.cards.map((id) => data.entities.get(id));
const after = stateFeatures(state, 0);
const changed = FEATURE_NAMES.filter((name, index) => Math.abs(before[index] - after[index]) > 1e-9);
console.log("特征维数:", before.length);
console.log("篡改对手牌堆后变化的维度:", changed.length ? changed.join(", ") : "无（去泄漏成功）");
