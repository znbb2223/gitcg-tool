// 监管进程：发现子进程卡死（日志 90 秒没更新）就杀掉重启，靠断点续跑接着来
import { spawn } from "node:child_process";
import fs from "node:fs";

const batch = Number(process.argv[2] ?? 0);
const log = `/tmp/batch-${batch}.log`;
const done = `/root/workspace/gi-tcg/packages/ai/docs/learning-batch-${batch}.done`;
let restarts = 0;

const run = () =>
  new Promise((resolve) => {
    const child = spawn("node", ["scripts/batch-tournament.mjs", String(batch), "400", "2"], {
      cwd: "/root/workspace/gi-tcg/packages/ai",
      stdio: ["ignore", fs.openSync(log, "a"), fs.openSync(log, "a")],
    });
    let lastSize = 0;
    const timer = setInterval(() => {
      if (fs.existsSync(done)) {
        clearInterval(timer);
        child.kill("SIGKILL");
        resolve(true);
        return;
      }
      const size = fs.existsSync(log) ? fs.statSync(log).size : 0;
      if (size === lastSize) {
        clearInterval(timer);
        child.kill("SIGKILL");
        // 标记"上一套卡死"，让续跑跳过它
        const progressPath = `/root/workspace/gi-tcg/packages/ai/docs/progress-batch-${batch}.json`;
        try {
          const saved = JSON.parse(fs.readFileSync(progressPath, "utf8"));
          saved.attempts = (saved.attempts ?? 0) + 1;
          fs.writeFileSync(progressPath, JSON.stringify(saved));
        } catch {}
        resolve(false);
      }
      lastSize = size;
    }, 90_000);
    child.on("exit", () => {
      clearInterval(timer);
      resolve(fs.existsSync(done));
    });
  });

const main = async () => {
  while (!fs.existsSync(done)) {
    const finished = await run();
    if (finished) break;
    restarts += 1;
    console.log(`batch ${batch}: 检测到卡死，第 ${restarts} 次重启`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`batch ${batch}: 结束`);
};
await main();
