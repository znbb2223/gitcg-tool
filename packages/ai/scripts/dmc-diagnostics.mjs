/**
 * DMC 权重诊断：不只看得分，看"它到底在学什么"。
 *
 * 对比 DMC 的选择与启发式选择：
 * - 一致率：Q 选的动作里有多少和启发式相同（太像说明没学到东西，太低可能乱来）
 * - 被选中动作的启发式分排名：DMC 是否偏好"启发式觉得还行"的动作
 * - 对局胜率：DMC vs 纯启发式（小样本，快速看趋势）
 *
 * 用法：node scripts/dmc-diagnostics.mjs --weights=q.json --games=20
 */
import fs from "node:fs";
import { CURRENT_VERSION, Game, exposeState } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import {
  candidateFeatures,
  createAi,
  dmcScoreCandidates,
  isPayable,
  pickDmcAction,
  policyScores,
  scoreAction,
  stateFeatures,
  styleOfDeck,
} from "../dist/index.js";
import { ActionValidity } from "@gi-tcg/typings";

const args = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, value = "true"] = item.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const weights = JSON.parse(fs.readFileSync(args.weights, "utf8"));
const games = Number(args.games ?? 20);
const lib = JSON.parse(
  fs.readFileSync(args.lib ?? "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json", "utf8"),
).decks.filter((deck) => deck.chars?.length === 3 && deck.cards?.length >= 28);
const data = getData(CURRENT_VERSION);

let total = 0;
let agree = 0;
let dmcWins = 0;
const rankHistogram = [0, 0, 0, 0, 0];

for (let index = 0; index < games; index += 1) {
  const decks = [
    { characters: lib[index * 3 % lib.length].chars, cards: lib[index * 3 % lib.length].cards },
    { characters: lib[(index * 3 + 11) % lib.length].chars, cards: lib[(index * 3 + 11) % lib.length].cards },
  ];
  const game = new Game(
    Game.createInitialState({ decks, data, versionBehavior: CURRENT_VERSION, randomSeed: 50000 + index }),
  );
  for (const seat of [0, 1]) {
    const dmcSeat = seat === 0;
    const style = styleOfDeck(decks[seat]);
    game.players[seat].io = createAi({
      who: seat,
      seed: 900 + index * 2 + seat,
      delayMs: 0,
      data,
      style,
      ...(dmcSeat
        ? {
            selectAction: async (request) => {
              const actions = request.action;
              // DMC 会选择哪一手
              const choice = pickDmcAction(weights, actions, game.state, { who: seat, data, style });
              if (choice) {
                // 与启发式排序对比
                const pool = actions.flatMap((action, i) =>
                  action.validity === ActionValidity.VALID && isPayable(action) ? [i] : [],
                );
                const context = { who: seat, state: exposeState(seat, game.state), data, style };
                const ranked = pool
                  .map((i) => ({ index: i, score: scoreAction(actions[i], context).score }))
                  .sort((left, right) => right.score - left.score);
                const position = ranked.findIndex((item) => item.index === choice.chosenActionIndex);
                if (position >= 0 && position < 5) {
                  rankHistogram[position] += 1;
                }
                total += 1;
                if (position === 0) {
                  agree += 1;
                }
              }
              return choice;
            },
          }
        : {}),
    });
  }
  const winner = await game.start();
  if (winner === 0) {
    dmcWins += 1;
  }
}

console.log(`对局 ${games}：DMC(座位0) 胜 ${dmcWins}（${((dmcWins / games) * 100).toFixed(1)}%）`);
console.log(`决策 ${total}：与启发式首选一致 ${agree}（${((agree / Math.max(total, 1)) * 100).toFixed(1)}%）`);
console.log(`DMC 选择在启发式排名中的分布：第1名 ${rankHistogram[0]} / 第2 ${rankHistogram[1]} / 第3 ${rankHistogram[2]} / 第4 ${rankHistogram[3]} / 第5 ${rankHistogram[4]}`);
