// 下载 cardFace 变体（历史记录/详情用），只下缩略图
import fs from "node:fs";
import path from "node:path";
const REMOTE = "https://static-data.piovium.org/api/v5";
const BASE = path.resolve("public/assets-local/api/v5");
let done = 0, miss = 0;
const ids = new Set([0]);
for (const lang of ["CHS", "EN"]) {
  for (const cat of ["characters", "entities"]) {
    const file = path.join(BASE, `data/latest/${lang}/${cat}.json`);
    if (!fs.existsSync(file)) continue;
    for (const item of JSON.parse(fs.readFileSync(file, "utf8"))) {
      ids.add(item.id);
      for (const s of item.skills ?? []) if (typeof s.id === "number") ids.add(s.id);
    }
  }
}
async function fetchBuf(url) {
  for (let i = 0; i < 2; i++) {
    try { const r = await fetch(url); if (!r.ok) return null; return Buffer.from(await r.arrayBuffer()); } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  return null;
}
const tasks = [...ids].map((id) => async () => {
  const file = path.join(BASE, `image/${id}/cardFace/thumb.webp`);
  if (fs.existsSync(file)) { done++; return; }
  const buf = await fetchBuf(`${REMOTE}/image/${id}?thumbnail=true&type=cardFace`);
  if (!buf) { miss++; return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  done++;
});
let i = 0;
await Promise.all(Array.from({ length: 12 }, async () => { while (i < tasks.length) await tasks[i++](); }));
console.log(`cardFace 缩略图：成功 ${done}，失败 ${miss}`);
