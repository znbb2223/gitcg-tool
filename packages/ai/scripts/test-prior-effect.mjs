// 100 局量级的经验验证：先打 50 局生成经验，再让「带先验」的一方和「不带」的一方对打 60 局
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/root/workspace/gi-tcg/packages/standalone/dist";
const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const PORT = 8913;
const MIME = { ".json": "application/json", ".webp": "image/webp", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent((req.url ?? "/").split("?")[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("no");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, resolve));

const ai = await import("../dist/index.js");
const { AssetsManager, LOCAL_ASSETS } = await import("@gi-tcg/assets-manager");
const getData = (await import("@gi-tcg/data")).default;
const { CURRENT_VERSION } = await import("@gi-tcg/core");

const manager = new AssetsManager({
  apiBaseUrl: `http://127.0.0.1:${PORT}/assets-local/api`,
  localAssets: LOCAL_ASSETS,
  officialDeckCompatible: true,
});
const deckData = await manager.getDeckData();
const data = getData(CURRENT_VERSION);

const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
const pool = [];
const seen = new Set();
for (const deck of lib.decks ?? []) {
  if (seen.has(deck.code) || deck.chars?.length !== 3 || deck.cards?.length !== 30) continue;
  const candidate = { characters: deck.chars, cards: deck.cards };
  if (!ai.validateDeck(candidate, deckData).valid) continue;
  seen.add(deck.code);
  pool.push(candidate);
  if (pool.length >= 120) break;
}

const TRAIN = 50;
const learning = ai.createLearning();
for (let i = 0; i < TRAIN; i++) {
  const a = pool[Math.floor(Math.random() * pool.length)];
  const b = pool[Math.floor(Math.random() * pool.length)];
  if (a === b) continue;
  const result = await ai.playFastGame(data, [a, b], (Math.random() * 1e9) >>> 0);
  ai.recordGame(learning, [a, b], result.winner);
}
const priors = new Map();
for (const [rawId, entry] of Object.entries(learning.cards ?? {})) {
  const games = (entry.games ?? 0) - (entry.draws ?? 0);
  if (games < 6) continue;
  const rate = (entry.wins ?? 0) / games;
  priors.set(Number(rawId), Math.max(-0.25, Math.min(0.25, (rate - 0.5) * 0.8)));
}
console.log(`训练 ${TRAIN} 局，单卡先验 ${priors.size} 张`);

const EVAL = 60;
let wins = 0;
let games = 0;
for (let i = 0; i < EVAL; i++) {
  const a = pool[Math.floor(Math.random() * pool.length)];
  const b = pool[Math.floor(Math.random() * pool.length)];
  if (a === b) continue;
  const swap = i % 2 === 1;
  const decks = swap ? [b, a] : [a, b];
  const result = await ai.playFastGame(data, decks, (Math.random() * 1e9) >>> 0, {
    cardPriors: priors,
  });
  const priorSide = swap ? 1 : 0;
  games++;
  if (result.winner === priorSide) wins++;
}
console.log(`带先验一方：${wins}/${games} = ${((wins / games) * 100).toFixed(1)}%（基准 50%）`);
server.close();
