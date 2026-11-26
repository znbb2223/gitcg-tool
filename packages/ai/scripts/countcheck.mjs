// 验证：只用"公开信息"能不能算出对手手牌？和作弊读牌比一比。
//
// 公开信息：双方牌组（分享码公开）、双方打出的牌、调和丢掉的牌、
// 双方手牌张数/牌堆张数（界面上能看到）。
// 算牌器据此维护"对手剩余牌的多重集合"，再和真实手牌对比。
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi } from "../dist/index.js";

const D0 = "FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA";
const D1 = "FdHxNj8TAWDQxFkMFkAhyWIYCYDA45wOCUDQ5J0PGEAh9IIPGWDh9p4YC6FgirYRCxAA";
const data = getData(CURRENT_VERSION);
const decks = [DEFAULT_ASSETS_MANAGER.decode(D0), DEFAULT_ASSETS_MANAGER.decode(D1)];

const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 2026 }));

// 算牌器状态：每个玩家"还没露面的牌"（多重集合）
const pool = decks.map((deck) => [...deck.cards]);
// 手牌 id → definitionId 映射（调和丢牌时需要）
const handIndex = new Map();

const stats = { steps: 0, exact: 0, subset: 0, exactMatch: 0, sizes: [], exactAtPile: [] };

function recordPublicAction(who, action) {
  const act = action.action;
  if (!act) return;
  if (act.$case === "playCard") {
    const defId = act.value.cardDefinitionId;
    const i = pool[who].indexOf(defId);
    if (i >= 0) pool[who].splice(i, 1);
  } else if (act.$case === "elementalTuning") {
    const defId = handIndex.get(`${who}:${act.value.removedCardId}`);
    if (defId !== undefined) {
      const i = pool[who].indexOf(defId);
      if (i >= 0) pool[who].splice(i, 1);
    }
  }
}

function observe(who) {
  const me = game.state.players[who];
  const handDefs = me.hands.map((c) => c.definition.id);
  for (const c of me.hands) handIndex.set(`${who}:${c.id}`, c.definition.id);
  const pileSize = me.pile.length;
  const deduced = pool[who];
  stats.steps += 1;
  stats.sizes.push(deduced.length);
  // 算出的剩余集合 vs 真实手牌：精确（剩余张数 == 手牌张数）时才算"算出来了"
  const exact = deduced.length === handDefs.length;
  const lifted = [...deduced];
  const subset = handDefs.every((id) => {
    const i = lifted.indexOf(id);
    if (i < 0) return false;
    lifted.splice(i, 1);
    return true;
  });
  if (subset) stats.subset += 1;
  if (exact) {
    stats.exact += 1;
    stats.exactAtPile.push(pileSize);
    const a = [...deduced].sort().join(",");
    const b = [...handDefs].sort().join(",");
    if (a === b) stats.exactMatch += 1;
  }
}

const actors = [0, 1].map((who) =>
  createAi({
    who,
    seed: who + 1,
    selectAction: async () => null,
  }),
);
game.players.forEach((player, who) => {
  const ai = actors[who];
  player.io = {
    notify: ai.notify,
    rpc: async (request) => {
      if (request.request?.$case === "action") {
        observe(who);
      }
      const response = await ai.rpc(request);
      if (request.request?.$case === "action") {
        const idx = response.response.value.chosenActionIndex;
        recordPublicAction(who, request.request.value.action[idx]);
      }
      return response;
    },
  };
});

await game.start();
console.log(`总决策步数：${stats.steps}`);
console.log(`能"精确推出"手牌的步数：${stats.exact}（${(stats.exact / stats.steps * 100).toFixed(1)}%）`);
console.log(`  其中集合完全一致：${stats.exactMatch}`);
console.log(`  这些时刻牌堆剩余张数：${[...new Set(stats.exactAtPile)].sort((a,b)=>a-b).join(",") || "无"}`);
console.log(`真实手牌 ⊆ 推出候选集：${stats.subset}/${stats.steps}（${(stats.subset / stats.steps * 100).toFixed(1)}%）`);
console.log(`平均剩余候选张数：${(stats.sizes.reduce((a,b)=>a+b,0)/stats.steps).toFixed(1)}`);
