// 无头自对弈：Node 直接跑 AI vs AI，用来验证 AI 不崩、能走完整局。
// 用法：node packages/ai/scripts/selfplay.mjs [version] [seed] [rounds]
// 需要先 `pnpm build`（至少 core / data / assets-manager / ai）。

import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { createAi } from "../dist/index.js";

const DECK0 =
  "FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA";
const DECK1 =
  "FdHxNj8TAWDQxFkMFkAhyWIYCYDA45wOCUDQ5J0PGEAh9IIPGWDh9p4YC6FgirYRCxAA";

const version = process.argv[2] ?? CURRENT_VERSION;
const seed = Number(process.argv[3] ?? 1);
const games = Number(process.argv[4] ?? 1);
const verbose = Boolean(process.env.VERBOSE);

const data = getData(version);
const decks = [
  DEFAULT_ASSETS_MANAGER.decode(DECK0),
  DEFAULT_ASSETS_MANAGER.decode(DECK1),
];

const counts = new Map();
const bump = (key) => counts.set(key, (counts.get(key) ?? 0) + 1);

async function playOne(gameIndex) {
  const game = new Game(
    Game.createInitialState({
      decks,
      data,
      versionBehavior: version,
      randomSeed: seed + gameIndex,
    }),
  );
  const ai = [0, 1].map((who) =>
    createAi({
      who,
      delayMs: 0,
      seed: seed + gameIndex * 2 + who,
      log: verbose ? (m) => console.log(m) : undefined,
      name: `AI${who}`,
    }),
  );
  game.players.forEach((player, who) => {
    player.io = {
      notify: ai[who].notify,
      rpc: async (request) => {
        bump(request.request?.$case ?? "unknown");
        return ai[who].rpc(request);
      },
    };
  });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("超时：AI 可能陷入死循环")), 120_000),
  );
  const winner = await Promise.race([game.start(), timeout]);
  const hp = game.state.players.map((p) =>
    p.characters.reduce((sum, c) => sum + Math.max(c.variables.health, 0), 0),
  );
  return { winner, rounds: game.state.roundNumber, hp };
}

const startedAt = Date.now();
for (let i = 0; i < games; i++) {
  const { winner, rounds, hp } = await playOne(i);
  console.log(
    `对局 ${i + 1}/${games}：${winner === null ? "平局" : `AI${winner} 胜`}，${rounds} 回合，剩余血量 ${hp.join(" : ")}`,
  );
}

console.log("---");
console.log("RPC 次数：", Object.fromEntries(counts));
console.log(`总耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
