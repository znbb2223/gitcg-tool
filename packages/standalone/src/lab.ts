import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { encodeShareImage, shareImageExt } from "./share-image";
import { validateDeckRules } from "./deck-rules";
import {
  EXPERIENCE_SEED,
  cardWeights,
  characterWeights,
  recordGame,
  mergeLearningDedup,
} from "@gi-tcg/ai";
import {
  saveTextFile,
  saveImageFile,
  writeCacheLog,
  listCacheLogs,
  readCacheLog,
  deleteCacheLog,
  clearCacheLogs,
  exportCacheLog,
} from "./native";
import type { Deck } from "@gi-tcg/core";
import LAB_META_JSON from "./lab-meta.json";
import { loadAiSettings } from "./ai-settings-store";

interface LabMeta {
  characters: Record<string, { n: string; e: string[] }>;
  cards: Record<string, { n: string; t: string; f: string[] }>;
}
const LAB_META = LAB_META_JSON as LabMeta;

const EXP_KEY = "gi-tcg-ai-learning-v1";
const SEED_LEARNING = structuredClone(EXPERIENCE_SEED);

function loadLabLearning() {
  try {
    const raw = localStorage.getItem(EXP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.kind === "gi-tcg-ai-learning") {
        return parsed.games >= SEED_LEARNING.games ? parsed : structuredClone(SEED_LEARNING);
      }
    }
  } catch {
    // ignore
  }
  return structuredClone(SEED_LEARNING);
}

let learning = loadLabLearning();
let cardWeightMap = cardWeights(learning);
let charWeightMap = characterWeights(learning);
let gamesSinceSave = 0;

function saveLabLearning() {
  try {
    localStorage.setItem(EXP_KEY, JSON.stringify(learning));
    gamesSinceSave = 0;
    updateExpStat();
  } catch {
    // ignore
  }
}

const expStat = document.getElementById("expStat") as HTMLDivElement;
const expStat2 = document.getElementById("expStat2") as HTMLDivElement;
function updateExpStat() {
  const text = `对局日志：${learning.games} 局 · ${Object.keys(learning.cards).length} 张牌 · 版本 ${learning.gameVersion ?? "7.2.0"}`;
  expStat.textContent = text;
  expStat2.textContent = text;
}
updateExpStat();

type Style = "aggro" | "midrange" | "control";
const STYLES: Record<Style, string> = { aggro: "快攻", midrange: "中速", control: "控制" };
const ELEMENTS: Record<string, string> = {
  PYRO: "火",
  HYDRO: "水",
  ANEMO: "风",
  ELECTRO: "雷",
  DENDRO: "草",
  CRYO: "冰",
  GEO: "岩",
};
const DAMAGE_LABELS: Record<string, string> = {
  direct: "直伤",
  summon: "召唤物",
  heal: "治疗护盾",
  react: "元素反应",
  pierce: "穿透",
};

function elementsOf(deck: Deck) {
  const elements = new Set<string>();
  for (const id of deck.characters) {
    for (const element of LAB_META.characters[id]?.e ?? []) {
      elements.add(element);
    }
  }
  return [...elements];
}

function characterNames(deck: Deck) {
  return deck.characters.map((id) => LAB_META.characters[id]?.n ?? String(id));
}

function damageOf(deck: Deck) {
  const flags = deck.cards.flatMap((id) => LAB_META.cards[id]?.f ?? []);
  const count = (flag: string) => flags.filter((item) => item === flag).length;
  if (count("summon") >= 2) {
    return "summon";
  }
  if (count("heal") + count("shield") > 0) {
    return "heal";
  }
  if (count("pierce") > 0) {
    return "pierce";
  }
  return new Set(elementsOf(deck)).size >= 2 ? "react" : "direct";
}

const deckInput = document.getElementById("deckCode") as HTMLTextAreaElement;
const durationSelect = document.getElementById("duration") as HTMLSelectElement;
const styleSelect = document.getElementById("style") as HTMLSelectElement;
const styleHint = document.getElementById("styleHint") as HTMLDivElement;
const startButton = document.getElementById("start") as HTMLButtonElement;
const logEl = document.getElementById("log") as HTMLDivElement;
const resultsEl = document.getElementById("results") as HTMLDivElement;
const cpuEl = document.getElementById("cpu") as HTMLDivElement;
const opLogEl = document.getElementById("opLog") as HTMLDivElement;
const filteredResults = document.getElementById("filteredResults") as HTMLDivElement;
const shareInfo = document.getElementById("shareInfo") as HTMLDivElement;
const toastEl = document.getElementById("toast") as HTMLDivElement;
let toastTimer = 0;
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2600);
}

const cpuCount = navigator.hardwareConcurrency || 4;
cpuEl.textContent = `检测到 ${cpuCount} 个 CPU 核心；搜索会用 ${Math.max(1, cpuCount - 1)} 个线程跑满（界面可能变卡，属正常）。`;

let running = false;
let lastTarget: Deck | null = null;
type ResultItem = {
  rate: number;
  code: string;
  games: number;
  chars: number[];
  charKey: string;
  elements: string[];
  damage: string;
};
const lists: Record<string, ResultItem[]> = { aggro: [], midrange: [], control: [], any: [] };
const styleOrder: string[] = [];

const opLines: string[] = [];
function log(text: string) {
  const line = `${new Date().toLocaleTimeString()}  ${text}`;
  logEl.textContent = `${line}\n` + logEl.textContent.slice(0, 4000);
}

/** 对局日志 / 缓存日志操作：同时写进第二页的操作日志区 */
function logOp(text: string) {
  log(text);
  const line = `${new Date().toLocaleTimeString()}  ${text}`;
  opLines.unshift(line);
  opLogEl.textContent = opLines.slice(0, 120).join("\n");
}

interface DeckIndexEntry {
  id: string;
  t: string;
  tags: string[];
  at: string[];
  role: string;
  tier: string;
  style: string;
  w: number;
  g: number;
  a: string;
  c?: number[];
  k?: number[];
}

let deckIndex: Record<string, DeckIndexEntry> | null = null;
const loadDeckIndex = async () => {
  if (deckIndex) {
    return deckIndex;
  }
  try {
    deckIndex = (await (await fetch("/data/deck-index.json")).json()) as Record<string, DeckIndexEntry>;
  } catch {
    deckIndex = {};
  }
  return deckIndex;
};
void loadDeckIndex().then(() => {
  for (const [code, entry] of Object.entries(deckIndex ?? {})) {
    if (entry.c && entry.k) {
      libraryByFp.set(deckFingerprint(entry.c, entry.k), { ...entry, id: entry.id || code });
    }
  }
  loadUserDecksIntoIndex();
  // 索引到了以后重画一次，结果卡才能显示牌组库标题
  if (document.querySelector(".r-title")) {
    render();
  }
});

const deckFingerprint = (chars: number[], cards: number[]) =>
  `${[...chars].sort((a, b) => a - b).join(",")}|${[...cards].sort((a, b) => a - b).join(",")}`;

/** 牌组库指纹 → 条目（社区库 + 本地自添加/实验室新发现） */
const libraryByFp = new Map<string, DeckIndexEntry>();

