// 下载高清卡面（420x720，type=cardFace&thumbnail=false），替换原来的 80x137 缩略图
import fs from "node:fs";
import path from "node:path";

const REMOTE = "https://static-data.piovium.org/api/v5";
const BASE = path.resolve("public/assets-local/api/v5");
let done = 0, failed = 0, skipped = 0, bytes = 0;

async function fetchBuf(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
  return null;
}

const ids = fs
  .readdirSync(path.join(BASE, "image"))
  .filter((dir) => /^\d+$/.test(dir))
  .filter((id) =>
    fs.existsSync(path.join(BASE, `image/${id}/cardFace/thumb.webp`)),
  );
console.log("有卡面缩略图的 id 数:", ids.length);

let cursor = 0;
const worker = async () => {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    const dir = path.join(BASE, `image/${id}/cardFace`);
    const file = path.join(dir, "full.webp");
    if (fs.existsSync(file)) {
      skipped++;
      continue;
    }
    const buf = await fetchBuf(
      `${REMOTE}/image/${id}?thumbnail=false&type=cardFace`,
    );
    if (!buf) {
      // 拉不到就复制缩略图，保证请求 full 时不会 404
      fs.copyFileSync(path.join(dir, "thumb.webp"), file);
      failed++;
      continue;
    }
    fs.writeFileSync(file, buf);
    bytes += buf.length;
    done++;
    if (done % 50 === 0) {
      console.log(`进度 ${done}，累计 ${(bytes / 1048576).toFixed(1)} MB`);
    }
  }
};

await Promise.all(Array.from({ length: 10 }, worker));
console.log(
  `完成：下载 ${done}，失败回退 ${failed}，已存在 ${skipped}，共 ${(bytes / 1048576).toFixed(1)} MB`,
);
