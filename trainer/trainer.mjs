// 七圣召唤 AI 训练器（PC 版 · 多进程并行）
// 自我迭代：每批打完把经验合并（"吃掉"）→ 下一批用更强的经验继续
// 用法：node trainer.mjs [--batch 100] [--total 0] [--workers 12] [--search true] ...
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CURRENT_VERSION } from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import {
  EXPERIENCE_SEED,
  DECK_LIBRARY,
  createAi,
  createLearning,
  deckKeyOf,
  mergeLearning,
  runEvolution,
  styleOfDeck,
  summarizeLearning,
  summarizeDecks,
} from "@gi-tcg/ai";
import { Game } from "@gi-tcg/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const LEARNING_FILE = path.join(here, "learning.json");

// ---------- 配置读取：命令行 > config.json > 默认 ----------
const argv = process.argv.slice(2);
const argOf = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};
let fileConfig = {};
try {
  fileConfig = JSON.parse(fs.readFileSync(path.join(here, "config.json"), "utf8"));
} catch {
  fileConfig = {};
}
const config = {
  batch: Number(argOf("batch") ?? fileConfig.batch ?? 100),
  total: Number(argOf("total") ?? fileConfig.total ?? 0),
  mode: argOf("mode") ?? fileConfig.mode ?? "learned",
  information: argOf("info") ?? fileConfig.information ?? "fair",
  useSearch: (argOf("search") ?? String(fileConfig.useSearch ?? "true")) === "true",
  searchBudgetMs: Number(argOf("budget") ?? fileConfig.searchBudgetMs ?? 300),
  seed: Number(argOf("seed") ?? fileConfig.seed ?? 20260101),
  seedFile: argOf("seed-file") ?? fileConfig.seedFile ?? "",
  workers: Number(
    argOf("workers") ?? fileConfig.workers ?? Math.max(2, Math.min(12, os.cpus().length)),
  ),
};
if (!Number.isFinite(config.batch) || config.batch < 1) config.batch = 100;
if (!Number.isFinite(config.total) || config.total < 0) config.total = 0;
if (!Number.isFinite(config.searchBudgetMs) || config.searchBudgetMs < 0) config.searchBudgetMs = 300;
if (!Number.isFinite(config.workers) || config.workers < 1) config.workers = 4;

// ---------- 交互确认（无命令行参数时） ----------
async function ask(question, def) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, (value) => resolve(value)));
  rl.close();
  const value = answer.trim();
  return value === "" ? String(def) : value;
}
if (argv.length === 0) {
  console.log("");
  console.log("当前配置（直接回车保持默认，输入新值修改）：");
  console.log("────────────────────────────────────────");
  const pick = (value, map, defIndex) => {
    if (value === "1" || value === "2" || value === "3") return map[Number(value) - 1];
    return map[defIndex];
  };
  config.batch = Number(await ask(`1) 每批局数 [${config.batch}]：`, config.batch));
  config.total = Number(await ask(`2) 总批数（0=无限）[${config.total}]：`, config.total));
  const searchIn = config.useSearch ? "1" : "2";
  const searchPick = await ask(`3) 单步搜索？1开 2关 [${searchIn}]：`, searchIn);
  config.useSearch = searchPick === "1";
  if (config.useSearch) {
    config.searchBudgetMs = Number(await ask(`4) 搜索预算毫秒（越大越强越慢）[${config.searchBudgetMs}]：`, config.searchBudgetMs));
  }
  const infoPick = await ask(`5) 信息模式 1真实 2明牌 [${config.information === "fair" ? "1" : "2"}]：`, config.information === "fair" ? "1" : "2");
  config.information = pick(infoPick, ["fair", "perfect"], 0);
  const modePick = await ask(`6) 组牌模式 1经验 2随机 3都要 [${config.mode === "learned" ? "1" : config.mode === "random" ? "2" : "3"}]：`, config.mode === "learned" ? "1" : config.mode === "random" ? "2" : "3");
  config.mode = pick(modePick, ["learned", "random", "both"], 0);
  config.seed = Number(await ask(`7) 随机种子 [${config.seed}]：`, config.seed));
  config.workers = Number(await ask(`8) 并行进程数（吃满 CPU=逻辑核数）[${config.workers}]：`, config.workers));
  const poolPick = await ask(`9) 训练对象 1自组进化 2牌组库胜率 3都要 [${config.deckPool === "ai" ? "1" : config.deckPool === "library" ? "2" : "3"}]：`, config.deckPool === "ai" ? "1" : config.deckPool === "library" ? "2" : "3");
  config.deckPool = pick(poolPick, ["ai", "library", "both"], 2);
  console.log("────────────────────────────────────────");
  const go = await ask("确认开始训练？(回车开始 / n 退出)：", "y");
  if (go === "n" || go === "N") {
    console.log("已取消。");
    process.exit(0);
  }
  if (!Number.isFinite(config.batch) || config.batch < 1) config.batch = 100;
  if (!Number.isFinite(config.total) || config.total < 0) config.total = 0;
  if (!Number.isFinite(config.searchBudgetMs) || config.searchBudgetMs < 0) config.searchBudgetMs = 300;
  if (!Number.isFinite(config.workers) || config.workers < 1) config.workers = 4;
}