const USER_DECKS_KEY = "gi-tcg-user-decks-v1";
const loadUserDecksIntoIndex = () => {
  try {
    const list = JSON.parse(localStorage.getItem(USER_DECKS_KEY) ?? "[]") as Array<{
      chars: number[];
      cards: number[];
      title?: string;
      source?: string;
      tags?: string[];
      authorTags?: string[];
      role?: string;
      winRate?: number;
      games?: number;
      author?: { nickname?: string } | null;
      id?: string;
    }>;
    for (const deck of list) {
      if (!deck?.chars || !deck?.cards) {
        continue;
      }
      const fp = deckFingerprint(deck.chars, deck.cards);
      if (libraryByFp.has(fp)) {
        // 社区牌组优先：同指纹的本地条目（含误写的实验室新发现）不再覆盖展示
        continue;
      }
      libraryByFp.set(fp, {
        id: deck.id ?? "",
        t: (deck.title ?? "实验室新发现").slice(0, 40),
        tags: deck.tags ?? [],
        at: deck.authorTags ?? [],
        role: deck.role ?? "",
        tier: "?",
        style: "midrange",
        w: deck.winRate ?? 0.5,
        g: deck.games ?? 0,
        a: deck.author?.nickname ? `@${deck.author.nickname}` : "",
        c: deck.chars,
        k: deck.cards,
      });
    }
  } catch {
    // 读不到当没有
  }
};

type Filters = { style: string; element: string; damage: string; character: string };
const filters: Filters = { style: "all", element: "all", damage: "all", character: "all" };

function render() {
  resultsEl.innerHTML = "";
  if (currentTab) {
    saveLabState();
  }
  for (const style of ["all"]) {
    const items = [...(lists.all ?? [])].sort((a, b) => {
      if (resultSort === "rate") {
        return b.rate - a.rate;
      }
      if (resultSort === "games") {
        return b.games - a.games;
      }
      if (resultSort === "lib") {
        const wa = deckIndex?.[a.code]?.w ?? 0;
        const wb = deckIndex?.[b.code]?.w ?? 0;
        return wb - wa;
      }
      return 0;
    });
    const groupTitle = "全部候选";
    const header = document.createElement("div");
    header.className = "stat group-header";
    header.dataset.group = style;
    header.style.cssText = "margin:14px 0 2px;font-weight:600;color:#d9b877";
    header.textContent = `${groupTitle} · ${items.length} 套`;
    resultsEl.appendChild(header);
    if (!items.length) {
      const anyOther = styleOrder.some((other) => (lists[other] ?? []).length > 0);
      if (!anyOther) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "搜索中，尚无结果…";
        resultsEl.appendChild(empty);
      } else {
        header.style.display = "none";
      }
      continue;
    }
    for (const [index, item] of items.entries()) {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.style = style;
      card.dataset.elements = item.elements.join(" ");
      card.dataset.damage = item.damage;
      card.dataset.chars = item.chars.join(" ");
      const knownMeta = deckIndex?.[item.code];
      const archetype =
        knownMeta?.role ?? knownMeta?.tags?.[0] ?? (item.style ? "实验室候选" : "候选");
      const chips = [
        `<span class="chip">${archetype}</span>`,
        ...item.elements.map((element) => `<span class="tag">${ELEMENTS[element] ?? element}</span>`),
        `<span class="tag">${DAMAGE_LABELS[item.damage] ?? item.damage}</span>`,
      ].join("");
      const names = item.chars.map((id) => LAB_META.characters[id]?.n ?? String(id)).join(" / ");
      card.dataset.search = `${item.code} ${names} ${chips} ${groupTitle}`.toLowerCase();
      const avatars = item.chars
        .map(
          (id) =>
            `<span class="r-av"><img src="/assets-local/api/v5/image/${id}/icon/thumb.webp" alt="" loading="lazy" /><i>${LAB_META.characters[id]?.n ?? id}</i></span>`,
        )
        .join("");
      const ratePct = Math.round(item.rate * 100);
      // 实验室新发现不再入库：只作为本次搜索的临时牌组展示，
      // 点开仍跳牌组库（牌组库侧按临时牌组渲染详情）
      let known = deckIndex?.[item.code];
      if (!known) {
        const fp = deckFingerprint(item.chars, (item as { cards?: number[] }).cards ?? []);
        known = libraryByFp.get(fp);
        if (!known && deckIndex !== null && (item as { cards?: number[] }).cards?.length === 30) {
          const cards = (item as { cards: number[] }).cards;
          const entry: DeckIndexEntry = {
            id: "",
            t: "实验室新发现",
            tags: ["实验室新发现"],
            at: [],
            role: groupTitle,
            tier: "?",
            style,
            w: item.rate,
            g: item.games,
            a: "",
            c: [...item.chars],
            k: [...cards],
          };
          try {
            libraryByFp.set(fp, entry);
            known = entry;
          } catch {
            // 忽略
          }
        }
      }
      const titleLine = known
        ? `<div class="r-title">${escapeHtml(known.t)}</div>`
        : `<div class="r-title r-new">实验室新发现</div>`;
      const metaLine = known
        ? `<div class="r-meta">${escapeHtml(known.role || "")}${
            known.a ? ` · ${escapeHtml(known.a)}` : ""
          } · 牌组库 ${Math.round(known.w * 100)}%（${known.g} 局）</div>`
        : `<div class="r-meta">牌组库里还没有这套，点卡片复制牌组码</div>`;
      const libTagNames = known
        ? [...new Set([known.role, ...(known.at ?? []), ...(known.tags ?? [])].filter(Boolean))]
        : [];
      const libTags = libTagNames
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
      card.innerHTML = `
        <div class="r-avatars">${avatars}</div>
        ${titleLine}
        <div class="r-head">
          <span class="r-rank">#${index + 1}</span>
          <span class="r-rate ${item.rate >= 0.55 ? "good" : item.rate < 0.45 ? "bad" : ""}">${ratePct}%</span>
          <span class="r-games">${item.games} 局击败率</span>
        </div>
        <div class="r-bar"><i style="width:${Math.max(3, Math.min(100, ratePct))}%"></i></div>
        ${metaLine}
        <div style="margin-top:6px">${chips}${libTags}</div>
        <div class="deck">${item.code}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="copy-code" data-code="${item.code}" style="flex:0 0 auto;width:72px;margin:0;padding:8px;font-size:12px;background:#3a4653;color:#dfe6ee">复制</button>
          <button class="gen-image" data-code="${item.code}" style="flex:1;margin:0;padding:8px;font-size:13px;background:#7fb286;color:#12200f">生成牌组图</button>
          <button class="open-detail" data-code="${item.code}" style="flex:0 0 auto;width:88px;margin:0;padding:8px;font-size:12px;background:#a8976f;color:#221c10">对局详情</button>
        </div>`;
      card.dataset.code = item.code;
      // 跨页传参：社区牌组用条目 id（码对顺序敏感）；临时牌组带 chars/cards
      card.dataset.href = known && known.id
        ? `/deck-library.html?id=${encodeURIComponent(known.id)}`
        : `/deck-library.html?code=${encodeURIComponent(item.code)}&chars=${item.chars.join(",")}&cards=${(item.cards ?? []).join(",")}`;
      if (known) {
        card.style.cursor = "pointer";
      }
      resultsEl.appendChild(card);
    }
  }
  applyFilter();
}

// 结果卡点击：能对上牌组库的直接进详情，对不上的复制牌组码
filteredResults.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("button")) {
    return;
  }
  const card = target.closest(".card[data-code]") as HTMLElement | null;
  if (!card) {
    return;
  }
  const href = card.dataset.href;
  if (href) {
    window.location.assign(href);
    return;
  }
  navigator.clipboard?.writeText(card.dataset.code ?? "").catch(() => undefined);
  toast("牌组库里还没有这套，牌组码已复制");
});

