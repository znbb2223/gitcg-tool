// 抓官方「卡牌广场」全部牌组（公开接口，无需登录）
import fs from "node:fs";

const URL = "https://api-takumi.mihoyo.com/event/cardsquare/index";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://www.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const maxPages = Number(process.argv[2] ?? 400);
const items = new Map();
let token = "";
let pages = 0;
let emptyStreak = 0;

while (pages < maxPages) {
  let json;
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ page_size: 50, next_page_token: token }),
    });
    json = await res.json();
  } catch (e) {
    console.log(`第 ${pages + 1} 页请求失败：${e.message.slice(0, 50)}`);
    await sleep(1200);
    continue;
  }
  if (json.retcode !== 0) {
    console.log(`retcode ${json.retcode} ${json.message}，停在第 ${pages + 1} 页`);
    break;
  }
  const list = json.data?.list ?? [];
  for (const item of list) {
    if (!item?.card_code) {
      continue;
    }
    items.set(item.id ?? item.card_code, {
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
    });
  }
  pages++;
  emptyStreak = list.length === 0 ? emptyStreak + 1 : 0;
  if (pages % 10 === 0 || list.length === 0) {
    console.log(`第 ${pages} 页，累计 ${items.size} 套，下一页 token ${list.length ? "有" : "空"}`);
  }
  token = json.data?.next_page_token ?? "";
  if (!token || emptyStreak >= 2) {
    break;
  }
  await sleep(220);
}

fs.writeFileSync("/tmp/cardsquare-raw.json", JSON.stringify([...items.values()]));
console.log(`抓取结束：${pages} 页，${items.size} 套原始牌组 -> /tmp/cardsquare-raw.json`);
