// 训练执行器（worker_threads 子线程）：只负责打局，把增量经验回传主线程
// 不再有进程间文件轮询——进度和结果都通过 postMessage 实时抛给主线程
import { parentPort, workerData } from "node:worker_threads";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CURRENT_VERSION, Game } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import {
  DECK_LIBRARY,
  createAi,
  createLearning,
  deckKeyOf,
  runEvolution,
  styleOfDeck,
} from "@gi-tcg/ai";

const here = path.dirname(fileURLToPath(import.meta.url));
const {
  role,        // "ai" | "library" | "both"
  games,       // 本线程要打的局数
  base,        // 起始经验（AI 模式用，用来给 learned 组牌先验）
  mode,        // "learned" | "random" | "both"
  information, // "fair" | "perfect"
  useSearch,
  searchBudgetMs,
  seed,
} = workerData;

let stopped = false;
parentPort.on("message", (message) => {
  if (message?.type === "stop") {
    stopped = true;
  }
});

const report = (done) => parentPort.postMessage({ type: "progress", done });

// ---------- 增量计算：结果 - 起点，主线程只有加总，永远不会重复计数 ----------
function deltaOf(from, to) {
  const delta = createLearning();
  delta.games = Math.max(0, (to.games ?? 0) - (from?.games ?? 0));
  for (const bucket of ["decks", "cards", "characters"]) {
    const target = (delta[bucket] ??= {});
    for (const [key, value] of Object.entries(to[bucket] ?? {})) {
      const before = from?.[bucket]?.[key];
      const gamesDiff = (value.games ?? 0) - (before?.games ?? 0);
      if (gamesDiff <= 0) {
        continue;
      }
      target[key] = {
        games: gamesDiff,
        wins: (value.wins ?? 0) - (before?.wins ?? 0),
        draws: (value.draws ?? 0) - (before?.draws ?? 0),
        ...(value.characters ? { characters: value.characters } : {}),
        ...(value.cards ? { cards: value.cards } : {}),
        updatedAt: Date.now(),
      };
    }
  }
  return delta;
}

function bump(bucket, key, win, draw, extra) {
  const entry = bucket[key] ?? {
    games: 0,
    wins: 0,
    draws: 0,
    updatedAt: 0,
    ...(extra ?? {}),
  };
  entry.games += 1;
  if (win) {
    entry.wins += 1;
  }
  if (draw) {
    entry.draws += 1;
  }
  entry.updatedAt = Date.now();
  bucket[key] = entry;
}

function loadCatalog() {
  const fullFile = path.join(here, "data", "deck-library.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(fullFile, "utf8"));
    const list = Array.isArray(parsed?.decks) ? parsed.decks : [];
    const full = list
      .filter(
        (deck) =>
          Array.isArray(deck?.chars) &&
          Array.isArray(deck?.cards) &&
          deck.chars.length === 3 &&
          deck.cards.length === 30,
      )
      .map((deck) => ({
        characters: deck.chars,
        cards: deck.cards,
        key: deckKeyOf({ characters: deck.chars, cards: deck.cards }),
        title: deck.title ?? "",
      }));
    if (full.length > 0) {
      return { list: full, source: `牌组库全量 ${full.length} 套` };
    }
  } catch {
    // 读不到就用内置
  }
  return {
    list: DECK_LIBRARY.map((deck) => ({
      characters: deck.characters,
      cards: deck.cards,
      key: deckKeyOf(deck),
      title: "",
    })),
    source: `内置 ${DECK_LIBRARY.length} 套`,
  };
}