function rngFactory(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const gamesPerDeckEl = document.getElementById("gamesPerDeck") as HTMLSelectElement | null;
const readGamesSetting = () => {
  const value = Number(gamesPerDeckEl?.value ?? 6);
  return Number.isFinite(value) ? Math.max(2, Math.min(30, value)) : 6;
};

async function search(style: string, target: Deck, deadline: number) {
  const { default: getData } = await import("@gi-tcg/data");
  const { CURRENT_VERSION } = await import("@gi-tcg/core");
  const ai = await import("@gi-tcg/ai");
  const data = getData(CURRENT_VERSION as never);
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const rng = rngFactory((Math.random() * 1e9) >>> 0);
  let games = 0;
  let iterations = 0;
  let localBest: { deck: Deck; rate: number } | null = null;
  const charKeyOf = (deck: Deck) => [...deck.characters].sort((a, b) => a - b).join(",");
  log(`${style === "any" ? "不限风格" : STYLES[style as Style]} 开始搜索`);
  while (running && Date.now() < deadline) {
    const list = (lists[style] ??= []);
    // 同角色组合最多留 2 套，剩下的算力去换别的组合
    const localKey = localBest ? charKeyOf(localBest.deck) : null;
    const localCount = localKey ? list.filter((item) => item.charKey === localKey).length : 0;
    let candidate: Deck;
    if (localBest && localCount < 2 && rng() < 0.55) {
      candidate = ai.mutateDeck(localBest.deck, deckData, rng).deck;
    } else {
      // 每次重新抽角色权重，避免总是同一套热门队伍
      const exploringWeights = new Map<number, number>();
      for (const id of deckData.characters.keys()) {
        exploringWeights.set(id, (charWeightMap.get(id) ?? 1) * (0.35 + rng() * 1.7));
      }
      candidate = ai.buildDeck({
        deckData,
        seed: Math.floor(rng() * 1e9),
        deckStrength: "strong",
        cardWeights: cardWeightMap,
        characterWeights: exploringWeights,
      });
    }
    if (style !== "any" && ai.styleOfDeck(candidate) !== style) {
      continue;
    }
    const charKey = charKeyOf(candidate);
    if (list.filter((item) => item.charKey === charKey).length >= 2) {
      continue;
    }
    let wins = 0;
    for (let k = 0; k < 6 && running; k++) {
      const candidateFirst = k % 2 === 0;
      const decks: [Deck, Deck] = candidateFirst ? [candidate, target] : [target, candidate];
      // 搜索用快速推演（稳定优先）；完整权重只在「对局详情」里走 createAi
      const labSettings = loadAiSettings("lab");
      const result = await Promise.race([
        ai.playFastGame(data, decks, (rng() * 1e9) >>> 0, {
          blunderRate: labSettings.blunderRate,
        }),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 20_000)),
      ]);
      if (!result) {
        log("单局超时，跳过");
        continue;
      }
      games += 1;
      ai.recordGame(learning, decks, result.winner);
      gamesSinceSave += 1;
      if (result.winner === (candidateFirst ? 0 : 1)) {
        wins += 1;
      }
    }
    const rate = wins / 6;
    iterations += 1;
    // 合法性：组牌器那套规则（3 角色 / 30 张 / 每种≤2 / 秘传≤1）+ 引擎级校验（天赋角色、元素共鸣匹配）
    const engineErrors = ai.validateDeck(candidate, deckData).errors;
    const legalityErrors = validateDeckRules(
      { characters: candidate.characters, cards: candidate.cards },
      { extraErrors: engineErrors },
    );
    if (legalityErrors.length > 0) {
      log(`${style} 跳过不合法牌组：${legalityErrors[0]}`);
      continue;
    }
    const code = DEFAULT_ASSETS_MANAGER.encode(candidate);
    if (list.filter((item) => item.charKey === charKey).length < 2) {
      const entry = {
        rate,
        code,
        games,
        chars: candidate.characters,
        cards: candidate.cards,
        charKey,
        elements: elementsOf(candidate),
        damage: damageOf(candidate),
        style,
      };
      list.push(entry);
      list.sort((a, b) => b.rate - a.rate);
      list.length = Math.min(list.length, 12);
      // 统一结果池：不再按「快攻/中速/控制」分组，所有候选按击败率进同一个列表
      const unified = (lists.all ??= []);
      if (!unified.some((item) => item.code === code)) {
        unified.push(entry);
        unified.sort((a, b) => b.rate - a.rate);
        unified.length = Math.min(unified.length, 36);
      }
      render();
      log(`新结果：${(rate * 100).toFixed(1)}%（${games} 局）`);
    }
    if (!localBest || rate > localBest.rate) {
      localBest = { deck: candidate, rate };
    } else if (iterations % 5 === 0) {
      log(`${style === "any" ? "不限风格" : STYLES[style]} 进行中：${(localBest.rate * 100).toFixed(1)}%（${games} 局）`);
    }
    if (gamesSinceSave >= 20) {
      saveLabLearning();
      cardWeightMap = cardWeights(learning);
      charWeightMap = characterWeights(learning);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  saveLabLearning();
  log(`${style === "any" ? "不限风格" : STYLES[style as Style]} 结束（${games} 局）`);
  updateExpStat();
}

resultsEl.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  if (target.classList.contains("copy-code")) {
    const code = target.dataset.code ?? "";
    try {
      await navigator.clipboard.writeText(code);
      toast("牌组码已复制");
      log("牌组码已复制");
    } catch {
      const area = document.createElement("textarea");
      area.value = code;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      toast("牌组码已复制");
      log("牌组码已复制");
    }
    return;
  }
  if (target.classList.contains("open-detail")) {
    const code = target.dataset.code ?? "";
    const button = target as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "生成中…";
    try {
      await showDeckDetail(code);
    } finally {
      button.disabled = false;
      button.textContent = "对局详情";
    }
    return;
  }
  if (target.classList.contains("gen-image")) {
    const code = target.dataset.code ?? "";
    try {
      const deck = DEFAULT_ASSETS_MANAGER.decode(code);
      lastDeck = deck;
      shareReturnTab = "results";
      showTab("share");
      shareInfo.textContent = "正在生成牌组图…";
      await renderShare(deck);
    } catch (error) {
      log(`牌组码解析失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
});

const customSecondsInput = document.getElementById("customSeconds") as HTMLInputElement | null;
durationSelect.addEventListener("change", () => {
  if (!customSecondsInput) {
    return;
  }
  customSecondsInput.style.display = durationSelect.value === "custom" ? "block" : "none";
});

const importExpBtn = document.getElementById("importExp") as HTMLButtonElement | null;
if (importExpBtn) {
  importExpBtn.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = parsed?.learning ?? parsed;
        if (incoming?.kind !== "gi-tcg-ai-learning") {
          logOp("不是对局日志文件");
          return;
        }
        learning = mergeLearningDedup(learning, incoming);
        cardWeightMap = cardWeights(learning);
        charWeightMap = characterWeights(learning);
        saveLabLearning();
        logOp(`已合并经验：${learning.games} 局（去重后）`);
      } catch (error) {
        logOp(`导入失败：${error instanceof Error ? error.message : String(error)}`);
      }
    };
    input.click();
  });
}

const exportExpBtn = document.getElementById("exportExp") as HTMLButtonElement;
exportExpBtn.addEventListener("click", () => {
  saveLabLearning();
  const name = `ai-experience-lab-7.2.0-${new Date().toISOString().slice(0, 10)}.json`;
  saveTextFile(name, JSON.stringify({ exportedAt: new Date().toISOString(), learning }, null, 1), "AI经验库");
  logOp(`对局日志已导出：${name}（${learning.games} 局）`);
});

const shareOnlyBtn = document.getElementById("shareOnly") as HTMLButtonElement;
shareOnlyBtn.addEventListener("click", async () => {
  const code = deckInput.value.trim();
  if (!code) {
    log("请先输入牌组码");
    return;
  }
  try {
    const deck = DEFAULT_ASSETS_MANAGER.decode(code);
    lastDeck = deck;
    shareReturnTab = "search";
    showTab("share");
    shareInfo.textContent = "正在生成牌组图…";
    await renderShare(deck);
  } catch (error) {
    log(`解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
});

let searchWorkers: Worker[] = [];
let finishSearchRun: (() => void) | null = null;

/** 用多个 worker 并行搜索，把手机多核跑满；主线程只负责汇总与渲染 */
async function runWorkerSearch(target: Deck, styles: string[], deadline: number) {
  const cores = Math.max(2, (navigator.hardwareConcurrency ?? 4) - 1);
  // 线程数固定为「核心数 - 1」，风格轮流分配
  const plan: string[] = [];
  for (let i = 0; i < cores; i++) {
    plan.push(styles[i % styles.length]);
  }
  const blunderRate = loadAiSettings("lab").blunderRate;
  log(`启动 ${plan.length} 个搜索线程（检测到 ${navigator.hardwareConcurrency ?? 4} 核）`);

  await new Promise<void>((resolve) => {
    finishSearchRun = resolve;
    let finished = 0;
    const finishOne = () => {
      finished += 1;
      if (finished >= plan.length) {
        resolve();
      }
    };
    searchWorkers = plan.map((style, index) => {
      const worker = new Worker(new URL("./lab-search.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data as {
          type: string;
          chars?: number[];
          cards?: number[];
          rate?: number;
          games?: number;
          charKey?: string;
          style?: string;
        };
        if (msg.type === "candidate" && msg.chars && msg.cards) {
          // 规范牌组码：角色与卡牌按 id 排序后再编码，
          // 与牌组库的规范码一致，才能在库中命中同一副牌
          const sortedChars = [...msg.chars].sort((a, b) => a - b);
          const sortedCards = [...msg.cards].sort((a, b) => a - b);
          const code = DEFAULT_ASSETS_MANAGER.encode({
            characters: sortedChars,
            cards: sortedCards,
          });
          const unified = (lists.all ??= []);
          if (unified.some((item) => item.code === code)) {
            return;
          }
          unified.push({
            rate: msg.rate ?? 0,
            code,
            games: msg.games ?? 0,
            chars: sortedChars,
            cards: sortedCards,
            charKey: msg.charKey ?? "",
            elements: elementsOf({ characters: sortedChars, cards: sortedCards }),
            damage: damageOf({ characters: sortedChars, cards: sortedCards }),
            style: msg.style ?? style,
          });
          unified.sort((a, b) => b.rate - a.rate);
          unified.length = Math.min(unified.length, 36);
          render();
          log(`${STYLES[style as Style] ?? style} 新结果：${((msg.rate ?? 0) * 100).toFixed(1)}%（${msg.games} 局）`);
          return;
        }
        if (msg.type === "done") {
          finishOne();
        }
      };
      worker.onerror = () => finishOne();
      worker.postMessage({
        type: "start",
        target: { characters: target.characters, cards: target.cards },
        style,
        deadline,
        seed: Math.floor(Math.random() * 1e9) + index * 7919,
        blunderRate,
        games: readGamesSetting(),
      });
      return worker;
    });
  });

  searchWorkers.forEach((worker) => worker.terminate());
  searchWorkers = [];
}

let stoppingSearch = false;
startButton.addEventListener("click", async () => {
  if (stoppingSearch) {
    return;
  }
  if (running) {
    running = false;
    stoppingSearch = true;
    startButton.disabled = true;
    startButton.textContent = "正在停止…";
    searchWorkers.forEach((worker) => worker.terminate());
    searchWorkers = [];
    finishSearchRun?.();
    finishSearchRun = null;
    return;
  }
  const code = deckInput.value.trim();
  if (!code) {
    log("请先输入对手牌组码");
    return;
  }
  let target: Deck;
  try {
    target = DEFAULT_ASSETS_MANAGER.decode(code);
  } catch (error) {
    log(`牌组码解析失败：${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  for (const key of Object.keys(lists)) {
    lists[key] = [];
  }
  styleOrder.length = 0;
  render();
  running = true;
  startButton.textContent = "搜索中…（点此停止）";
  let duration = Number(durationSelect.value);
  if (durationSelect.value === "custom") {
    duration = Number((document.getElementById("customSeconds") as HTMLInputElement)?.value || 0);
  }
  const deadline = duration > 0 ? Date.now() + duration * 1000 : Number.POSITIVE_INFINITY;
  lastTarget = target;
  // 旧的「快攻/中速/控制」只是内部生成候选的三种启发式，结果统一成一个池子展示
  const styles = ["aggro", "midrange", "control"];
  styleOrder.length = 0;
  render();
  log(`目标牌组：${target.characters.length} 角色 / ${target.cards.length} 张牌`);
  await runWorkerSearch(target, styles, deadline);
  running = false;
  stoppingSearch = false;
  startButton.disabled = false;
  startButton.textContent = "开始超深搜索";
  log("全部结束");

  // 深度搜索的结果写回牌组库：记下「最能克制这套牌」的牌组，克制率更高才覆盖
  const best = Object.values(lists)
    .flat()
    .filter((item) => item.games >= Math.min(6, readGamesSetting()))
    .sort((a, b) => b.rate - a.rate)[0];
  if (best && code) {
    try {
      const KEY = "gi-tcg-counter-overrides-v1";
      const store = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      const prev = store[code];
      if (!prev || best.rate > (prev.rate ?? 0)) {
        store[code] = {
          counterCode: best.code,
          rate: best.rate,
          games: best.games,
          chars: best.chars,
          updatedAt: Date.now(),
        };
        localStorage.setItem(KEY, JSON.stringify(store));
        log(`已写回牌组库：最克这套的是 ${(best.rate * 100).toFixed(1)}% 的牌组`);
      } else {
        log(`牌组库里已有更高的克制率 ${(prev.rate * 100).toFixed(1)}%，保留原记录`);
      }
    } catch {
      log("写回牌组库失败（存储不可用）");
    }
  }
});

render();

// ---------- 牌组分享图 ----------

const shareBtn = document.getElementById("shareBtn") as HTMLButtonElement;
const sharePreview = document.getElementById("sharePreview") as HTMLDivElement;
let shareReturnTab = "results";
document.getElementById("shareBack")?.addEventListener("click", () => {
  showTab(shareReturnTab);
});

let lastDeck: Deck | null = null;

function imageUrl(id: number): string {
  return DEFAULT_ASSETS_MANAGER.getImageUrlSync(id, {
    type: "cardFace",
    thumbnail: false,
  });
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const S = 2;
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCardImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.save();
  // 先铺一层金色底：卡面自带的圆角透明边不会在边框内侧露出缝隙
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = "#e2c68b";
  ctx.fill();
  ctx.clip();
  if (img) {
    // 略微放大，盖住原图四角的透明区域
    const scale = 1.04;
    const dw = w * scale;
    const dh = h * scale;
    drawCover(ctx, img, x - (dw - w) / 2, y - (dh - h) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#ddd2b8";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = "#c8a86a";
  ctx.lineWidth = 4;
  roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(4, radius - 2));
  ctx.stroke();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const targetRatio = w / h;
  const srcRatio = img.width / img.height;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (srcRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function renderShare(deck: Deck) {
  const M = 60;
  const W = 1080;
  const code = DEFAULT_ASSETS_MANAGER.encode(deck as never);
  const codeLines: string[] = code ? [code] : [];
  const codeFontSize = code
    ? Math.max(14, Math.min(26, Math.floor((W - M * 2) / Math.max(1, code.length * 0.6))))
    : 24;
  // 与组牌器/牌组库完全一致：按文字边缘排布（牌组码底边 245、间距 15/20）
  const measure = document.createElement("canvas").getContext("2d")!;
  const metricsOf = (text: string, font: string) => {
    measure.font = font;
    const m = measure.measureText(text);
    return {
      ascent: m.actualBoundingBoxAscent || 0,
      descent: m.actualBoundingBoxDescent || 0,
    };
  };
  const codeFont = `${codeFontSize}px ui-monospace, Menlo, Consolas, monospace`;
  const versionFont = "30px system-ui, sans-serif";
  const titleFont = "bold 54px system-ui, sans-serif";
  const codeMetrics = metricsOf(code || "A", codeFont);
  const versionMetrics = metricsOf("版本 7.2.0", versionFont);
  const titleMetrics = metricsOf("七圣召唤 · 牌组图", titleFont);
  const codeTop = 265 - codeMetrics.descent;
  const versionY = codeTop - codeMetrics.ascent - 11 - versionMetrics.descent;
  const titleY = versionY - versionMetrics.ascent - 16 - titleMetrics.descent;
  const dividerY = 265 + 4;
  const headerH = dividerY + 64 + 32;
  const charCardW = 280;
  const charCardH = Math.round((charCardW * 36) / 21);
  const charsH = charCardH + 30;
  const gridTitleH = 60;
  const colGap = 22;
  const rowGap = 22;
  const gridW = W - M * 2;
  const cardW = Math.floor((gridW - colGap * 4) / 5);
  const cardH = Math.round((cardW * 36) / 21);
  const rows = Math.max(1, Math.ceil(deck.cards.length / 5));
  const gridH = rows * cardH + (rows - 1) * rowGap;
  const gridTop = headerH + charsH;
  const gridBottom = gridTop + 66 + gridH;
  const footerY = gridBottom + 52;
  const H = footerY + 44;

  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(S, S);
  ctx.fillStyle = "#f7f2e6";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#d8c9a6";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  ctx.fillStyle = "#3b3226";
  ctx.textAlign = "left";
  ctx.font = titleFont;
  ctx.fillText("七圣召唤 · 牌组图", M, titleY);
  ctx.font = versionFont;
  ctx.fillStyle = "#7a6a50";
  ctx.fillText("版本 7.2.0", M, versionY);
  // 牌组码单独一行（不写提示文字）
  ctx.font = codeFont;
  ctx.fillStyle = "#8a7658";
  codeLines.forEach((line, index) => {
    ctx.fillText(line, M, codeTop + index * 30);
  });

  ctx.fillStyle = "#4a3f2e";
  ctx.fillRect(M, dividerY, W - M * 2, 2);

  ctx.fillStyle = "#3b3226";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText("出战角色牌", M, dividerY + 68);
  // 三张角色牌铺满行动牌网格宽度：最右一张右边缘与网格右边缘对齐
  const chars = deck.characters.slice(0, 3);
  const charGap =
    chars.length > 1 ? Math.max(30, (gridW - chars.length * charCardW) / (chars.length - 1)) : 0;
  let x = M;
  for (const id of chars) {
    const img = await loadImage(imageUrl(id));
    drawCardImage(ctx, img, x, headerH, charCardW, charCardH, 26);
    x += charCardW + charGap;
  }

  ctx.fillStyle = "#3b3226";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText("出战行动牌", M, gridTop + 44);

  let cx = M;
  let cy = gridTop + 66;
  for (const [index, id] of deck.cards.entries()) {
    if (index > 0 && index % 5 === 0) {
      cx = M;
      cy += cardH + rowGap;
    }
    const img = await loadImage(imageUrl(id));
    drawCardImage(ctx, img, cx, cy, cardW, cardH, 14);
    cx += cardW + colGap;
  }

  ctx.fillStyle = "#8a7a5e";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("由七圣召唤工具生成 · DSH-Go", M, footerY);

  sharePreview.innerHTML = "";
  canvas.style.width = "100%";
  sharePreview.appendChild(canvas);
  shareInfo.textContent = `${characterNames(deck).join(" / ")} · ${deck.cards.length} 张行动牌`;

  shareBtn.onclick = () => {
    const dataUrl = encodeShareImage(canvas);
    const base64 = dataUrl.split(",")[1];
    const name = `deck-share-${Date.now()}.${shareImageExt(dataUrl)}`;
    if (saveImageFile(name, base64, "牌组图")) {
      toast(`牌组图已保存到 下载/七圣召唤工具/牌组图/${name}`);
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
    toast("牌组图已下载");
  };
}

// 挂钩：解析成功后展示分享入口


// ---------- 对局详情 / 逐步回放 ----------

interface DetailGame {
  index: number;
  winner: number | null;
  rounds: number;
  stateLog: string;
  detailLog: unknown[];
}

let detailBundle: { code: string; games: DetailGame[] } | null = null;

function framesOf(stateLog: string) {
  try {
    return JSON.parse(stateLog)?.log?.length ?? 0;
  } catch {
    return 0;
  }
}

async function buildDeckGames(code: string): Promise<DetailGame[]> {
  const deck = DEFAULT_ASSETS_MANAGER.decode(code);
  const target = lastTarget ?? deck;
  const { Game, serializeGameStateLog, CURRENT_VERSION } = await import("@gi-tcg/core");
  const { default: getData } = await import("@gi-tcg/data");
  const { createAi } = await import("@gi-tcg/ai");
  const labAi = loadAiSettings("lab");
  const data = getData(CURRENT_VERSION as never);
  const games: DetailGame[] = [];
  for (let i = 0; i < 3; i++) {
    const candidateFirst = i % 2 === 0;
    const decks: [Deck, Deck] = candidateFirst ? [deck, target] : [target, deck];
    const game = new Game(
      Game.createInitialState({
        decks,
        data,
        versionBehavior: CURRENT_VERSION as never,
        randomSeed: (Math.random() * 1e9) >>> 0,
      }),
      { silent: true },
    );
    const stateLogs: { state: unknown; canResume: boolean }[] = [];
    game.onPause = async (state, _mutations, canResume) => {
      stateLogs.push({ state, canResume });
    };
    let s = ((Math.random() * 1e9) >>> 0) || 1;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const seed = (Math.random() * 1e9) >>> 0;
    game.players[0].io = createAi({
      who: 0,
      seed,
      delayMs: 0,
      blunderRate: labAi.blunderRate,
      weights: labAi.weights as never,
      style: labAi.style === "random" ? undefined : labAi.style,
      data,
    });
    game.players[1].io = createAi({
      who: 1,
      seed: seed + 7,
      delayMs: 0,
      blunderRate: labAi.blunderRate,
      weights: labAi.weights as never,
      style: labAi.style === "random" ? undefined : labAi.style,
      data,
    });
    const winner = await game.start();
    stateLogs.push({ state: game.state, canResume: false });
    games.push({
      index: i + 1,
      winner,
      rounds: game.state.roundNumber,
      stateLog: JSON.stringify({
        ...serializeGameStateLog(
          stateLogs as Parameters<typeof serializeGameStateLog>[0],
        ),
        gv: CURRENT_VERSION,
      }),
      detailLog: game.detailLog,
    });
    log(`对局详情：已完成第 ${i + 1} 局（${game.state.roundNumber} 回合）`);
  }
  return games;
}

async function showDeckDetail(code: string) {
  if (detailBundle?.code !== code) {
    toast("正在生成对局详情（3 局）…");
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      detailBundle = { code, games: await buildDeckGames(code) };
      logOp(`已生成对局详情：${code.slice(0, 18)}…（3 局）`);
    } catch (error) {
      const message = `生成对局详情失败：${error instanceof Error ? error.message : String(error)}`;
      logOp(message);
      toast(message);
      return;
    }
  }
  renderDetail();
  showTab("detail");
}

const detailInfo = document.getElementById("detailInfo") as HTMLDivElement;
const detailList = document.getElementById("detailList") as HTMLDivElement;

function renderDetail() {
  if (!detailBundle) {
    return;
  }
  detailInfo.textContent = `${detailBundle.games.length} 局模拟对局 · 点「播放回放」可逐步查看，点「导出日志」导出该局`;
  detailList.innerHTML = "";
  for (const [index, game] of detailBundle.games.entries()) {
    const result = game.winner === null ? "平局" : `玩家${game.winner + 1} 获胜`;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="stat" style="color:#cfd6dd">第 ${game.index} 局 · ${result} · ${game.rounds} 回合 · ${framesOf(game.stateLog)} 帧</div>
      <div class="cache-actions">
        <button class="replay-single" data-index="${index}" style="background:#7fb286;color:#12200f">播放回放</button>
        <button class="export-single" data-index="${index}" style="background:#5f7fa8;color:#fff">导出日志</button>
      </div>`;
    detailList.appendChild(card);
  }
}

function replaySingleGame(index: number) {
  const game = detailBundle?.games[index];
  if (!game) {
    return;
  }
  if (framesOf(game.stateLog) <= 1) {
    toast("这局没有逐步记录，请重新生成对局详情");
    return;
  }
  try {
    sessionStorage.setItem(
      "gi-tcg-replay-bundle",
      JSON.stringify({ stateLog: game.stateLog, detailLog: game.detailLog }),
    );
  } catch {
    toast("日志太大，放不进回放缓存");
    return;
  }
  toast(`正在打开第 ${game.index} 局回放…`);
  setOrientation("landscape");
  location.href = "/app.html?replay=1";
}

function exportSingleGame(index: number) {
  const game = detailBundle?.games[index];
  if (!game || !detailBundle) {
    return;
  }
  const bundle = {
    kind: "gi-tcg-game-log-bundle",
    version: "7.2.0",
    deckCode: detailBundle.code,
    exportedAt: new Date().toISOString(),
    games: [
      {
        index: game.index,
        winner: game.winner,
        rounds: game.rounds,
        stateLog: game.stateLog,
        detailLog: game.detailLog,
      },
    ],
  };
  const text = JSON.stringify(bundle);
  const name = `deck-detail-第${game.index}局-${Date.now()}.json`;
  writeCacheLog(name, text);
  renderCacheLogs();
  saveTextFile(name, text, "对局日志");
  toast(`第 ${game.index} 局日志已导出到下载`);
  logOp(`已导出第 ${game.index} 局对局日志：${name}`);
}

detailList.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  const index = Number(el.dataset.index);
  if (Number.isNaN(index) || !detailBundle) {
    return;
  }
  if (el.classList.contains("replay-single")) {
    replaySingleGame(index);
    return;
  }
  if (el.classList.contains("export-single")) {
    exportSingleGame(index);
  }
});

document.getElementById("detailBack")?.addEventListener("click", () => {
  showTab("results");
});

// ---------- 第二页：结果筛选 / 对局日志与缓存日志 ----------

const pageSearch = document.getElementById("page-search") as HTMLDivElement;
const pageResults = document.getElementById("page-results") as HTMLDivElement;
const pageExp = document.getElementById("page-exp") as HTMLDivElement;
const pageShare = document.getElementById("page-share") as HTMLDivElement;
const pageDetail = document.getElementById("page-detail") as HTMLDivElement;
filteredResults.appendChild(resultsEl);

const setOrientation = (mode: "landscape" | "portrait") => {
  (window as { AndroidHost?: { setOrientation?: (mode: string) => void } }).AndroidHost?.setOrientation?.(mode);
};
// 跟随「主体方向」设置（默认竖屏），不再写死竖屏
setOrientation(
  localStorage.getItem("gitcg.mainOrientation") === "landscape"
    ? "landscape"
    : "portrait",
);
document.getElementById("backHub")?.addEventListener("click", () => {
  // 走历史后退（和牌组库一致）：主页走缓存恢复不重新加载，避免再闪一次竖屏
  if (history.length > 1) {
    history.back();
    return;
  }
  location.href = "/";
});

// 系统返回键：先退当前子页面，最后回工具首页
(window as { __dshBack?: () => string }).__dshBack = () => {
  if (pageDetail.style.display !== "none") {
    showTab("results");
    return "handled";
  }
  if (pageShare.style.display !== "none") {
    showTab(shareReturnTab);
    return "handled";
  }
  if (pageExp.style.display !== "none" || pageResults.style.display !== "none") {
    showTab("search");
    return "handled";
  }
  setOrientation(
    localStorage.getItem("gitcg.mainOrientation") === "landscape"
      ? "landscape"
      : "portrait",
  );
  return "back";
};

let currentTab = "search";

function saveLabState() {
  try {
    sessionStorage.setItem(
      "gi-tcg-lab-state-v1",
      JSON.stringify({
        tab: currentTab,
        results: lists.all ?? [],
        target: lastTarget ? DEFAULT_ASSETS_MANAGER.encode(lastTarget) : "",
        sort: resultSort,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // 存不下就忽略，不影响使用
  }
}

function showTab(tab: string) {
  currentTab = tab;
  saveLabState();
  pageSearch.style.display = tab === "search" ? "block" : "none";
  pageResults.style.display = tab === "results" ? "block" : "none";
  pageExp.style.display = tab === "exp" ? "block" : "none";
  pageShare.style.display = tab === "share" ? "block" : "none";
  pageDetail.style.display = tab === "detail" ? "block" : "none";
  for (const btn of document.querySelectorAll("#tabs button")) {
    const el = btn as HTMLButtonElement;
    el.style.background = el.dataset.tab === tab ? "#c8a15a" : "#3a4653";
    el.style.color = el.dataset.tab === tab ? "#231a0d" : "#dfe6ee";
  }
}
document.getElementById("tabs")!.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  showTab(el.dataset.tab ?? "search");
});

// 返回记忆：从牌组详情按返回重新加载本页时，恢复上次的页与搜索结果
{
  try {
    const raw = sessionStorage.getItem("gi-tcg-lab-state-v1");
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === "object") {
      if (Array.isArray(saved.results) && saved.results.length > 0) {
        lists.all = saved.results;
      }
      if (saved.target) {
        try {
          lastTarget = DEFAULT_ASSETS_MANAGER.decode(saved.target);
          deckInput.value = saved.target;
        } catch {
          lastTarget = null;
        }
      }
      if (saved.sort) {
        resultSort = saved.sort;
        const sortEl = document.getElementById("resultSort") as HTMLSelectElement | null;
        if (sortEl) {
          sortEl.value = saved.sort;
        }
      }
      render();
      showTab(saved.tab === "results" && (saved.results?.length ?? 0) > 0 ? "results" : "search");
    }
  } catch {
    // 状态坏了就用默认页
  }
}

// 目标风格挪到结果页：搜索页只显示当前设置
function updateStyleHint() {
  styleHint.textContent = "全流派（自动）";
}
styleSelect.addEventListener("change", updateStyleHint);
updateStyleHint();

document.getElementById("openExp")?.addEventListener("click", () => {
  showTab("exp");
  renderCacheLogs();
});

// ===== 结果页筛选：牌组库同款（tab + 胶囊 + 头像） =====
type ResultFilterState = {
  keyword: string;
  style: Set<string>;
  element: Set<string>;
  damage: Set<string>;
  chars: Set<string>;
};

const resultFilter: ResultFilterState = {
  keyword: "",
  style: new Set(),
  element: new Set(),
  damage: new Set(),
  chars: new Set(),
};

const RESULT_TABS: { key: "element" | "damage" | "chars"; label: string }[] = [
  { key: "element", label: "元素" },
  { key: "damage", label: "伤害方式" },
  { key: "chars", label: "角色" },
];
let resultTab: "element" | "damage" | "chars" = "element";
let resultSort: "default" | "rate" | "games" | "lib" = "default";

const resultSortSelect = document.getElementById("resultSort") as HTMLSelectElement;
resultSortSelect?.addEventListener("change", () => {
  resultSort = (resultSortSelect.value as typeof resultSort) ?? "default";
  render();
});

const resultSearchInput = document.getElementById("resultSearch") as HTMLInputElement;
const resultSheet = document.getElementById("resultSheet") as HTMLDivElement;
const resultTabsEl = document.getElementById("resultTabs") as HTMLDivElement;
const resultPaneEl = document.getElementById("resultPane") as HTMLDivElement;
const resultChipsEl = document.getElementById("resultChips") as HTMLDivElement;
const resultFilterCount = document.getElementById("resultFilterCount") as HTMLElement;

/** 收集当前结果里出现过的可选项 */
const collectResultOptions = () => {
  const style = new Set<string>();
  const element = new Set<string>();
  const damage = new Set<string>();
  const chars = new Set<string>();
  for (const el of filteredResults.querySelectorAll<HTMLElement>(".card")) {
    if (el.dataset.style) {
      style.add(el.dataset.style);
    }
    for (const item of (el.dataset.elements ?? "").split(" ")) {
      if (item) {
        element.add(item);
      }
    }
    if (el.dataset.damage) {
      damage.add(el.dataset.damage);
    }
    for (const item of (el.dataset.chars ?? "").split(" ")) {
      if (item) {
        chars.add(item);
      }
    }
  }
  return { style, element, damage, chars };
};

const renderResultSheet = () => {
  const options = collectResultOptions();
  resultTabsEl.innerHTML = RESULT_TABS.map(
    (tab) =>
      `<button type="button" data-rtab="${tab.key}" class="${resultTab === tab.key ? "on" : ""}">${tab.label}</button>`,
  ).join("");

  const picked = resultFilter[resultTab];
  const values = [...options[resultTab]].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const labelOf = (value: string) => {
    if (resultTab === "style") {
      return STYLES[value as Style] ?? value;
    }
    if (resultTab === "element") {
      return ELEMENTS[value] ?? value;
    }
    if (resultTab === "damage") {
      return DAMAGE_LABELS[value] ?? value;
    }
    return LAB_META.characters[Number(value)]?.n ?? value;
  };
  const chip = (value: string) => {
    const name = labelOf(value);
    const avatar =
      resultTab === "chars"
        ? `<img src="/assets-local/api/v5/image/${value}/icon/thumb.webp" alt="" loading="lazy" />`
        : "";
    return `<button type="button" data-rvalue="${value}" class="${picked.has(value) ? "on" : ""}">${avatar}${name}</button>`;
  };
  resultPaneEl.innerHTML = values.length
    ? `<div class="r-chipline">${values.map(chip).join("")}</div>`
    : `<div class="stat">还没有结果，先在「搜索」页跑一次。</div>`;

  resultTabsEl.querySelectorAll<HTMLElement>("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      resultTab = (btn.dataset.rtab ?? "style") as typeof resultTab;
      renderResultSheet();
    });
  });
  resultPaneEl.querySelectorAll<HTMLElement>("[data-rvalue]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.dataset.rvalue ?? "";
      if (picked.has(value)) {
        picked.delete(value);
      } else {
        picked.add(value);
      }
      btn.classList.toggle("on", picked.has(value));
      syncResultChips();
      applyFilter();
    });
  });
};

