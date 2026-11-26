// 增量抓取：卡牌广场今天 0:00 之后发布的牌组（含发布人 uid/昵称/说明）
import fs from "node:fs";

const URL = "https://api-takumi.mihoyo.com/event/cardsquare/index";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://www.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = "/tmp/today-decks.json";
const STATE = "/root/workspace/art/decklib-state.json";
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return { lastScrapedAt: 0 };
  }
};
const state = readState();
// 优先级：命令行参数 > 断点文件 > 0（全量）
const SINCE = Number(process.argv[2] ?? state.lastScrapedAt ?? 0);
const LABELS = [14, 19, 12, 13, 11, 20, 27, 15, 22, 3];

const items = new Map();
let stopped = 0;

async function crawl(label) {
  let token = "";
  let pages = 0;
  while (pages < 25) {
    let json;
    try {
      const body = { page_size: 50, next_page_token: token };
      if (label != null) body.label_id = label;
      const res = await fetch(URL, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
      json = await res.json();
    } catch (e) {
      await sleep(1200);
      continue;
    }
    if (json.retcode !== 0) break;
    const list = json.data?.list ?? [];
    let older = 0;
    for (const item of list) {
      if (!item?.card_code || !item?.id) continue;
      const createdAt = item.created_at ?? 0;
      if (createdAt < SINCE) {
        older++;
        continue;
      }
      items.set(item.id, {
        id: item.id,
        code: item.card_code,
        title: (item.title ?? "").slice(0, 80),
        desc: (item.desc ?? "").slice(0, 4000),
        uid: String(item.account_uid ?? ""),
        nickname: item.nickname ?? "",
        labels: item.label_ids ?? [],
        tags: item.tags ?? [],
        likes: item.like_cnt ?? 0,
        views: item.view_cnt ?? 0,
        createdAt,
      });
    }
    pages++;
    token = json.data?.next_page_token ?? "";
    // 整页都比今天旧 → 这一池子已经到头
    if (!token || list.length === 0 || older === list.length) {
      stopped++;
      break;
    }
    await sleep(160);
  }
}

for (const label of [...LABELS, null]) {
  await crawl(label);
  console.log(`label ${label}: 累计 ${items.size} 套（今日）`);
}

fs.writeFileSync(OUT, JSON.stringify([...items.values()]));
// 更新断点：记最大 created_at + 1，避免同一秒的重复抓取
// 断点记「本次运行结束时间 - 5 分钟」：既不会漏掉发帖时间略早的新帖，也不用担心服务器时钟偏差
const nextSince = Math.floor(Date.now() / 1000) - 300;
fs.mkdirSync("/root/workspace/art", { recursive: true });
fs.writeFileSync(
  STATE,
  JSON.stringify(
    { lastScrapedAt: nextSince, lastRunAt: new Date().toISOString(), lastCount: items.size },
    null,
    1,
  ),
);
console.log(
  `本次新发布 ${items.size} 套 → ${OUT}（${stopped} 个池子提前停止）；断点更新为 ${nextSince}（${new Date(
    nextSince * 1000,
  ).toLocaleString("zh-CN")}）`,
);