// ---------- 牌组库模式：只打库里的真实牌组，统计胜率 ----------
async function playLibrary(count, catalog) {
  const learning = createLearning();
  const data = getData(CURRENT_VERSION);
  const total = catalog.length;
  for (let local = 0; local < count; local++) {
    if (stopped) {
      break;
    }
    const i = seed * 131 + local;
    const a = catalog[i % total];
    const bIndex = (i * 31 + 17) % total;
    const b = catalog[bIndex === i % total ? (i + 1) % total : bIndex];
    const gameSeed = 500000 + i * 7;
    const game = new Game(
      Game.createInitialState({
        decks: [
          { characters: a.characters, cards: a.cards },
          { characters: b.characters, cards: b.cards },
        ],
        data,
        versionBehavior: CURRENT_VERSION,
        randomSeed: gameSeed,
      }),
    );
    game.players[0].io = createAi({
      who: 0,
      seed: gameSeed,
      delayMs: 0,
      style: styleOfDeck(a),
      data,
    });
    game.players[1].io = createAi({
      who: 1,
      seed: gameSeed + 1,
      delayMs: 0,
      style: styleOfDeck(b),
      data,
    });
    let winner = null;
    try {
      winner = await game.start();
    } catch {
      report(local + 1);
      continue;
    }
    bump(learning.decks, a.key, winner === 0, winner === null, {
      characters: [...a.characters],
      cards: [...a.cards],
    });
    bump(learning.decks, b.key, winner === 1, winner === null, {
      characters: [...b.characters],
      cards: [...b.cards],
    });
    for (const id of a.characters) {
      bump(learning.characters, String(id), winner === 0, winner === null);
    }
    for (const id of b.characters) {
      bump(learning.characters, String(id), winner === 1, winner === null);
    }
    for (const id of new Set(a.cards)) {
      bump(learning.cards, String(id), winner === 0, winner === null);
    }
    for (const id of new Set(b.cards)) {
      bump(learning.cards, String(id), winner === 1, winner === null);
    }
    learning.games += 1;
    report(local + 1);
  }
  return learning;
}

// ---------- 自组进化模式：AI 按经验组牌 + 对打 ----------
async function playAi(count, alreadyDone) {
  const data = getData(CURRENT_VERSION);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const modes = mode === "both" ? ["learned", "random"] : [mode];
  // 份额按总局数预先切好，不能按剩余重算（否则第二个模式会算成 0）
  const half = Math.ceil(count / 2);
  const shares = modes.map((oneMode) =>
    modes.length === 1 ? count : oneMode === "learned" ? half : count - half,
  );
  let learning = base ? structuredClone(base) : createLearning();
  let done = 0;
  for (let index = 0; index < modes.length; index++) {
    const oneMode = modes[index];
    if (stopped) {
      break;
    }
    const share = shares[index];
    if (share <= 0) {
      continue;
    }
    learning = await runEvolution({
      data,
      deckData,
      learning,
      games: share,
      mode: oneMode,
      information,
      useSearch,
      searchBudgetMs,
      seed: seed + done * 1009 + (oneMode === "random" ? 99991 : 0),
      onProgress: (progress) => {
        report(alreadyDone + done + progress.done);
      },
      shouldStop: () => stopped,
    });
    done += share;
  }
  return learning;
}

async function main() {
  const fromLibrary = role === "library" || role === "both";
  const fromAi = role === "ai" || role === "both";
  const libraryGames = role === "both" ? Math.floor(games / 2) : games;
  const aiGames = role === "both" ? games - libraryGames : games;

  if (fromLibrary) {
    const catalog = loadCatalog();
    parentPort.postMessage({ type: "info", text: catalog.source });
    const libraryDelta = await playLibrary(libraryGames, catalog.list);
    if (!fromAi) {
      parentPort.postMessage({ type: "done", delta: libraryDelta });
      return;
    }
    // 两种都要：牌组库那半份先回传，自组那半份独立算增量
    parentPort.postMessage({ type: "partial", delta: libraryDelta });
    const aiResult = await playAi(aiGames, libraryGames);
    const aiDelta = base ? deltaOf(base, aiResult) : aiResult;
    parentPort.postMessage({ type: "done", delta: aiDelta });
    return;
  }

  const aiResult = await playAi(aiGames, 0);
  const aiDelta = base ? deltaOf(base, aiResult) : aiResult;
  parentPort.postMessage({ type: "done", delta: aiDelta });
}

main().catch((error) => {
  parentPort.postMessage({ type: "error", message: String(error?.stack ?? error).slice(0, 400) });
});
