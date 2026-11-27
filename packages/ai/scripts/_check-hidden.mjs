// 隐藏信息改造（A 方案）的针对性验证：
// 1. 打到中局拿一份快照；
// 2. determinizeState(realisticHidden) 猜一副对手手牌，检查张数/实体/id 不变量；
// 3. 用猜出来的局面继续开一局，跑到结束不崩。
import fs from "node:fs";
import {
  CURRENT_VERSION,
  Game,
  deserializeGameStateLog,
  serializeGameStateLog,
} from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { createAi, styleOfDeck } from "../dist/index.js";
import { determinizeState } from "../src/search.ts";

const LIB_PATH =
  process.env.DECK_LIB ??
  "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const lib = JSON.parse(fs.readFileSync(LIB_PATH, "utf8")).decks.filter(
  (d) => d.chars?.length === 3 && d.cards?.length >= 28,
);
const data = getData(CURRENT_VERSION);
const pick = Number(process.argv[2] ?? 0);
const deckA = lib[pick % lib.length];
const deckB = lib[(pick * 37 + 11) % lib.length];
const decks = [
  { characters: deckA.chars, cards: deckA.cards },
  { characters: deckB.chars, cards: deckB.cards },
];

let snapshot = null;
let decisions = 0;
const makeAi = (who, seed, deck) =>
  createAi({
    who,
    seed,
    delayMs: 0,
    style: styleOfDeck(deck),
    data,
    selectAction: async () => {
      // 只数动作决策，抓到第 12 个就留一份中局快照，然后照旧交给启发式
      if (snapshot === null && ++decisions >= 12) {
        snapshot = JSON.parse(
          JSON.stringify(
            serializeGameStateLog([{ state: game.state, canResume: true }]),
          ),
        );
      }
      return void 0;
    },
  });

const game = new Game(
  Game.createInitialState({
    decks,
    data,
    versionBehavior: CURRENT_VERSION,
    randomSeed: 90000 + pick,
  }),
);
for (const seat of [0, 1]) {
  game.players[seat].io = makeAi(seat, 7 + seat + pick, decks[seat]);
}
const winner0 = await game.start();
console.log(`准备局结束：winner=${winner0}，决策数 ${decisions}`);
if (snapshot === null) {
  throw new Error("没抓到中局快照");
}

const restored = deserializeGameStateLog(data, snapshot)[0].state;
const enemy = restored.players[1];
const handSize = enemy.hands.length;
const pileSize = enemy.pile.length;
const realDeck = new Set(enemy.initialPile.map((definition) => definition.id));
const beforeIds = new Set();
for (const player of restored.players) {
  for (const entity of [
    ...player.hands,
    ...player.pile,
    ...player.supports,
    ...player.summons,
    ...player.combatStatuses,
    ...player.removedEntities,
    ...player.characters.flatMap((character) => character.entities),
  ]) {
    beforeIds.add(entity.id);
  }
}
const idBefore = restored.iterators.id;

let seed = 12345;
const rng = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
determinizeState(restored, 0, rng, { realisticHidden: true });

const guessed = [...enemy.hands, ...enemy.pile];
const errors = [];
if (enemy.hands.length !== handSize || enemy.pile.length !== pileSize) {
  errors.push(`张数变了：手牌 ${enemy.hands.length}/${handSize}，牌堆 ${enemy.pile.length}/${pileSize}`);
}
if (idBefore - restored.iterators.id !== guessed.length) {
  errors.push(`迭代器没按张数递减：${idBefore} → ${restored.iterators.id}，猜了 ${guessed.length} 张`);
}
const seen = new Set();
for (const entity of guessed) {
  if (beforeIds.has(entity.id)) {
    errors.push(`实体 id ${entity.id} 与局面里已有的 id 撞了`);
  }
  if (seen.has(entity.id)) {
    errors.push(`实体 id ${entity.id} 重复`);
  }
  seen.add(entity.id);
  if (!entity.definition || typeof entity.definition.id !== "number") {
    errors.push(`实体 ${entity.id} 没有 definition`);
  } else if (!["eventCard", "equipment", "support"].includes(entity.definition.type)) {
    errors.push(`实体 ${entity.id} 的类型是 ${entity.definition.type}，不是卡牌`);
  }
  if (!Array.isArray(entity.attachments) || entity.attachments.length !== 0) {
    errors.push(`实体 ${entity.id} 的 attachments 不是空数组`);
  }
  for (const [name, { initialValue }] of Object.entries(entity.definition.varConfigs ?? {})) {
    if (entity.variables[name] !== initialValue) {
      errors.push(`实体 ${entity.id} 变量 ${name}=${entity.variables[name]}，应为 ${initialValue}`);
    }
  }
}
const overlap = guessed.filter((entity) => realDeck.has(entity.definition.id)).length;
const uniqueGuessed = new Set(guessed.map((entity) => entity.definition.id)).size;
console.log(
  `快照：手牌 ${handSize} / 牌堆 ${pileSize}；猜出 ${guessed.length} 张（${uniqueGuessed} 种）`,
);
console.log(
  `猜中真实牌库的比例：${overlap}/${guessed.length} = ${((overlap / Math.max(guessed.length, 1)) * 100).toFixed(1)}%`,
);
if (errors.length > 0) {
  console.error("不变量失败：\n" + errors.slice(0, 10).join("\n"));
  process.exit(1);
}
console.log("不变量全部通过");

// 用猜出来的局面继续打，跑到结束
const replay = new Game(restored, { silent: true });
for (const seat of [0, 1]) {
  replay.players[seat].io = makeAi(seat, 100 + seat + pick, decks[seat]);
}
const winner = await replay.start();
console.log(
  `猜牌局面续打完成：winner=${winner}，回合 ${replay.state.roundNumber}，阶段 ${replay.state.phase}`,
);