function activeResultChips() {
  const chips: { group: keyof ResultFilterState; value: string; label: string }[] = [];
  const labelOf = (group: keyof ResultFilterState, value: string) =>
    group === "style"
      ? (STYLES[value as Style] ?? value)
      : group === "element"
        ? (ELEMENTS[value] ?? value)
        : group === "damage"
          ? (DAMAGE_LABELS[value] ?? value)
          : (LAB_META.characters[Number(value)]?.n ?? value);
  for (const group of ["style", "element", "damage", "chars"] as const) {
    for (const value of resultFilter[group]) {
      chips.push({ group, value, label: labelOf(group, value) });
    }
  }
  return chips;
}

function syncResultChips() {
  const chips = activeResultChips();
  resultFilterCount.hidden = chips.length === 0;
  resultFilterCount.textContent = chips.length ? String(chips.length) : "";
  resultChipsEl.hidden = chips.length === 0;
  resultChipsEl.innerHTML = chips.length
    ? chips
        .map(
          (chip) =>
            `<button type="button" data-rgroup="${chip.group}" data-rvalue="${chip.value}">${chip.label} ✕</button>`,
        )
        .join("") + `<button type="button" data-rclear="1">清空</button>`
    : "";
}

const openResultSheet = (open: boolean) => {
  resultSheet.classList.toggle("open", open);
  resultSheet.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    renderResultSheet();
  }
};

