// 合并子代理对「短说明牌组」的提炼结果（art/notes2/out-short-XX.json → deck-library.json）
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const DIR = "/root/workspace/art/notes2";

const library = JSON.parse(fs.readFileSync(LIB, "utf8"));
const byId = new Map(library.decks.map((deck) => [deck.id, deck]));

let files = 0;
let merged = 0;
let overLength = 0;

const batchFiles = fs
  .readdirSync(DIR)
  .filter((name) => /^short-\d+\.json$/.test(name))
  .sort();

for (const name of batchFiles) {
  const outName = name.replace("short-", "out-short-");
  const outPath = `${DIR}/${outName}`;
  if (!fs.existsSync(outPath)) {
    continue;
  }
  let inputs;
  let outputs;
  try {
    inputs = JSON.parse(fs.readFileSync(`${DIR}/${name}`, "utf8"));
    outputs = JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch (error) {
    console.log(`跳过坏文件 ${outName}：${String(error?.message ?? error).slice(0, 60)}`);
    continue;
  }
  if (!Array.isArray(inputs) || !Array.isArray(outputs)) {
    continue;
  }
  files++;
  const byOutId = new Map(
    outputs
      .filter((item) => item && typeof item === "object" && item.id)
      .map((item) => [String(item.id).trim(), item]),
  );
  inputs.forEach((input, index) => {
    const id = String(input.id).trim();
    const item =
      byOutId.get(id) ?? (outputs[index] && typeof outputs[index] === "object" ? outputs[index] : null);
    const deck = byId.get(id);
    if (!item || !deck) {
      return;
    }
    const sections = ["open", "mid", "watch", "weak", "verdict"].map((key) =>
      String(item.guide?.[key] ?? "").replace(/\s+/g, " ").trim(),
    );
    if (sections.join("").length === 0) {
      return;
    }
    let trimmed = sections;
    const total = sections.join("").length;
    if (total > 200) {
      overLength++;
      const ratio = 200 / total;
      trimmed = sections.map((text) => text.slice(0, Math.max(10, Math.floor(text.length * ratio))));
    }
    deck.guide = { open: trimmed[0], mid: trimmed[1], watch: trimmed[2], weak: trimmed[3], verdict: trimmed[4] };
    deck.guideSource = "ai";
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      deck.authorTags = item.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6);
    }
    if (item.role) {
      deck.role = String(item.role).trim().slice(0, 12);
    }
    merged++;
  });
}

library.updatedAt = Date.now();
fs.writeFileSync(LIB, JSON.stringify(library));
console.log(`合并 ${files} 个批次文件，写入 ${merged} 套（超 200 字被压缩 ${overLength} 套）`);
