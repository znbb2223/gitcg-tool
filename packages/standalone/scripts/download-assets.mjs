// 下载离线图片资源到 public/assets-local（打包用）
// 布局与本地模式代码约定一致：
//   api/v5/image/{id}/{type}/thumb.webp
//   api/v5/image/raw/{name}.webp
//   api/v5/data/latest/{LANG}/{category}.json
//   ui/{name}.webp
import fs from "node:fs";
import path from "node:path";

const REMOTE = "https://static-data.piovium.org/api/v5";
const UI_REMOTE = "https://ui-assets.piovium.org";
const OUT = path.resolve("public/assets-local");
const LANGS = ["CHS", "EN"];
let done = 0, failed = 0, bytes = 0;

function write(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  bytes += buf.length;
}

async function download(url, file) {
  if (fs.existsSync(file)) { done += 1; return true; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      write(file, Buffer.from(await res.arrayBuffer()));
      done += 1;
      if (done % 200 === 0) console.log(`已下载 ${done} 个，失败 ${failed}，${(bytes / 1e6).toFixed(1)} MB`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  failed += 1;
  return false;
}

const limit = 10;
async function runPool(tasks) {
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < tasks.length) {
      const task = tasks[index++];
      await task();
    }
  });
  await Promise.all(workers);
}

const chars = {}, entities = {};
for (const lang of LANGS) {
  const res = await fetch(`${REMOTE}/data/latest/${lang}/characters`);
  chars[lang] = (await res.json()).data;
  write(path.join(OUT, `api/v5/data/latest/${lang}/characters.json`), Buffer.from(JSON.stringify(chars[lang])));
  const res2 = await fetch(`${REMOTE}/data/latest/${lang}/entities`);
  entities[lang] = (await res2.json()).data;
  write(path.join(OUT, `api/v5/data/latest/${lang}/entities.json`), Buffer.from(JSON.stringify(entities[lang])));
}

const ids = new Set([0]);
const rawNames = new Set();
for (const lang of LANGS) {
  for (const item of [...chars[lang], ...entities[lang]]) ids.add(item.id);
  for (const item of [...chars[lang], ...entities[lang]]) {
    for (const key of ["icon", "buffIcon", "shownIcon"]) {
      const value = item[key];
      if (typeof value === "string" && /^[A-Za-z0-9_]+$/.test(value)) rawNames.add(value);
    }
    for (const skill of item.skills ?? []) {
      if (typeof skill.id === "number") ids.add(skill.id);
      if (typeof skill.icon === "string" && /^[A-Za-z0-9_]+$/.test(skill.icon)) rawNames.add(skill.icon);
    }
  }
}
console.log(`ids: ${ids.size}, raw names: ${rawNames.size}`);

const tasks = [];
for (const id of ids) {
  tasks.push(() => download(`${REMOTE}/image/${id}?thumbnail=true&type=unspecified`, path.join(OUT, `api/v5/image/${id}/unspecified/thumb.webp`)));
  tasks.push(() => download(`${REMOTE}/image/${id}?thumbnail=true&type=icon`, path.join(OUT, `api/v5/image/${id}/icon/thumb.webp`)));
}
for (const name of rawNames) {
  tasks.push(() => download(`${REMOTE}/image/raw/${name}`, path.join(OUT, `api/v5/image/raw/${name}.webp`)));
}

// UI 资源：运行时抓到的名单 + 代码里动态拼的名字
const uiNames = new Set();
try {
  const captured = JSON.parse(fs.readFileSync("/tmp/asset-urls.json", "utf8"));
  for (const url of captured) {
    if (url.includes("ui-assets.piovium.org/")) {
      uiNames.add(url.split("ui-assets.piovium.org/")[1]);
    }
  }
} catch {}
for (const extra of ["CardFrameNormal.svg.webp", "MaskShield.webp", "MaskBarrier.webp", "MaskFrozen.webp", "ChessboardBackground.webp", "NightsoulsBlessingMask.svg.webp"]) {
  uiNames.add(extra);
}
for (const name of uiNames) {
  tasks.push(() => download(`${UI_REMOTE}/${name}`, path.join(OUT, `ui/${name}`)));
}
console.log(`UI 资源 ${uiNames.size} 个`);

await runPool(tasks);
console.log(`完成：${done} 个文件，失败 ${failed}，合计 ${(bytes / 1e6).toFixed(1)} MB`);

// 元素图标（技能/历史记录里 <image type="element" id="1..7"/>）
const ELEMENT_ICONS = {
  0: "UI_Gcg_Debuff_Common_Element_Physics",
  1: "UI_Gcg_Buff_Common_Element_Ice",
  2: "UI_Gcg_Buff_Common_Element_Water",
  3: "UI_Gcg_Buff_Common_Element_Fire",
  4: "UI_Gcg_Buff_Common_Element_Electric",
  5: "UI_Gcg_Buff_Common_Element_Wind",
  6: "UI_Gcg_Buff_Common_Element_Rock",
  7: "UI_Gcg_Buff_Common_Element_Grass",
};
for (const [id, name] of Object.entries(ELEMENT_ICONS)) {
  const src = path.join(OUT, `api/v5/image/raw/${name}.webp`);
  const dest = path.join(OUT, `api/v5/image/${id}/icon/thumb.webp`);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
console.log("元素图标已补齐");
