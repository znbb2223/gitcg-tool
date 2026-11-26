// 给老米游社帖的牌组补发布人（uid/昵称）和说明
import fs from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Referer: "https://m.miyoushe.com/ys/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decks = JSON.parse(fs.readFileSync("/tmp/miyoushe-decks.json", "utf8"));
const postIds = [...new Set(decks.map((d) => d.postId))];
const out = {};

const clean = (html) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

for (const postId of postIds) {
  try {
    const res = await fetch(`https://bbs-api.miyoushe.com/post/wapi/getPostFull?post_id=${postId}&read=1`, {
      headers: HEADERS,
    });
    const json = await res.json();
    const data = json.data?.post;
    const post = data?.post;
    const user = data?.user;
    out[postId] = {
      uid: String(user?.uid ?? ""),
      nickname: user?.nickname ?? "",
      subject: post?.subject ?? "",
      note: clean(post?.content ?? "").slice(0, 600),
    };
    console.log(postId, out[postId].nickname, out[postId].note.length);
  } catch (e) {
    console.log(postId, "失败", String(e?.message ?? e).slice(0, 40));
  }
  await sleep(150);
}
fs.writeFileSync("/tmp/miyoushe-meta.json", JSON.stringify(out, null, 1));
console.log(`完成 ${Object.keys(out).length}/${postIds.length}`);
