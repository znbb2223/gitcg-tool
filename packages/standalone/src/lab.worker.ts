/// <reference lib="webworker" />
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { CURRENT_VERSION, type Version } from "@gi-tcg/core";
import { buildDeck, mutateDeck, playFastGame, styleOfDeck } from "@gi-tcg/ai";
import type { Deck } from "@gi-tcg/core";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let running = false;

interface StartMessage {
  type: "start";
  target: Deck;
  style: "aggro" | "midrange" | "control" | "any";
  seed: number;
  version?: string;
  gamesPerCandidate?: number;
}

ctx.onmessage = async (event: MessageEvent<StartMessage | { type: "stop" }>) => {
  const message = event.data;
  if (message.type === "stop") {
    running = false;
    return;
  }
  if (message.type !== "start") {
    return;
  }
  running = true;
  const data = getData((message.version ?? CURRENT_VERSION) as Version);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  ctx.postMessage({ type: "ready", style: message.style });
  const target = message.target;
  const style = message.style;
  const perCandidate = message.gamesPerCandidate ?? 6;

  let rngState = message.seed >>> 0 || 1;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  let best: { deck: Deck; rate: number } | null = null;
  let games = 0;
  let iterations = 0;
  const startedAt = Date.now();

  while (running) {
    let candidate: Deck;
    if (best && rng() < 0.72) {
      candidate = mutateDeck(best.deck, deckData, rng).deck;
    } else {
      candidate = buildDeck({
        deckData,
        seed: Math.floor(rng() * 1e9),
        deckStrength: "strong",
      });
    }
    if (style !== "any" && styleOfDeck(candidate) !== style) {
      continue;
    }

    let wins = 0;
    for (let k = 0; k < perCandidate && running; k++) {
      const candidateFirst = k % 2 === 0;
      const decks: [Deck, Deck] = candidateFirst
        ? [candidate, target]
        : [target, candidate];
      const result = await playFastGame(data, decks, (rng() * 1e9) >>> 0);
      games += 1;
      const candidateWho = candidateFirst ? 0 : 1;
      if (result.winner === candidateWho) {
        wins += 1;
      }
    }
    const rate = wins / perCandidate;
    iterations += 1;
    ctx.postMessage({
      type: "candidate",
      style,
      rate,
      games,
      iterations,
      deckCode: DEFAULT_ASSETS_MANAGER.encode(candidate),
    });
    if (!best || rate > best.rate) {
      best = { deck: candidate, rate };
      ctx.postMessage({
        type: "best",
        style,
        rate,
        games,
        iterations,
        elapsedMs: Date.now() - startedAt,
        deckCode: DEFAULT_ASSETS_MANAGER.encode(candidate),
      });
    } else if (iterations % 1 === 0) {
      ctx.postMessage({
        type: "progress",
        style,
        rate: best.rate,
        games,
        iterations,
        elapsedMs: Date.now() - startedAt,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  ctx.postMessage({ type: "done", style });
};