// ---------- 经验装载：手机备份 > 本地 learning.json > 内置种子 ----------
function loadLearning() {
  if (config.seedFile && fs.existsSync(config.seedFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(config.seedFile, "utf8"));
      if (parsed?.learning) {
        log(`已装载手机备份：${parsed.learning.games ?? 0} 局经验（${path.basename(config.seedFile)}）`);
        return parsed.learning;
      }
    } catch (error) {
      console.error("seed-file 解析失败，改用默认经验：", error);
    }
  }
  if (fs.existsSync(LEARNING_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(LEARNING_FILE, "utf8"));
      log(`继续上次训练：${saved.games ?? 0} 局经验已就位`);
      return saved;
    } catch {
      log("learning.json 损坏，回退到内置种子");
    }
  }
  log(`内置种子：${EXPERIENCE_SEED.games} 局经验（与手机 App 同源）`);
  return structuredClone(EXPERIENCE_SEED);
}
function saveLearning(learning) {
  fs.writeFileSync(LEARNING_FILE, JSON.stringify(learning, null, 1));
  try {
    const back = JSON.parse(fs.readFileSync(LEARNING_FILE, "utf8"));
    log(`   磁盘已确认：${back.games ?? 0} 局经验落盘`);
  } catch (error) {
    log(`   ⚠ 落盘校验失败：${error?.message ?? error}`);
  }
}

