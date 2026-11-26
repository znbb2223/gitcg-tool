// 下载单卡片数据（卡片详情/提示用）到本地镜像
import fs from "node:fs";
import path from "node:path";

const REMOTE = "https://static-data.piovium.org/api/v5";
const OUT = path.resolve("public/assets-local/api/v5/datum/latest");
const LANGS = ["CHS", "EN"];
let done = 0, failed = 0;

async function fetchJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch {
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  return null;
}

const ids = new Set([0]);
for (const lang of LANGS) {
  for (const category of ["characters", "entities"]) {
    const data = JSON.parse(fs.readFileSync(path.resolve(`public/assets-local/api/v5/data/latest/${lang}/${category}.json`), "utf8"));
    for (const item of data) {
      ids.add(item.id);
      for (const skill of item.skills ?? []) if (typeof skill.id === "number") ids.add(skill.id);
    }
  }
}
console.log("需要下载的卡片数据:", ids.size);

const tasks = [];
for (const lang of LANGS) {
  for (const id of ids) {
    tasks.push(async () => {
      const file = path.join(OUT, lang, `${id}.json`);
      if (fs.existsSync(file)) { done += 1; return; }
      const json = await fetchJson(`${REMOTE}/datum/latest/${lang}/${id}`);
      if (json) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(json));
        done += 1;
        if (done % 500 === 0) console.log(`已下载 ${done}`);
      } else {
        failed += 1;
      }
    });
  }
}
let index = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (index < tasks.length) {
    const task = tasks[index++];
    await task();
  }
}));
console.log(`完成：成功 ${done}，失败 ${failed}`);

// 关键词数据（-1.json、-6.json 等），规则解释弹窗用
const keywordIds = new Set();
for (const lang of LANGS) {
  for (const id of ids) {
    const file = path.join(OUT, lang, `${id}.json`);
    if (!fs.existsSync(file)) continue;
    const txt = fs.readFileSync(file, "utf8");
    for (const match of txt.matchAll(/\$\[K(\d+)\]/g)) keywordIds.add(Number(match[1]));
  }
}
for (const lang of LANGS) {
  for (const id of keywordIds) {
    const file = path.join(OUT, lang, `-${id}.json`);
    if (fs.existsSync(file)) continue;
    const json = await fetchJson(`${REMOTE}/datum/latest/${lang}/-${id}`);
    if (json) fs.writeFileSync(file, JSON.stringify(json));
  }
}
console.log(`关键词数据 ${keywordIds.size} 个`);