document.getElementById("openResultFilter")!.addEventListener("click", () => openResultSheet(true));
document.getElementById("closeResultFilter")!.addEventListener("click", () => openResultSheet(false));
document.getElementById("applyResultFilter")!.addEventListener("click", () => openResultSheet(false));
resultSheet.addEventListener("click", (event) => {
  if (event.target === resultSheet) {
    openResultSheet(false);
  }
});
document.getElementById("resetResultFilter")!.addEventListener("click", () => {
  resultFilter.style.clear();
  resultFilter.element.clear();
  resultFilter.damage.clear();
  resultFilter.chars.clear();
  renderResultSheet();
  syncResultChips();
  applyFilter();
});
resultChipsEl.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  if (el.dataset.rclear) {
    resultFilter.style.clear();
    resultFilter.element.clear();
    resultFilter.damage.clear();
    resultFilter.chars.clear();
    renderResultSheet();
    syncResultChips();
    applyFilter();
    return;
  }
  const group = el.dataset.rgroup as keyof ResultFilterState | undefined;
  const value = el.dataset.rvalue ?? "";
  if (!group) {
    return;
  }
  (resultFilter[group] as Set<string>).delete(value);
  syncResultChips();
  applyFilter();
});
resultSearchInput.addEventListener("input", () => {
  resultFilter.keyword = resultSearchInput.value.trim().toLowerCase();
  applyFilter();
});

