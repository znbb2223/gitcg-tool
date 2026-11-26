// 实验室「超深搜索」的多线程 worker：每个 worker 自己造牌组、跑快棋、把结果丢回主线程。
// 这样 6~7 个 worker 可以并行把手机多核跑满，主线程只负责汇总和渲染。
/// <reference lib="webworker" />
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import { buildDeck, mutateDeck, playFastGame, styleOfDeck, validateDeck } from "@gi-tcg/ai";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";

interface StartMessage {
  type: "start";
  target: { characters: number[]; cards: number[] };
  style: string;
  deadline: number;
  seed: number;
  blunderRate?: number;
  games?: number;
}

let stopped = false;

function rngFactory(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const charKeyOf = (deck: { characters: number[] }) =>
  [...deck.characters].sort((a, b) => a - b).join(",");

self.addEventListener("message", async (event: MessageEvent<StartMessage>) => {
  const message = event.data;
  if (message?.type !== "start") {
    return;
  }
  stopped = false;
  const rng = rngFactory(message.seed);
  const data = getData(CURRENT_VERSION as never);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const target = message.target;
  const style = message.style;
  let localBest: { deck: { characters: number[]; cards: number[] }; rate: number } | null = null;
  const seen = new Set<string>();

  while (!stopped && Date.now() < message.deadline) {
    const candidateBase =
      localBest && rng() < 0.55
        ? mutateDeck(localBest.deck, deckData, rng).deck
        : buildDeck({ deckData, seed: Math.floor(rng() * 1e9), deckStrength: "strong" });
    if (style !== "any" && styleOfDeck(candidateBase) !== style) {
      continue;
    }
    if (!validateDeck(candidateBase, deckData).valid) {
      continue;
    }
    const charKey = charKeyOf(candidateBase);
    const key = `${style}:${charKey}`;
    if (seen.has(key) && !localBest) {
      continue;
    }
    seen.add(key);

    let wins = 0;
    let games = 0;
    const targetGames = Math.max(2, Math.min(30, message.games ?? 6));
    for (let k = 0; k < targetGames; k++) {
      if (stopped || Date.now() > message.deadline) {
        break;
      }
      const candidateFirst = k % 2 === 0;
      const decks: [{ characters: number[]; cards: number[] }, { characters: number[]; cards: number[] }] =
        candidateFirst ? [candidateBase, target] : [target, candidateBase];
      const result = await playFastGame(data, decks, (rng() * 1e9) >>> 0, {
        blunderRate: message.blunderRate,
      });
      games += 1;
      if (result.winner === (candidateFirst ? 0 : 1)) {
        wins += 1;
      }
    }
    if (games === 0) {
      continue;
    }
    const rate = wins / games;
    self.postMessage({
      type: "candidate",
      code: "",
      chars: candidateBase.characters,
      cards: candidateBase.cards,
      rate,
      games,
      style,
      charKey,
    });
    if (!localBest || rate > localBest.rate) {
      localBest = { deck: candidateBase, rate };
    }
  }
  self.postMessage({ type: "done" });
});

self.addEventListener("close", () => {
  stopped = true;
});
