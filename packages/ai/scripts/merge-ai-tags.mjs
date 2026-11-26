// 合并子代理对「有作者说明的牌组」的分析结果：标签、定位、重写的玩法说明（≤200 字）
import fs from "node:fs";
import path from "node:path";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const NOTE_DIR = "/root/workspace/art/notes";

const library = JSON.parse(fs.readFileSync(LIB, "utf8"));
const decks = library.decks;
const byId = new Map(decks.map((deck) => [deck.id, deck]));

const batchFiles = fs
  .readdirSync(NOTE_DIR)
  .filter((name) => /^batch-\d+\.json$/.test(name))
  .sort();

const analysis = new Map();
let bad = 0;
for (const name of batchFiles) {
  const outName = name.replace("batch-", "out-");
  const outPath = path.join(NOTE_DIR, outName);
  if (!fs.existsSync(outPath)) {
    continue;
  }
  let inputs;
  let outputs;
  try {
    inputs = JSON.parse(fs.readFileSync(path.join(NOTE_DIR, name), "utf8"));
    outputs = JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch (error) {
    console.log(`跳过坏文件 ${outName}：${String(error?.message ?? error).slice(0, 60)}`);
    bad++;
    continue;
  }
  if (!Array.isArray(inputs) || !Array.isArray(outputs)) {
    bad++;
    continue;
  }
  const byId = new Map();
  for (const item of outputs) {
    if (item && typeof item === "object" && item.id) {
      byId.set(String(item.id).trim(), item);
    }
  }
  inputs.forEach((input, index) => {
    const id = String(input.id).trim();
    // 优先按顺序配对（子代理常把 cardsquare-x- 的 x 写丢），次数不够再按 id 找
    const item =
      byId.get(id) ??
      (outputs[index] && typeof outputs[index] === "object" ? outputs[index] : null);
    if (!item) {
      return;
    }
    const tags = (Array.isArray(item.tags) ? item.tags : [])
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0 && tag.length <= 8)
      .slice(0, 6);
    const guide = item.guide ?? {};
    const sections = ["open", "mid", "watch", "weak", "verdict"].map((key) =>
      String(guide[key] ?? "").replace(/\s+/g, " ").trim(),
    );
    const total = sections.join("").length;
    let trimmed = sections;
    if (total > 200) {
      const ratio = 200 / total;
      trimmed = sections.map((text) => text.slice(0, Math.max(12, Math.floor(text.length * ratio))));
    }
    analysis.set(id, {
      tags,
      role: String(item.role ?? "").trim().slice(0, 12),
      guide: {
        open: trimmed[0],
        mid: trimmed[1],
        watch: trimmed[2],
        weak: trimmed[3],
        verdict: trimmed[4],
      },
      chars: trimmed.join("").length,
    });
  });
}

let updated = 0;
let over = 0;
for (const deck of decks) {
  const item = analysis.get(deck.id);
  if (!item) {
    continue;
  }
  updated++;
  deck.authorTags = item.tags;
  deck.role = item.role;
  if (item.guide.open && item.guide.mid) {
    deck.guide = item.guide;
    deck.guideSource = "ai";
  }
  if (item.chars > 200) {
    over++;
  }
}

fs.writeFileSync(LIB, JSON.stringify(library));
const size = fs.statSync(LIB).size / 1024 / 1024;
console.log(
  `读入 ${batchFiles.length} 个批次文件（坏 ${bad}），分析 ${analysis.size} 套，写回 ${updated} 套，仍超 200 字 ${over} 套`,
);
console.log(`输出 ${size.toFixed(1)}MB`);