function applyFilter() {
  const visibleByStyle = new Map<string, number>();
  for (const card of filteredResults.querySelectorAll<HTMLElement>(".card")) {
    const el = card;
    const elements = (el.dataset.elements ?? "").split(" ");
    const chars = (el.dataset.chars ?? "").split(" ");
    const style = el.dataset.style ?? "";
    const keywordHit =
      !resultFilter.keyword ||
      (el.dataset.search ?? "").includes(resultFilter.keyword) ||
      chars.some((id) => (LAB_META.characters[Number(id)]?.n ?? "").toLowerCase().includes(resultFilter.keyword));
    const visible =
      keywordHit &&
      (resultFilter.style.size === 0 || resultFilter.style.has(style)) &&
      (resultFilter.element.size === 0 || elements.some((item) => resultFilter.element.has(item))) &&
      (resultFilter.damage.size === 0 || resultFilter.damage.has(el.dataset.damage ?? "")) &&
      (resultFilter.chars.size === 0 || chars.some((item) => resultFilter.chars.has(item)));
    el.style.display = visible ? "block" : "none";
    if (visible) {
      visibleByStyle.set(style, (visibleByStyle.get(style) ?? 0) + 1);
    }
  }
  for (const header of filteredResults.querySelectorAll<HTMLElement>(".group-header")) {
    const style = header.dataset.group ?? "";
    header.style.display = (visibleByStyle.get(style) ?? 0) > 0 ? "block" : "none";
  }
  if (resultChipsEl) {
    syncResultChips();
  }
}

