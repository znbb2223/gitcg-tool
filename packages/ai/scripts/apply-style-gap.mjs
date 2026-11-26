// 给每套牌算「同风格里的相对强弱」，替代原来那套几乎全是「控制」的流派弱点
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
const decks = lib.decks ?? [];

const buckets = new Map();
for (const deck of decks) {
  const style = deck.style ?? "midrange";
  if (!buckets.has(style)) {
    buckets.set(style, { games: 0, wins: 0, count: 0 });
  }
  const bucket = buckets.get(style);
  const games = deck.games ?? 0;
  bucket.games += games;
  bucket.wins += (deck.winRate ?? 0.5) * games;
  bucket.count += 1;
}

const styleAvg = {};
for (const [style, bucket] of buckets) {
  styleAvg[style] = bucket.games > 0 ? bucket.wins / bucket.games : 0.5;
}
lib.styleAvgRate = styleAvg;

let withGap = 0;
for (const deck of decks) {
  const style = deck.style ?? "midrange";
  const avg = styleAvg[style] ?? 0.5;
  const rate = deck.winRate ?? 0.5;
  deck.styleAvgRate = Number(avg.toFixed(4));
  deck.styleGap = Number((rate - avg).toFixed(4));
  if (Math.abs(deck.styleGap) >= 0.03) {
    withGap++;
  }
}

lib.updatedAt = Date.now();
fs.writeFileSync(LIB, JSON.stringify(lib));
console.log(
  `风格均值：${Object.entries(styleAvg)
    .map(([style, rate]) => `${style}=${(rate * 100).toFixed(1)}%`)
    .join(" / ")}；明显偏强/偏弱 ${withGap} 套`,
);
