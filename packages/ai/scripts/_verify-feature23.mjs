import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { stateFeatures, FEATURE_ORDER, createAi, nnValue, VALUE_NN } from "../dist/index.js";

const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json","utf8")).decks.filter(d=>d.chars?.length===3&&d.cards?.length>=28);
const data = getData(CURRENT_VERSION);
console.log("特征维度:", FEATURE_ORDER.length, "| 最后一维:", FEATURE_ORDER.at(-1));

// 用强牌组 vs 弱牌组，看第 23 维是否有区分度
const strong = lib.find(d => (d.winRate ?? 0) > 0.6) ?? lib[0];
const weak = lib.find(d => (d.winRate ?? 1) < 0.4) ?? lib[1];
const game = new Game(Game.createInitialState({
  decks: [{characters: strong.chars, cards: strong.cards}, {characters: weak.chars, cards: weak.cards}],
  data, versionBehavior: CURRENT_VERSION, randomSeed: 5,
}));
const f0 = stateFeatures(game.state, 0);
const f1 = stateFeatures(game.state, 1);
console.log("牌组A(座位0) 第23维:", f0[22].toFixed(3), "| 牌组B(座位1):", f1[22].toFixed(3));
console.log("A 视角向量长度:", f0.length, "| B 视角:", f1.length);
console.log("旧模型(nnValue)对新维度:", nnValue(VALUE_NN, f0), "← null 表示维度不匹配自动拒绝，符合预期");