// ---------- 分片模式（内部）：--shard i N，打完写分片退出 ----------
const shardPos = argv.indexOf("--shard");
if (shardPos >= 0) {
  const shardIndex = Number(argv[shardPos + 1] ?? 0);
  const shardTotal = Number(argv[shardPos + 2] ?? 1);
  const shardBatch = Number(argOf("shard-batch") ?? config.batch);
  const shardSeedBase = Number(argOf("shard-seed") ?? config.seed);
  const data = getData(CURRENT_VERSION);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  // 分片进程从空经验开打：只产本片新增战绩，父进程负责合并到总经验
  const learning = createLearning();
  const doLibrary = config.deckPool === "library" || config.deckPool === "both";
  const doAi = config.deckPool === "ai" || config.deckPool === "both";
  const libGames = config.deckPool === "both" ? Math.floor(shardBatch / 2) : shardBatch;
  const aiGames = config.deckPool === "both" ? shardBatch - libGames : shardBatch;
  if (doLibrary) {
    // 牌组库胜率模式：不自己组牌，只打牌组库里已有的牌，统计各套胜率
    let source = DECK_LIBRARY.map((deck) => ({
      characters: deck.characters,
      cards: deck.cards,
      key: deckKeyOf(deck),
    }));
    const fullLibFile = path.join(here, "data", "deck-library.json");
    try {
      const parsed = JSON.parse(fs.readFileSync(fullLibFile, "utf8"));
      const list = Array.isArray(parsed?.decks) ? parsed.decks : [];
      const full = list
        .filter((deck) => Array.isArray(deck?.chars) && Array.isArray(deck?.cards) && deck.chars.length === 3 && deck.cards.length === 30)
        .map((deck) => ({
          characters: deck.chars,
          cards: deck.cards,
          key: deckKeyOf({ characters: deck.chars, cards: deck.cards }),
        }));
      if (full.length > source.length) {
        source = full;
        console.log(`[分片 ${shardIndex}] 牌组库全量 ${full.length} 套`);
      }
    } catch {
      // 读不到就用内置
    }
    const catalog = source;
    const total = catalog.length;
    const bump = (bucket, key, win, draw) => {
      const entry = bucket[key] ?? { games: 0, wins: 0, draws: 0 };
      entry.games += 1;
      if (win) entry.wins += 1;
      if (draw) entry.draws += 1;
      bucket[key] = entry;
    };
    for (let local = 0; local < libGames; local++) {
      const i = shardIndex + local * shardTotal;
      try {
        fs.writeFileSync(path.join(here, `learning-shard-${shardIndex}.progress`), String(local + 1));
      } catch {
        // 忽略
      }
      const a = catalog[i % total];
      const bIndex = (i * 31 + 17) % total;
      const b = catalog[bIndex === i % total ? (i + 1) % total : bIndex];
      const game = new Game(
        Game.createInitialState({
          decks: [
            { characters: a.characters, cards: a.cards },
            { characters: b.characters, cards: b.cards },
          ],
          data,
          versionBehavior: CURRENT_VERSION,
          randomSeed: 500000 + i * 7,
        }),
      );
      const seed = 500000 + i * 7;
      game.players[0].io = createAi({ who: 0, seed, delayMs: 0, style: styleOfDeck(a), data });
      game.players[1].io = createAi({ who: 1, seed: seed + 1, delayMs: 0, style: styleOfDeck(b), data });
      let winner = null;
      try {
        winner = await game.start();
      } catch {
        continue;
      }
      bump(learning.decks, a.key, winner === 0, winner === null);
      bump(learning.decks, b.key, winner === 1, winner === null);
      for (const id of a.characters) bump(learning.characters, String(id), winner === 0, winner === null);
      for (const id of b.characters) bump(learning.characters, String(id), winner === 1, winner === null);
      for (const id of new Set(a.cards)) bump(learning.cards, String(id), winner === 0, winner === null);
      for (const id of new Set(b.cards)) bump(learning.cards, String(id), winner === 1, winner === null);
      learning.games += 1;
    }
    if (config.deckPool === "library") {
      fs.writeFileSync(path.join(here, `learning-shard-${shardIndex}.json`), JSON.stringify(learning));
      process.exit(0);
    }
  }
  let evolved = learning;
  const modes = config.mode === "both" ? ["learned", "random"] : [config.mode];
  for (const mode of modes) {
    const gamesForMode =
      modes.length === 2 ? (mode === "learned" ? Math.ceil(aiGames / 2) : aiGames - Math.ceil(aiGames / 2)) : aiGames;
    evolved = await runEvolution({
      data,
      deckData,
      learning: evolved,
      games: gamesForMode,
      mode,
      information: config.information,
      useSearch: config.useSearch,
      searchBudgetMs: config.searchBudgetMs,
      seed: shardSeedBase + shardIndex * 7919 + (mode === "random" ? 99991 : 0),
      onProgress: (progress) => {
        try {
          fs.writeFileSync(
            path.join(here, `learning-shard-${shardIndex}.progress`),
            String(libGames + progress.done),
          );
        } catch {
          // 忽略
        }
      },
    });
  }
  fs.writeFileSync(path.join(here, `learning-shard-${shardIndex}.json`), JSON.stringify(evolved));
  process.exit(0);
}

