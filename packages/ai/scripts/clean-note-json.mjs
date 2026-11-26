// 清洗历史脏数据：有些米游社说明被存成了 {"describe": "...","imgs": [...]} 的原文
import fs from "node:fs";

const LIB = "/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json";

export function sanitizeNote(raw) {
  const text = String(raw ?? "").trim();
  if (!text.startsWith("{")) {
    const trimmed = /_\(|\)_/.test(text)
      ? text.replace(/_?\([^()]{1,10}\)/g, " ").replace(/[ \t]+/g, " ")
      : text;
    return trimmed.trim();
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  let describe = String(parsed?.describe ?? "");
  const hasImage = Array.isArray(parsed?.imgs) && parsed.imgs.length > 0;
  // 去掉 _(可莉-好耶)_ 这类表情标记
  describe = describe.replace(/_\([^)]*\)_/g, " ");
  // 去掉分享码（长 base64 串）与 URL
  describe = describe
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (describe.length >= 6) {
    return describe.slice(0, 200);
  }
  return hasImage ? "（作者只发了图片，没有文字说明）" : "";
}

if (process.argv[1]?.endsWith("clean-note-json.mjs")) {
  const lib = JSON.parse(fs.readFileSync(LIB, "utf8"));
  let changed = 0;
  for (const deck of lib.decks ?? []) {
    const next = sanitizeNote(deck.note);
    if (next !== (deck.note ?? "")) {
      deck.note = next;
      changed += 1;
    }
  }
  lib.updatedAt = Date.now();
  fs.writeFileSync(LIB, JSON.stringify(lib));
  console.log(`清洗说明 ${changed} 套`);
}