// ---------- 缓存日志 ----------

const cacheList = document.getElementById("cacheList") as HTMLDivElement;
const clearLogsButton = document.getElementById("clearLogs") as HTMLButtonElement;

function formatBytes(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );
}

function playCachedReplay(name: string) {
  const text = readCacheLog(name);
  if (!text) {
    toast("读取日志失败，可能已被系统清理");
    return;
  }
  let parsed: { games?: { stateLog?: string }[] } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    toast("日志文件损坏，无法回放");
    return;
  }
  const games = Array.isArray(parsed?.games) ? parsed.games : [];
  if (!games.some((game) => framesOf(game.stateLog ?? "") > 1)) {
    toast("这是旧版日志（只有结果），请到「结果」页点「对局详情」重新生成");
    showTab("results");
    return;
  }
  try {
    sessionStorage.setItem("gi-tcg-replay-bundle", text);
  } catch {
    toast("日志太大，放不进回放缓存");
    return;
  }
  logOp(`正在把 ${name} 交给模拟器回放…`);
  toast("正在打开模拟器回放…");
  setOrientation("landscape");
  location.href = "/app.html?replay=1";
}

/** 缓存日志类型：模拟器按模式命名，实验室导出的是 AI 训练/对战详情 */
function cacheKind(name: string): { label: string; color: string } {
  if (name.startsWith("sim-aiai-")) {
    return { label: "机机对战", color: "#c98b5e" };
  }
  if (name.startsWith("sim-ai-")) {
    return { label: "人机对战", color: "#6fa8b8" };
  }
  if (name.startsWith("sim-pvp-")) {
    return { label: "人人对战", color: "#8f7fc9" };
  }
  if (name.startsWith("sim-")) {
    return { label: "对局记录", color: "#7f8b99" };
  }
  if (name.startsWith("deck-detail-") || name.startsWith("train-")) {
    return { label: "AI 训练", color: "#7fb286" };
  }
  return { label: "其他", color: "#7f8b99" };
}

