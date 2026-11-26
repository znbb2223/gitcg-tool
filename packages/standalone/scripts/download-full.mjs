// 补齐全尺寸图片（卡片详情/角色状态图用）
import fs from "node:fs";
import path from "node:path";

const REMOTE = "https://static-data.piovium.org/api/v5";
const BASE = path.resolve("public/assets-local/api/v5");
const LANGS = ["CHS", "EN"];
let done = 0, failed = 0, bytes = 0;

async function fetchBuf(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  return null;
}

const ids = new Set([0]);
for (const lang of LANGS) {
  for (const category of ["characters", "entities"]) {
    const file = path.join(BASE, `data/latest/${lang}/${category}.json`);
    if (!fs.existsSync(file)) continue;
    for (const item of JSON.parse(fs.readFileSync(file, "utf8"))) {
      ids.add(item.id);
      for (const skill of item.skills ?? []) if (typeof skill.id === "number") ids.add(skill.id);
    }
  }
}
console.log("id 数量:", ids.size);

const tasks = [];
for (const id of ids) {
  for (const type of ["unspecified", "icon"]) {
    tasks.push(async () => {
      const file = path.join(BASE, `image/${id}/${type}/full.webp`);
      if (fs.existsSync(file)) { done += 1; return; }
      const buf = await fetchBuf(`${REMOTE}/image/${id}?thumbnail=false&type=${type}`);
      if (buf) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buf);
        bytes += buf.length;
        done += 1;
        if (done % 300 === 0) console.log(`已下载 ${done}，${(bytes / 1e6).toFixed(0)} MB`);
      } else {
        failed += 1;
      }
    });
  }
}
let index = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (index < tasks.length) {
    const task = tasks[index++];
    await task();
  }
}));
console.log(`完成：成功 ${done}，失败 ${failed}，${(bytes / 1e6).toFixed(0)} MB`);
