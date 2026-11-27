import { CURRENT_VERSION, Game, serializeGameStateLog, deserializeGameStateLog, createRpcResponse } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import fs from "node:fs";

const data = getData(CURRENT_VERSION);
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"))
  .decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);

const deckA = lib[0], deckB = lib[1];
const game = new Game(Game.createInitialState({
  decks: [{ characters: deckA.chars, cards: deckA.cards }, { characters: deckB.chars, cards: deckB.cards }],
  data, versionBehavior: CURRENT_VERSION, randomSeed: 12345,
}));

// 用最朴素的方式把局面推进到中盘：每次合法动作里挑第一个
for (const seat of [0, 1]) {
  game.players[seat].io = {
    rpc: async (req) => {
      const body = req.request;
      if (body?.$case === "action") {
        const actions = body.value.action;
        const idx = actions.findIndex((a) => a.validity === 1);
        return { response: { $case: "action", value: { chosenActionIndex: idx >= 0 ? idx : 0 } } };
      }
      if (body?.$case === "switchHands") return { response: { $case: "switchHands", value: { removedHandIds: [] } } };
      if (body?.$case === "chooseActive") return { response: { $case: "chooseActive", value: { activeCharacterId: 0 } } };
      return { response: { $case: "none", value: {} } };
    },
  };
}
let rounds = 0;
try { await game.start(); rounds = game.state.roundNumber; } catch (e) { console.error("推进失败", e.message); }

const log = serializeGameStateLog([{ state: game.state, who: 0 }]);
const s0 = JSON.stringify(log).length;
const t1 = performance.now();
for (let i = 0; i < 20; i++) serializeGameStateLog([{ state: game.state, who: 0 }]);
const t2 = performance.now();
for (let i = 0; i < 20; i++) deserializeGameStateLog(data, JSON.parse(JSON.stringify(log)));
const t3 = performance.now();
for (let i = 0; i < 20; i++) new Game(deserializeGameStateLog(data, JSON.parse(JSON.stringify(log)))[0].state);
const t4 = performance.now();
console.log(`局面规模 ${(s0/1024).toFixed(0)}KB, 回合 ${rounds}`);
console.log(`序列化   ${((t2-t1)/20).toFixed(2)} ms/次`);
console.log(`反序列化 ${((t3-t2)/20).toFixed(2)} ms/次`);
console.log(`建 Game  ${((t4-t3)/20).toFixed(2)} ms/次`);
