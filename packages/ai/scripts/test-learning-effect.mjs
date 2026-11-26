// 验证「AI 存经验会不会变强」：
// 1) 先跑 N 局自对弈生成经验（learning）
// 2) 分别用「无经验」和「有经验」的权重各构建一批牌组
// 3) 让这些牌组对同一批固定对手打快棋，比较平均胜率
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/root/workspace/gi-tcg/packages/standalone/dist";
const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const PORT = 8911;

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
console.log("合法牌池:", pool.length); console.log = console.log.bind(console);

const fp = (deck) =>
  `${[...deck.characters].sort((a, b) => a - b).join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`;

const learning = ai.createLearning();
const TRAIN_GAMES = 40;
for (let i = 0; i < TRAIN_GAMES; i++) {
  const a = pool[Math.floor(Math.random() * pool.length)];
  const b = pool[Math.floor(Math.random() * pool.length)];
  if (a === b) continue;
  const result = await ai.playFastGame(data, [a, b], (Math.random() * 1e9) >>> 0);
  ai.recordGame(learning, [a, b], result.winner);
}
console.log("经验局数:", TRAIN_GAMES, "记录牌组:", Object.keys(learning.decks).length);

const buildSet = (withLearning) => {
  const decks = [];
  for (let i = 0; i < 6; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const built = ai.buildDeck({
        deckData,
        seed: 1000 + i * 37 + attempt,
        cardWeights: withLearning ? ai.cardWeights(learning) : undefined,
        characterWeights: withLearning ? ai.characterWeights(learning) : undefined,
        deckWinRates: withLearning
          ? new Map(Object.entries(learning.decks).map(([key, r]) => [key, (r.wins + 1) / (r.games + 2)]))
          : undefined,
        deckStrength: "balanced",
      });
      if (ai.validateDeck(built, deckData).valid) {
        decks.push(built);
        break;
      }
    }
  }
  return decks;
};

const opponents = pool.slice(0, 3);

const evaluate = async (decks) => {
  let games = 0;
  let wins = 0;
  for (const deck of decks) {
    for (const opp of opponents) {
      for (let side = 0; side < 2; side++) {
        const decksPair = side === 0 ? [deck, opp] : [opp, deck];
        const result = await ai.playFastGame(data, decksPair, (Math.random() * 1e9) >>> 0);
        games++;
        if (result.winner === side) wins++;
      }
    }
  }
  return { games, wins, rate: games ? wins / games : 0 };
};

const plain = buildSet(false);
const trained = buildSet(true);
console.log("构建成功：无经验", plain.length, "有经验", trained.length);

const plainResult = await evaluate(plain);
const trainedResult = await evaluate(trained);

console.log(
  `无经验：${plainResult.wins}/${plainResult.games} = ${(plainResult.rate * 100).toFixed(1)}%`,
);
console.log(
  `有经验：${trainedResult.wins}/${trainedResult.games} = ${(trainedResult.rate * 100).toFixed(1)}%`,
);
console.log(
  "差值:",
  `${((trainedResult.rate - plainResult.rate) * 100).toFixed(1)} 个百分点`,
);
server.close();
