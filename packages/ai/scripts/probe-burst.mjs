import fs from "node:fs";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import { ActionValidity } from "@gi-tcg/typings";
import getData from "@gi-tcg/data";
import { createAi, searchBestAction, styleOfDeck } from "../dist/index.js";

const data = getData(CURRENT_VERSION);
const lib = JSON.parse(fs.readFileSync("/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"))
  .decks.filter((d) => d.chars?.length === 3 && d.cards?.length >= 28);
const burstIds = new Set(JSON.parse(fs.readFileSync("/tmp/burst-ids.json", "utf8")).burst);

const cases = [];
const ENERGY_REQ = 9; // 实测 requirement 里能量是 9

async function playOne(gi) {
  const deckA = lib[(gi * 37) % lib.length], deckB = lib[(gi * 37 + 211) % lib.length];
  const decks = [{ characters: deckA.chars, cards: deckA.cards }, { characters: deckB.chars, cards: deckB.cards }];
  const game = new Game(Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 90000 + gi }));
  for (const seat of [0, 1]) {
    game.players[seat].io = createAi({
      who: seat, seed: 1234 + seat, delayMs: 0, style: styleOfDeck(decks[seat]), data,
      selectAction: async (request) => {
        const me = game.state.players[seat];
        const dice = [...me.dice];
        const omni = dice.filter((d) => Number(d) === 8).length;
        for (const a of request.action) {
          if (a.action?.$case !== "useSkill" || !burstIds.has(a.action.value.skillDefinitionId)) continue;
          if (Number(a.validity) !== 3) continue; // NO_DICE
          const reqs = a.requiredCost ?? [];
          const diceNeed = reqs.filter((r) => r.type !== ENERGY_REQ);
          const needCount = diceNeed.reduce((s, r) => s + r.count, 0);
          if (omni === 0 || dice.length < needCount) continue;
          cases.push({
            dice: dice.map(Number),
            omni,
            needCount,
            reqs: reqs.map((r) => ({ t: Number(r.type), c: r.count })),
            skill: a.action.value.skillDefinitionId,
            round: game.state.roundNumber,
          });
        }
        const r = await searchBestAction(request, { who: seat, data, state: game.state, budgetMs: 150, maxActions: 10, maxCandidates: 8 });
        return { chosenActionIndex: r.chosenActionIndex, usedDice: r.usedDice };
      },
    });
  }
  await game.start().catch(() => {});
}
for (let i = 0; i < 6; i += 1) await playOne(i);

console.log(`「有万能骰 + 骰子数量够」却判 NO_DICE 的案例：${cases.length} 次`);
for (const c of cases.slice(0, 5)) {
  console.log(`  技能 ${c.skill} | 回合 ${c.round} | 需求 ${JSON.stringify(c.reqs)} | 骰池 ${JSON.stringify(c.dice)}（万能 ${c.omni}）`);
}
// 统计：仅按颜色算，万能骰能不能补足
let couldSatisfy = 0, stillShort = 0;
for (const c of cases) {
  const pool = [...c.dice];
  let ok = true;
  for (const r of c.reqs) {
    if (r.t === ENERGY_REQ) continue;
    let count = r.c;
    // 先用同色
    for (let i = pool.length - 1; i >= 0 && count > 0; i -= 1) {
      if (pool[i] === r.t) { pool.splice(i, 1); count -= 1; }
    }
    // 再用万能
    while (count > 0) {
      const idx = pool.findIndex((d) => d === 8);
      if (idx < 0) { ok = false; break; }
      pool.splice(idx, 1); count -= 1;
    }
    if (!ok) break;
  }
  if (ok) couldSatisfy += 1; else stillShort += 1;
}
console.log(`  按万能骰规则核算：其实付得起 ${couldSatisfy} 次，仍然付不起 ${stillShort} 次`);
