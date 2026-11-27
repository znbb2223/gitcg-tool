/**
 * 汇总 DMC 实验链的结果为 Markdown。
 *
 * 用法：node dmc-report.mjs --log=/data/gitcg/dmc/chain.log --dir=/data/gitcg/dmc
 * 会在 stdout 打出可粘贴的 Markdown 表格。
 */
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((item) => {
    const [key, value = "true"] = item.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const logPath = args.log ?? "/data/gitcg/dmc/chain.log";
const dir = args.dir ?? path.dirname(logPath);
const log = fs.readFileSync(logPath, "utf8");

const valLines = [...log.matchAll(/epoch (\d+)\/(\d+)\s+train_mse ([\d.]+)\s+val_mse ([\d.]+)\s+val_sign ([\d.]+)%/g)];
const lastVal = valLines.length
  ? valLines[valLines.length - 1].slice(1)
  : null;
const trains = [...log.matchAll(/训练 (\S+)/g)].map((match) => match[1]);
const samples = [...log.matchAll(/(r\d) 采样完成：(\d+) 条/g)].map((match) => ({ round: match[1], count: match[2] }));

const evals = [];
for (const file of fs.readdirSync(dir).filter((name) => name.startsWith("eval-") && name.endsWith(".jsonl"))) {
  const tag = file.slice("eval-".length, -".jsonl".length);
  let games = 0;
  let a = 0;
  let b = 0;
  let d = 0;
  let e = 0;
  for (const line of fs.readFileSync(path.join(dir, file), "utf8").split("\n")) {
    if (!line.startsWith("RESULT")) {
      continue;
    }
    const row = JSON.parse(line.slice(7));
    games += row.games;
    a += row.aWin;
    b += row.bWin;
    d += row.draw;
    e += row.error;
  }
  const decided = a + b;
  evals.push({
    tag,
    games,
    a,
    b,
    draw: d,
    error: e,
    rate: decided ? ((a / decided) * 100).toFixed(1) : "-",
  });
}

console.log("## 采样与训练\n");
console.log("| 轮次 | 样本数 |");
console.log("|---|---|");
for (const row of samples) {
  console.log(`| ${row.round} | ${Number(row.count).toLocaleString()} |`);
}
console.log("\n## 训练（最后一轮验证集）\n");
if (lastVal) {
  console.log(`- epoch ${lastVal[0]}/${lastVal[1]}：train_mse ${lastVal[2]}，val_mse ${lastVal[3]}，val_sign ${lastVal[4]}%`);
} else {
  console.log("- 还没产出训练日志");
}
console.log(`- 已训练权重：${trains.join("、") || "无"}`);
console.log("\n## 评测（A = DMC）\n");
console.log("| 对比 | 局数 | A 胜 | B 胜 | 平 | 出错 | A 胜率 |");
console.log("|---|---|---|---|---|---|---|");
for (const row of evals.sort((left, right) => left.tag.localeCompare(right.tag))) {
  console.log(`| ${row.tag} | ${row.games} | ${row.a} | ${row.b} | ${row.draw} | ${row.error} | ${row.rate}% |`);
}
