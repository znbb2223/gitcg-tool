// 重抓米游社卡牌广场：这次连发布人（account_uid/nickname/avatar）和完整说明一起存
import fs from "node:fs";

const URL = "https://api-takumi.mihoyo.com/event/cardsquare/index";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://www.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LABELS = JSON.parse(process.argv[2] ?? "[14,19,12,13,11,20,27,15,22,3]");
const MAX_PAGES = Number(process.argv[3] ?? 60);
const OUT = process.argv[4] ?? "/tmp/cardsquare-full.json";

const items = new Map();
const trim = (s, n) => (s ?? "").replace(/\r/g, "").slice(0, n);

for (const label of [...LABELS, null]) {
  let token = "";
  let pages = 0;
  let added = 0;
  while (pages < MAX_PAGES) {
    let json;
    try {
      const body = { page_size: 50, next_page_token: token };
      if (label != null) {
        body.label_id = label;
      }
      const res = await fetch(URL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
      });
      json = await res.json();
    } catch (e) {
      console.log(`label ${label} 第 ${pages + 1} 页失败：${String(e?.message ?? e).slice(0, 50)}`);
      await sleep(1500);
      continue;
    }
    if (json.retcode !== 0) {
      console.log(`label ${label} retcode ${json.retcode} ${json.message}`);
      break;
    }
    const list = json.data?.list ?? [];
    for (const item of list) {
      if (!item?.card_code || !item?.id) {
        continue;
      }
      const prev = items.get(item.id);
      const entry = {
        id: item.id,
        code: item.card_code,
        title: trim(item.title, 80),
        desc: trim(item.desc, 4000),
        uid: String(item.account_uid ?? ""),
        nickname: item.nickname ?? "",
        avatar: item.avatar_url ?? "",
        labels: item.label_ids ?? [],
        tags: item.tags ?? [],
        likes: item.like_cnt ?? 0,
        views: item.view_cnt ?? 0,
        comments: item.comment_cnt ?? 0,
        createdAt: item.created_at ?? 0,
        section: label,
      };
      if (!prev) {
        added++;
      }
      items.set(item.id, entry);
    }
    pages++;
    token = json.data?.next_page_token ?? "";
    if (!token || list.length === 0) {
      break;
    }
    await sleep(180);
  }
  console.log(`label ${label}: ${pages} 页，新增 ${added}，累计 ${items.size}`);
}

fs.writeFileSync(OUT, JSON.stringify([...items.values()]));
const withAuthor = [...items.values()].filter((d) => d.uid && d.nickname).length;
const withDesc = [...items.values()].filter((d) => d.desc.trim().length > 0).length;
console.log(
  `合计 ${items.size} 套 → ${OUT}（有发布人 ${withAuthor}，有说明 ${withDesc}，共 ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}MB）`,
);
