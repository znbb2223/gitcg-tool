// 扒米游社七圣召唤版块的牌组码（搜索接口带正文，直接抓分享码）
import fs from "node:fs";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { validateDeck } from "../dist/index.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://m.miyoushe.com/ys/",
};
const KEYWORDS = [
  "七圣召唤 牌组",
  "七圣召唤 分享码",
  "七圣召唤 牌组码",
  "七圣召唤 卡组",
  "七圣召唤 构筑",
  "七圣召唤 阵容",
  "七圣召唤 赛事",
  "七圣召唤 比赛",
  "七圣召唤 邀请赛",
  "七圣召唤 冠军",
  "七圣召唤 赛果",
  "七圣召唤 上分",
  "七圣召唤 攻略",
  "七圣召唤 打法",
  "七圣召唤 强度",
  "七圣召唤 推荐",
  "七圣召唤 新手",
  "七圣召唤 实战",
  "七圣召唤 心得",
  "七圣召唤 教学",
  "七圣召唤 套路",
  "七圣召唤 卡牌广场",
  "七圣召唤 魂向",
  "七圣召唤 轮椅",
  "七圣 牌组",
  "七圣 分享码",
  "牌组分享码",
  "七圣召唤 PVE 牌组",
  "七圣召唤 双打",
  "七圣召唤 组合",
];
const PAGES = Number(process.argv[2] ?? 4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const posts = new Map();
for (const keyword of KEYWORDS) {
  for (let page = 1; page <= PAGES; page++) {
    const url = `https://bbs-api.miyoushe.com/post/wapi/searchPosts?keyword=${encodeURIComponent(keyword)}&page=${page}&page_size=20`;
    try {
      const res = await fetch(url, { headers: HEADERS });
      const json = await res.json();
      const list = json.data?.posts ?? [];
      if (list.length === 0) {
        break;
      }
      for (const item of list) {
        const post = item.post;
        if (!post?.post_id) {
          continue;
        }
        if (!posts.has(post.post_id)) {
          posts.set(post.post_id, {
            postId: post.post_id,
            subject: post.subject ?? "",
            content: post.content ?? "",
            createdAt: post.created_at ?? 0,
            uid: post.uid ?? "",
            forumId: post.f_forum_id ?? 0,
            keywords: [],
          });
        }
        posts.get(post.post_id).keywords.push(keyword);
      }
      console.log(`[${keyword}] 第 ${page} 页 ${list.length} 条，累计帖子 ${posts.size}`);
    } catch (e) {
      console.log(`[${keyword}] 第 ${page} 页失败：${e.message.slice(0, 60)}`);
    }
    await sleep(180);
  }
}

// 搜索接口的正文只有前 100 字，逐帖取全文再找分享码
for (const post of posts.values()) {
  try {
    const res = await fetch(
      `https://bbs-api.miyoushe.com/post/wapi/getPostFull?post_id=${post.postId}&read=1`,
      { headers: HEADERS },
    );
    const json = await res.json();
    const full = json.data?.post?.post;
    if (full?.content) {
      post.content = full.content;
      post.fullContent = true;
    }
  } catch (e) {
    console.log(`详情失败 ${post.postId}: ${e.message.slice(0, 40)}`);
  }
  await sleep(120);
}
console.log(`全文抓取完成，帖子 ${posts.size} 条`);

const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
const decks = new Map();
const CODE_RE = /[A-Za-z0-9+/]{55,90}/g;
let codeHits = 0;
for (const post of posts.values()) {
  const text = `${post.subject}\n${post.content}`;
  for (const code of text.match(CODE_RE) ?? []) {
    codeHits++;
    if (decks.has(code)) {
      continue;
    }
    let deck;
    try {
      deck = DEFAULT_ASSETS_MANAGER.decode(code);
    } catch {
      continue;
    }
    if (!deck?.characters?.length || !validateDeck(deck, deckData).valid) {
      continue;
    }
    decks.set(code, {
      code,
      characters: deck.characters,
      cards: deck.cards,
      postId: post.postId,
      subject: post.subject,
      text: post.content,
      createdAt: post.createdAt,
      uid: post.uid,
    });
  }
}

fs.writeFileSync("/tmp/miyoushe-posts.json", JSON.stringify([...posts.values()]));
fs.writeFileSync("/tmp/miyoushe-decks.json", JSON.stringify([...decks.values()], null, 1));
console.log(`\n帖子 ${posts.size} 条，疑似码片段 ${codeHits} 个，合法牌组 ${decks.size} 套`);