function renderCacheLogs() {
  const logs = listCacheLogs().sort((a, b) => b.mtime - a.mtime);
  cacheList.innerHTML = "";
  const empty = document.getElementById("cacheEmpty");
  if (empty) {
    empty.hidden = logs.length > 0;
    empty.textContent = logs.length
      ? ""
      : "还没有缓存日志。在「结果」页点「导出日志」会存到这里。";
  }
  if (!logs.length) {
    return;
  }
  for (const item of logs) {
    const row = document.createElement("div");
    row.className = "cache-row";
    const time = item.mtime ? new Date(item.mtime).toLocaleString() : "";
    const kind = cacheKind(item.name);
    row.innerHTML = `
      <div class="stat" style="color:#cfd6dd;word-break:break-all">
        <span class="cache-kind" style="display:inline-block;margin-right:6px;padding:1px 7px;border-radius:999px;font-size:11px;background:${kind.color}22;border:1px solid ${kind.color}88;color:${kind.color}">${kind.label}</span>
        ${escapeHtml(item.name)}
      </div>
      <div class="stat">${formatBytes(item.size)}${time ? ` · ${time}` : ""}</div>
      <div class="cache-actions">
        <button class="replay-cache" data-name="${escapeHtml(item.name)}" style="background:#7fb286;color:#12200f">播放回放</button>
        <button class="export-cache" data-name="${escapeHtml(item.name)}" style="background:#5f7fa8;color:#fff">导出到下载</button>
      </div>`;
    cacheList.appendChild(row);
  }
}

cacheList.addEventListener("click", (event) => {
  const el = event.target as HTMLElement;
  const name = el.dataset.name;
  if (!name) {
    return;
  }
  if (el.classList.contains("export-cache")) {
    const ok = exportCacheLog(name);
    logOp(ok ? `已导出到 下载/${name}` : `导出失败：${name}`);
    toast(ok ? `已导出到 下载/${name}` : `导出失败：${name}`);
    return;
  }
  if (el.classList.contains("replay-cache")) {
    playCachedReplay(name);
  }
});

document.getElementById("refreshLogs")!.addEventListener("click", () => {
  renderCacheLogs();
  logOp(`缓存日志：${listCacheLogs().length} 份`);
});

let clearArmed = false;
let clearTimer = 0;
clearLogsButton.addEventListener("click", () => {
  if (!clearArmed) {
    clearArmed = true;
    clearLogsButton.textContent = "再点一次确认清空";
    clearTimer = window.setTimeout(() => {
      clearArmed = false;
      clearLogsButton.textContent = "清空缓存日志";
    }, 3000);
    return;
  }
  window.clearTimeout(clearTimer);
  clearArmed = false;
  clearLogsButton.textContent = "清空缓存日志";
  clearCacheLogs();
  renderCacheLogs();
  logOp("已清空缓存日志");
});

renderCacheLogs();

// 组牌器「生成牌组图」联动：带 deck 参数进入时直接生成牌组图
{
  const params = new URLSearchParams(location.search);
  const deckFromUrl = params.get("deck");
  if (deckFromUrl) {
    deckInput.value = deckFromUrl;
    if (params.get("tab") === "share") {
      const generateFromUrl = async () => {
        try {
          const deck = DEFAULT_ASSETS_MANAGER.decode(deckFromUrl);
          lastDeck = deck;
          shareReturnTab = "search";
          showTab("share");
          shareInfo.textContent = "正在生成牌组图…";
          await renderShare(deck);
        } catch (error) {
          shareInfo.textContent = "牌组码解析失败";
          log(`解析失败：${error instanceof Error ? error.message : String(error)}`);
        }
      };
      window.setTimeout(generateFromUrl, 800);
    }
  }
}
