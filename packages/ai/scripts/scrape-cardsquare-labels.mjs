// 按分区标签再抓一轮卡牌广场（每个 label 一个池子，合起来比无标签列表大）
import fs from "node:fs";
const URL = "https://api-takumi.mihoyo.com/event/cardsquare/index";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://www.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const items = new Map();
for (const d of JSON.parse(fs.readFileSync("/tmp/cardsquare-raw.json", "utf8"))) items.set(d.id ?? d.code, d);
const labels = JSON.parse(process.argv[2] ?? "[14,19,12,13,11,20,27,15,22,3]");
for (const label of labels) {
  let token = "";
  let pages = 0;
  let added = 0;
  while (pages < 40) {
    let json;
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ page_size: 50, next_page_token: token, label_id: label }),
      });
      json = await res.json();
    } catch (e) {
      await sleep(1000);
      continue;
    }
    if (json.retcode !== 0) break;
    const list = json.data?.list ?? [];
    for (const item of list) {
      if (!item?.card_code) continue;
      const key = item.id ?? item.card_code;
      if (!items.has(key)) added++;
      items.set(key, {
        id: item.id,
        code: item.card_code,
        title: (item.title ?? "").slice(0, 60),
        desc: (item.desc ?? "").slice(0, 300),
        labels: item.label_ids ?? [],
        likes: item.like_cnt ?? item.liked_cnt ?? 0,
        views: item.view_cnt ?? 0,
        roleCards: item.role_cards ?? [],
        actionCards: item.action_cards ?? [],
        nickname: item.nickname ?? "",
        createdAt: item.created_at ?? 0,
        section: label,
      });
    }
    pages++;
    token = json.data?.next_page_token ?? "";
    if (!token || list.length === 0) break;
    await sleep(200);
  }
  console.log(`label ${label}: ${pages} 页，新增 ${added}，累计 ${items.size}`);
}
fs.writeFileSync("/tmp/cardsquare-raw-all.json", JSON.stringify([...items.values()]));
console.log(`合计 ${items.size} 套 -> /tmp/cardsquare-raw-all.json`);