// ---------- 优雅停止：S 键 ----------
let stopRequested = false;
if (process.stdin.isTTY) {
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.on("data", (chunk) => {
    if (String(chunk).toLowerCase().includes("s")) {
      stopRequested = true;
      console.log("");
      console.log("[提示] 已请求停止：本批各进程打完即合并保存退出…");
    }
  });
}

// ---------- 输出 ----------
const stamp = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });
function log(text) {
  console.log(`[${stamp()}] ${text}`);
}
function topDecks(learning, n = 5) {
  return Object.entries(learning.decks ?? {})
    .filter(([, deck]) => (deck.games ?? 0) >= 5)
    .sort((a, b) => (b[1].wins ?? 0) / Math.max(1, b[1].games) - (a[1].wins ?? 0) / Math.max(1, a[1].games))
    .slice(0, n)
    .map(([, deck]) => `${(((deck.wins ?? 0) / Math.max(1, deck.games)) * 100).toFixed(1)}%(${deck.games}局)`);
}
function exportBundle(learning) {
  const bundle = {
    kind: "gi-tcg-ai-experience-bundle",
    version: 2,
    exportedAt: new Date().toISOString(),
    learning,
    memory: null,
    games: [],
    aiSettings: {},
  };
  const name = `gitcg-trained-ai-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
  const file = path.join(here, name);
  fs.writeFileSync(file, JSON.stringify(bundle, null, 1));
  log(`已导出手机可导入的备份：${file}（手机「设置 → 导入 AI 数据」选它即可）`);
  return file;
}

// ---------- 主循环：并行跑一批 → 吃掉经验 → 下一批 ----------
console.log("═".repeat(56));
console.log("  七圣召唤 AI 训练器 · 自我迭代（多进程并行）");
console.log(`  版本 ${CURRENT_VERSION} | 每批 ${config.batch} 局 | ${config.total === 0 ? "无限批" : `共 ${config.total} 批`} | ${config.workers} 个并行进程`);
console.log(`  模式 ${config.mode} | ${config.information === "fair" ? "真实信息" : "明牌全知"} | 搜索 ${config.useSearch ? `开(${config.searchBudgetMs}ms)` : "关"}`);
console.log("  训练中按 S 键可随时停止（本批结束保存，Ctrl+C 为强停）");
console.log("═".repeat(56));

let learning = loadLearning();
let batchIndex = 0;
let totalDone = 0;
const startedAll = Date.now();

function runShardWorkers(batchSeedBase, perShard) {
  // 以「分片文件出现」为准，而不是依赖子进程事件（Windows 上事件偶发不可靠）
  const shardFileOf = (i) => path.join(here, `learning-shard-${i}.json`);
  for (let i = 0; i < config.workers; i++) {
    try {
      fs.rmSync(shardFileOf(i), { force: true });
    } catch {
      // 忽略
    }
  }
  return new Promise((resolve) => {
    const started = Date.now();
    let lastCount = 0;
    let errorShown = 0;
    for (let i = 0; i < config.workers; i++) {
      const args = [
        path.join(here, "trainer.mjs"),
        "--shard", String(i), String(config.workers),
        "--shard-batch", String(perShard),
        "--shard-seed", String(batchSeedBase),
        "--batch", String(config.batch),
        "--mode", config.mode,
        "--info", config.information,
        "--search", config.useSearch ? "true" : "false",
        "--budget", String(config.searchBudgetMs),
        "--deckpool", config.deckPool,
      ];
      if (config.seedFile) args.push("--seed-file", config.seedFile);
      const child = spawn(process.execPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FORCE_COLOR: "0" },
        windowsHide: true,
      });
      let stderrText = "";
      child.stderr.on("data", (chunk) => {
        stderrText += String(chunk);
      });
      child.on("error", (error) => {
        console.log(`  分片 ${i} 启动失败：${error.message}`);
      });
      child.on("close", (code) => {
        if (code !== 0 && stderrText.trim() && errorShown < 3) {
          errorShown += 1;
          console.log(`  分片 ${i} 报错：${stderrText.trim().split("\n").slice(-3).join(" | ")}`);
        }
      });
    }
    const poll = setInterval(() => {
      const count = Array.from({ length: config.workers }, (_, i) =>
        fs.existsSync(shardFileOf(i)) ? 1 : 0,
      ).reduce((a, b) => a + b, 0);
      let gamesDone = 0;
      for (let i = 0; i < config.workers; i++) {
        const marker = path.join(here, `learning-shard-${i}.progress`);
        try {
          gamesDone += Number(fs.readFileSync(marker, "utf8").trim() || 0);
        } catch {
          // 还没写过进度标记
        }
      }
      const totalTarget = config.total === 0 ? "∞" : String(config.total * config.batch);
      const totalNum = config.total === 0 ? Infinity : config.total * config.batch;
      const cumulative = Math.min(totalDone + gamesDone, totalNum);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      if (count >= config.workers) {
        console.log(`  分片全部完成（${elapsed}s）`);
        clearInterval(poll);
        resolve();
        return;
      }
      if (gamesDone > 0) {
        process.stdout.write(`\r  本批 ${Math.min(gamesDone, config.batch)}/${config.batch} 局 · 累计 ${cumulative}/${totalTarget}（${elapsed}s）   `);
      } else {
        process.stdout.write(`\r  训练中… 各进程正在打（${elapsed}s）   `);
      }
    }, 1000);
  });
}

while (config.total === 0 || batchIndex < config.total) {
  batchIndex += 1;
  const startedBatch = Date.now();
  log(`第 ${batchIndex} 批开始：经验 ${learning.games ?? 0} 局 → 并行 ${config.workers} 进程打 ${config.batch} 局`);
  log(`  （每个进程约 ${Math.ceil(config.batch / config.workers)} 局，正在跑…）`);
  const perShard = Math.ceil(config.batch / config.workers);
  const batchSeedBase = config.seed + batchIndex * 100003;
  await runShardWorkers(batchSeedBase, perShard);

  // 合并各分片经验（"吃掉"）
  let merged = learning;
  let played = 0;
  for (let i = 0; i < config.workers; i++) {
    const shardFile = path.join(here, `learning-shard-${i}.json`);
    try {
      const shard = JSON.parse(fs.readFileSync(shardFile, "utf8"));
      played += shard.games ?? 0;
      merged = mergeLearning(merged, shard);
      fs.rmSync(shardFile, { force: true });
      try {
        fs.rmSync(path.join(here, `learning-shard-${i}.progress`), { force: true });
      } catch {
        // 忽略
      }
    } catch {
      // 分片缺失就跳过
    }
  }
  learning = merged;
  saveLearning(learning);
  totalDone += played;
  const elapsed = ((Date.now() - startedBatch) / 1000).toFixed(1);
  log(`✅ 第 ${batchIndex} 批完成（${elapsed}s）：吃掉 ${played} 局经验 → 累计 ${learning.games ?? 0} 局`);
  log(`   牌组知识 ${Object.keys(learning.decks ?? {}).length} 套 | 卡牌 ${Object.keys(learning.cards ?? {}).length} 张 | 角色 ${Object.keys(learning.characters ?? {}).length} 名`);
  const tops = topDecks(learning);
  if (tops.length > 0) {
    log(`   最高胜率牌组：${tops.join(" · ")}`);
  }
  if (stopRequested) {
    log("已停止：当前经验已保存。");
    break;
  }
  if (config.total !== 0 && batchIndex >= config.total) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

const totalSec = ((Date.now() - startedAll) / 1000).toFixed(0);
console.log("─".repeat(56));
console.log(summarizeLearning(learning));
console.log(summarizeDecks(learning));
console.log("─".repeat(56));
log(`训练结束：共 ${totalDone} 局，用时 ${totalSec}s，经验已存 learning.json`);
exportBundle(learning);
console.log("");
console.log("手机回灌：把导出的 gitcg-trained-ai-*.json 传到手机 → 工具首页「设置 → 导入 AI 数据」。");
console.log("下次继续：直接再跑本脚本（会从 learning.json 接着练）。");
