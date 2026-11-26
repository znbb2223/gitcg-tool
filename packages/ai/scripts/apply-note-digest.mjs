// 把「有发布者说明但还没经过 AI 深加工」的牌组，用说明本身整理成五段玩法说明
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";
const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
const decks = lib.decks ?? [];

const splitSentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/[。！？；\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);

const pick = (sentences, patterns) => {
  const hits = sentences.filter((sentence) => patterns.some((pattern) => pattern.test(sentence)));
  return hits;
};

const clip = (text, limit) => (text.length <= limit ? text : `${text.slice(0, limit - 1)}…`);

const buildDigest = (note) => {
  const clauses = note
    .replace(/\s+/g, " ")
    .split(/[。！？；，\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
  if (clauses.length === 0) {
    return null;
  }
  const used = new Set();
  const takeUntil = (limit, patterns) => {
    const out = [];
    if (patterns) {
      for (const clause of clauses) {
        if (!used.has(clause) && patterns.some((pattern) => pattern.test(clause))) {
          used.add(clause);
          out.push(clause);
        }
      }
      if (out.join("，").length > 0) {
        return out.join("，");
      }
    }
    let length = 0;
    for (const clause of clauses) {
      if (used.has(clause)) {
        continue;
      }
      if (length > 0 && length + clause.length > limit) {
        break;
      }
      used.add(clause);
      out.push(clause);
      length += clause.length + 1;
    }
    return out.join("，");
  };

  const open = takeUntil(60, [/起手/, /留牌/, /开局/, /先手/, /换牌/, /第一回合/, /t1/i]);
  const mid = takeUntil(60, [/中期/, /连招/, /出牌/, /打法/, /思路/, /节奏/, /装备/, /天赋/, /站场/]);
  const watch = takeUntil(48, [/注意/, /小心/, /不要/, /别/, /优先/, /关键/]);
  const weak = takeUntil(48, [/怕/, /弱点/, /克制/, /打不过/, /劣势/]);
  const verdict = takeUntil(48) || "作者的说明已经拆进上面几段。";

  return {
    open: clip(open || "按作者说明的开局思路留牌。", 75),
    mid: clip(mid || "按作者说明的中期节奏展开。", 75),
    watch: clip(watch || "说明里没有特别提到注意事项。", 70),
    weak: clip(weak || "说明里没有特别提到弱点。", 70),
    verdict: clip(verdict || "以上按作者说明整理，未做额外推测。", 70),
  };
};

let digested = 0;
let skipped = 0;
for (const deck of decks) {
  if (deck.guideSource === "ai") {
    skipped++;
    continue;
  }
  const note = (deck.note ?? "").trim();
  if (note.length < 12) {
    skipped++;
    continue;
  }
  const digest = buildDigest(note);
  if (!digest) {
    skipped++;
    continue;
  }
  const total = ["open", "mid", "watch", "weak", "verdict"].reduce(
    (sum, key) => sum + digest[key].length,
    0,
  );
  if (total > 200) {
    const ratio = 200 / total;
    for (const key of ["open", "mid", "watch", "weak", "verdict"]) {
      digest[key] = digest[key].slice(0, Math.max(12, Math.floor(digest[key].length * ratio)));
    }
  }
  deck.guide = digest;
  deck.guideSource = "digest";
  digested++;
}

fs.writeFileSync(LIB, JSON.stringify(lib));
const withNote = decks.filter((deck) => (deck.note ?? "").trim().length >= 12).length;
const covered = decks.filter(
  (deck) => deck.guideSource === "ai" || deck.guideSource === "digest",
).length;
console.log(
  `整理了 ${digested} 套（跳过 ${skipped}）；说明≥12字 ${withNote} 套，其中已提炼 ${covered} 套`,
);
