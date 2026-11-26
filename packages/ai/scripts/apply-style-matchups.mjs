// 从训练分片里取「流派对阵矩阵」，写进牌组库，供牌组详情展示真实对局差异
import fs from "node:fs";
import path from "node:path";

const SHARD_DIR = process.env.SHARD_DIR ?? "/tmp/train-shards";
const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";

const pairs = new Map();
if (fs.existsSync(SHARD_DIR)) {
  for (const file of fs.readdirSync(SHARD_DIR)) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const shard = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, file), "utf8"));
    for (const [key, stat] of Object.entries(shard.pairs ?? {})) {
      const acc = pairs.get(key) ?? { games: 0, aWins: 0 };
      acc.games += stat.games ?? 0;
      acc.aWins += stat.aWins ?? 0;
      pairs.set(key, acc);
    }
  }
}

const STYLES = ["aggro", "midrange", "control", "combo"];
const rateOf = (from, to) => {
  const stat = pairs.get(`${from}>${to}`);
  if (!stat || stat.games < 15) {
    return null;
  }
  return stat.aWins / stat.games;
};

// 双向合并：a 对 b 的胜率取两个方向的平均（有则用）
const matrix = {};
for (const a of STYLES) {
  matrix[a] = {};
  for (const b of STYLES) {
    if (a === b) {
      continue;
    }
    const forward = rateOf(a, b);
    const backward = rateOf(b, a);
    const rate =
      forward !== null && backward !== null
        ? (forward + (1 - backward)) / 2
        : (forward ?? (backward !== null ? 1 - backward : null));
    if (rate !== null) {
      const games =
        (pairs.get(`${a}>${b}`)?.games ?? 0) + (pairs.get(`${b}>${a}`)?.games ?? 0);
      matrix[a][b] = { rate: Number(rate.toFixed(4)), games };
    }
  }
}

const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
lib.styleMatchups = matrix;
for (const deck of lib.decks ?? []) {
  const row = matrix[deck.style ?? "midrange"] ?? {};
  const entries = Object.entries(row).sort((x, y) => x[1].rate - y[1].rate);
  deck.styleMatchups = entries.map(([style, info]) => ({ style, ...info }));
}
lib.updatedAt = Date.now();
fs.writeFileSync(LIB, JSON.stringify(lib));

console.log(
  "矩阵：",
  Object.entries(matrix)
    .map(([style, row]) => `${style}：${Object.entries(row).map(([k, v]) => `${k} ${(v.rate * 100).toFixed(0)}%`).join(" / ")}`)
    .join(" | "),
);
