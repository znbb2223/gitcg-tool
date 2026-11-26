// 补抓老牌组（本地库里、但已经不在广场首页列表里的）详情：标题/说明/发布人
import fs from "node:fs";

const SRC = "/root/workspace/gi-tcg/packages/ai/src/data/deck-library.ts";
const FULL = "/tmp/cardsquare-full.json";
const OUT = process.argv[2] ?? "/tmp/cardsquare-detail.json";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://www.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const have = new Set(JSON.parse(fs.readFileSync(FULL, "utf8")).map((d) => d.id));
const ids = [...fs.readFileSync(SRC, "utf8").matchAll(/"id": "cardsquare-(?:x-)?([0-9a-f]{24})"/g)].map(
  (m) => m[1],
);
const todo = [...new Set(ids)].filter((id) => !have.has(id));
console.log(`本地 ${ids.length} 套，已有详情 ${ids.length - todo.length}，待补 ${todo.length}`);

const done = new Map();
if (fs.existsSync(OUT)) {
  for (const item of JSON.parse(fs.readFileSync(OUT, "utf8"))) {
    done.set(item.id, item);
  }
}
let ok = 0;
let missing = 0;
for (const id of todo) {
  if (done.has(id)) {
    continue;
  }
  let det;
  for (let attempt = 0; attempt < 2 && !det; attempt++) {
    try {
      const res = await fetch(`https://api-takumi.mihoyo.com/event/cardsquare/detail?id=${id}`, {
        headers: HEADERS,
      });
      const json = await res.json();
      det = json.data?.detail;
    } catch (e) {
      await sleep(800);
    }
  }
  if (!det) {
    missing++;
  } else {
    ok++;
    done.set(id, {
      id,
      code: det.card_code ?? "",
      title: (det.title ?? "").slice(0, 80),
      desc: (det.desc ?? "").slice(0, 4000),
      uid: String(det.account_uid ?? ""),
      nickname: det.nickname ?? "",
      avatar: det.avatar_url ?? "",
      labels: det.label_ids ?? [],
      tags: det.tags ?? [],
      likes: det.like_cnt ?? 0,
      views: det.view_cnt ?? 0,
      comments: det.comment_cnt ?? 0,
      createdAt: det.created_at ?? 0,
      section: null,
    });
  }
  if ((ok + missing) % 100 === 0) {
    console.log(`已补 ${ok}，失败 ${missing}，累计 ${done.size}`);
    fs.writeFileSync(OUT, JSON.stringify([...done.values()]));
  }
  await sleep(120);
}
fs.writeFileSync(OUT, JSON.stringify([...done.values()]));
const noDesc = [...done.values()].filter((d) => !d.desc.trim()).length;
console.log(`补全 ${ok} 套，失败 ${missing}，无说明 ${noDesc} → ${OUT}`);
