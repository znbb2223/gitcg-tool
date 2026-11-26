import { createSignal, Show } from "solid-js";
import { render } from "@solidjs/web";
import { DeckBuilder } from "@gi-tcg/deck-builder";
import "@gi-tcg/deck-builder/style.css";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import "./deckbuilder.css";
import { validateDeckRules } from "./deck-rules";
import { sortCardsForShare } from "./deck-order";
import { buildDeck as aiBuildDeck, validateDeck as aiValidateDeck } from "@gi-tcg/ai";
import { encodeShareImage, renderDeckShareImage, saveShareImage } from "./share-image";

let legendIdSet: Set<number> | null = null;
async function loadLegendIds(): Promise<Set<number>> {
  if (legendIdSet) {
    return legendIdSet;
  }
  try {
    const base =
      (globalThis as { __STATIC_DATA_BASE__?: string }).__STATIC_DATA_BASE__ ??
      "/assets-local";
    const res = await fetch(`${base}/api/v5/data/latest/CHS/entities.json`);
    const ents = (await res.json()) as { id?: number; tags?: string[] }[];
    legendIdSet = new Set(
      ents
        .filter((e) => (e.tags ?? []).includes("GCG_TAG_LEGEND"))
        .map((e) => e.id!)
        .filter((id): id is number => typeof id === "number"),
    );
  } catch {
    legendIdSet = new Set();
  }
  return legendIdSet;
}

function isLegendCard(id: number): boolean {
  return legendIdSet?.has(id) ?? false;
}

interface DeckValue {
  characters: number[];
  cards: number[];
}

/** 规则来自 src/deck-rules.ts，和实验室共用同一套；再叠一层引擎校验（天赋角色、元素/阵营共鸣） */
async function validateDeck(deck: DeckValue): Promise<string[]> {
  const local = validateDeckRules(deck, { isLegend: isLegendCard });
  const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const engine = aiValidateDeck(deck as never, deckData).errors;
  // 本地规则与引擎校验会重复报张数问题（"必须 3 张" / "必须是 3 张"），
  // 归一化后去重，只留一行
  const normalize = (msg: string) =>
    msg
      .replace(/^卡牌 /, "")
      .replace(/（当前 \d+ 张）/, "")
      .replace(/，当前 \d+ 张/, "")
      .replace("必须是", "必须");
  const seen = new Set<string>();
  return [...local, ...engine].filter((msg) => {
    const key = normalize(msg);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

interface LibraryDeck {
  id: string;
  code: string;
  chars: number[];
  cards: number[];
  title?: string;
  tags?: string[];
  winRate?: number;
  games?: number;
  role?: string;
  source?: string;
}

const USER_DECKS_KEY = "gi-tcg-user-decks-v1";
const fingerprint = (deck: DeckValue) =>
  `${[...deck.characters].sort((a, b) => a - b).join(",")}|${[...deck.cards].sort((a, b) => a - b).join(",")}`;

let libraryCache: LibraryDeck[] | null = null;
async function loadLibrary(): Promise<LibraryDeck[]> {
  if (libraryCache) {
    return libraryCache;
  }
  try {
    const res = await fetch("/data/deck-library.json");
    const json = (await res.json()) as { decks?: LibraryDeck[] };
    libraryCache = json.decks ?? [];
  } catch {
    libraryCache = [];
  }
  return libraryCache;
}

/**
 * AI 生成：优先用 @gi-tcg/ai 的 buildDeck 现组（对局日志里的卡牌/角色权重 + 随机种子）。
 * 合法性检查开启时：组出来必须通过组牌器规则 + 引擎校验，连续失败再回退到牌组库里的高分牌组；
 * 关闭时：直接用第一次现组结果，不再校验（顶栏的「合法性检查」开关控制）。
 */
async function generateByAi(legalCheck: boolean): Promise<{ deck: DeckValue; source: "built" | "library" } | null> {
  try {
    const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
    if (!legalCheck) {
      const built = aiBuildDeck({
        deckData,
        seed: Date.now() >>> 0,
        deckStrength: Math.random() < 0.6 ? "strong" : "balanced",
      }) as DeckValue;
      return {
        deck: { characters: [...built.characters], cards: [...built.cards] },
        source: "built",
      };
    }
    for (let attempt = 0; attempt < 24; attempt++) {
      const built = aiBuildDeck({
        deckData,
        seed: (Date.now() + attempt * 7919) >>> 0,
        deckStrength: Math.random() < 0.6 ? "strong" : "balanced",
      }) as DeckValue;
      // 组牌器规则 + 引擎级校验（卡牌存在、天赋角色匹配、元素共鸣）
      const localErrors = validateDeckRules(built, { isLegend: isLegendCard });
      const engineErrors = aiValidateDeck(built as never, deckData).errors;
      if (localErrors.length === 0 && engineErrors.length === 0) {
        return {
          deck: { characters: [...built.characters], cards: [...built.cards] },
          source: "built",
        };
      }
      if (attempt === 0) {
        console.warn("AI 现组未通过校验：", [...localErrors, ...engineErrors].slice(0, 3));
      }
    }
  } catch {
    // 组牌失败就走牌组库兜底
  }
  const library = await loadLibrary();
  const libraryDeckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
  const isLegalDeck = (deck: LibraryDeck) =>
    legalCheck
      ? (deck.games ?? 0) >= 8 &&
        deck.chars?.length === 3 &&
        deck.cards?.length === 30 &&
        validateDeckRules({ characters: deck.chars, cards: deck.cards }, { isLegend: isLegendCard })
          .length === 0 &&
        aiValidateDeck({ characters: deck.chars, cards: deck.cards } as never, libraryDeckData)
          .errors.length === 0
      : deck.chars?.length === 3 && deck.cards?.length === 30;
  const decks = library.filter(isLegalDeck);
  if (decks.length === 0) {
    return null;
  }
  const weights = decks.map((deck) =>
    Math.max(0.01, (deck.winRate ?? 0.5) ** 3 * Math.log10((deck.games ?? 0) + 10)),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < decks.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return { characters: [...decks[i].chars], cards: [...decks[i].cards] };
    }
  }
  return { characters: [...decks[0].chars], cards: [...decks[0].cards] };
}

/** 随机：从素材里随机凑一套（合法性检查开启时强制 3 角色 / 30 张 / 每种最多 2 张） */
async function randomDeck(legalCheck: boolean): Promise<DeckValue | null> {
  try {
    const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
    for (let attempt = 0; attempt < 10; attempt++) {
      const built = aiBuildDeck({
        deckData,
        seed: (Date.now() + attempt * 131) >>> 0,
        deckStrength: "balanced",
      }) as DeckValue;
      if (!legalCheck) {
        return { characters: [...built.characters], cards: [...built.cards] };
      }
      const errors = validateDeckRules(built, { isLegend: isLegendCard });
      const engineErrors = aiValidateDeck(built as never, deckData).errors;
      if (errors.length === 0 && engineErrors.length === 0) {
        return { characters: [...built.characters], cards: [...built.cards] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function DeckBuilderPage() {
  const [deck, setDeck] = createSignal<DeckValue>({ characters: [], cards: [] });
  void loadLegendIds().then(() => refreshErrors());
  const [errors, setErrors] = createSignal<string[]>([]);
  // 合法性检查开关：动态生效，同时作用于 AI 生成与随机；持久化到本地
  const LEGAL_KEY = "gi-tcg-deckbuilder-legal-check-v1";
  const [legalCheck, setLegalCheck] = createSignal(
    localStorage.getItem(LEGAL_KEY) !== "off",
  );
  const toggleLegalCheck = () => {
    setLegalCheck((on) => {
      const next = !on;
      localStorage.setItem(LEGAL_KEY, next ? "on" : "off");
      return next;
    });
  };
  const clearDeck = () => {
    setDeck({ characters: [], cards: [] });
    setErrors([]);
    setNote("已清空");
  };
  // 角色 3 张且行动牌 30 张时，「加入牌组库 / 牌组码 / 牌组图」才可点
  const canFinalize = () =>
    deck().characters.length >= 3 && deck().cards.length >= 30;

  const refreshErrors = () => {
    void validateDeck(deck()).then(setErrors);
  };

  const copyCode = async () => {
    const list = await validateDeck(deck());
    setErrors(list);
    if (list.length > 0) {
      return;
    }
    try {
      const code = DEFAULT_ASSETS_MANAGER.encode(deck() as never);
      await navigator.clipboard?.writeText(code);
      alert(`牌组码已复制：\n${code}`);
    } catch (e) {
      alert(`复制失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  /** 把卡牌排成规范顺序（天赋→装备→支援→事件→料理，同类按 id），保证分享码本身是对的 */
  const normalizeDeck = async (value: DeckValue): Promise<DeckValue> => {
    const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
    return {
      characters: [...value.characters],
      cards: sortCardsForShare(value.cards, (id) => deckData.actionCards.get(id)),
    };
  };

  const [note, setNoteRaw] = createSignal("");
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  // toast 式提示：自动消失，不占用布局
  const setNote = (text: string) => {
    setNoteRaw(text);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => setNoteRaw(""), 2600);
  };

  const fillFromAi = async () => {
    const result = await generateByAi(legalCheck());
    if (!result) {
      setNote("AI 组牌失败：素材没加载完或校验没过，稍后再试");
      return;
    }
    const normalized = await normalizeDeck(result.deck);
    setDeck(normalized);
    setErrors(await validateDeck(normalized));
    setNote(
      result.source === "built"
        ? legalCheck()
          ? "AI 现组了一套（已通过组牌器规则 + 引擎校验）"
          : "AI 现组了一套（合法性检查已关闭，未校验）"
        : "AI 从对局日志里挑了一套高分牌组",
    );
  };

  const fillRandom = async () => {
    const check = legalCheck();
    let next: DeckValue | null = null;
    for (let attempt = 0; attempt < 30 && !next; attempt++) {
      next = await randomDeck(check);
    }
    if (!next) {
      setNote("随机失败：连续 30 次都没凑出合法牌组（含天赋/共鸣限制），稍后再试");
      return;
    }
    const normalized = await normalizeDeck(next);
    setDeck(normalized);
    setErrors(await validateDeck(normalized));
    setNote(
      check
        ? "已随机生成一套（已通过组牌器规则 + 引擎校验）"
        : "已随机生成一套（合法性检查已关闭，未校验）",
    );
  };

  const addToLibrary = async () => {
    const current = deck();
    const list = await validateDeck(current);
    setErrors(list);
    if (list.length > 0) {
      setNote("先补齐角色和 30 张行动牌、并满足天赋/共鸣限制再入库");
      return;
    }
    let stored: LibraryDeck[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(USER_DECKS_KEY) ?? "[]");
      if (!Array.isArray(stored)) {
        stored = [];
      }
    } catch {
      stored = [];
    }
    const fp = fingerprint(current);
    if (stored.some((deck) => fingerprint({ characters: deck.chars, cards: deck.cards }) === fp)) {
      setNote("这套牌已经在牌组库里了");
      return;
    }
    const normalized = await normalizeDeck(current);
    const code = DEFAULT_ASSETS_MANAGER.encode(normalized as never);
    stored.unshift({
      id: `manual-${Date.now().toString(36)}`,
      code,
      chars: normalized.characters,
      cards: normalized.cards,
      title: `自建牌组 · ${new Date().toLocaleDateString("zh-CN")}`,
      tags: ["手动添加"],
      elements: [],
      nations: [],
      weapons: [],
      tier: "?",
      style: "midrange",
      source: "manual",
      popularity: 1,
      winRate: 0.5,
      rawWinRate: 0.5,
      games: 0,
      author: null,
      note: "在组牌器里手动添加",
      createdAt: Math.floor(Date.now() / 1000),
      authorTags: [],
      role: "自建",
      guide: {
        open: "按费用曲线留低费与过牌。",
        mid: "中期围绕核心角色铺开，注意骰子规划。",
        watch: "还没有对局数据，先去牌组详情里训练几场。",
        weak: "未知。",
        verdict: "手动添加的牌组，战绩会随训练累积。",
      },
      guideSource: "manual",
      counters: [],
      counteredBy: [],
    } as never);
    try {
      localStorage.setItem(USER_DECKS_KEY, JSON.stringify(stored));
      setNote("已加入牌组库（来源：手动添加）");
    } catch {
      setNote("写入失败，可能是存储空间不足");
    }
  };

  const [shareImage, setShareImage] = createSignal<string | null>(null);
  const [shareCanvas, setShareCanvas] = createSignal<HTMLCanvasElement | null>(null);

  const openDeckImage = async () => {
    const current = deck();
    const list = await validateDeck(current);
    setErrors(list);
    if (list.length > 0) {
      return;
    }
    try {
      const code = DEFAULT_ASSETS_MANAGER.encode(current as never);
      // 完全照码里的顺序出图：编码前已经规范化过（见 normalizeDeck），不再二次排序
      const ordered = DEFAULT_ASSETS_MANAGER.decode(code) as DeckValue;
      const canvas = await renderDeckShareImage(
        { characters: ordered.characters, cards: ordered.cards },
        { code },
      );
      setShareCanvas(canvas);
      setShareImage(encodeShareImage(canvas));
    } catch (e) {
      alert(`生成失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // 系统返回键：先关牌组图弹窗，否则回上一页
  (window as { __dshBack?: () => string }).__dshBack = () => {
    if (shareImage()) {
      setShareImage(null);
      return "handled";
    }
    return "back";
  };

  const importCode = () => {
    const code = prompt("输入牌组码：");
    if (!code) {
      return;
    }
    try {
      void normalizeDeck(DEFAULT_ASSETS_MANAGER.decode(code.trim()) as DeckValue).then((value) => {
        setDeck(value);
        setErrors([]);
      });
    } catch (e) {
      alert(`解析失败：${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div class="deckbuilder-page">
      <header class="deckbuilder-bar">
        <div class="deckbuilder-bar__main">
          <button onClick={() => location.replace("index.html")}>返回</button>
          <b>组牌器</b>
          <span
            class="deckbuilder-status"
            data-ok={deck().characters.length === 3 ? "true" : undefined}
          >
            角色 {deck().characters.length}/3
          </span>
          <span
            class="deckbuilder-status"
            data-ok={deck().cards.length === 30 ? "true" : undefined}
          >
            行动牌 {deck().cards.length}/30
          </span>
        </div>
        <div class="deckbuilder-bar__actions">
          <button onClick={importCode}>导入</button>
          <button class="primary" onClick={fillFromAi}>AI 生成</button>
          <button onClick={fillRandom}>随机</button>
          <button class="danger" onClick={clearDeck}>清空</button>
          <span class="bar-divider" aria-hidden="true" />
          <button
            class="toggle"
            data-off={!legalCheck()}
            onClick={toggleLegalCheck}
            title="关闭后 AI 生成与随机不再校验合法性"
          >
            合法性：{legalCheck() ? "开" : "关"}
          </button>
          <span class="bar-divider" aria-hidden="true" />
          <button disabled={!canFinalize()} onClick={addToLibrary}>入库</button>
          <button disabled={!canFinalize()} onClick={copyCode}>牌组码</button>
          <button disabled={!canFinalize()} onClick={openDeckImage}>牌组图</button>
        </div>
      </header>
      <Show when={shareImage()}>
        <div class="sharemodal" onClick={() => setShareImage(null)}>
          <div class="sharemodal-inner" onClick={(e) => e.stopPropagation()}>
            <img src={shareImage() ?? ""} alt="牌组图" />
            <div class="sharemodal-actions">
              <button
                type="button"
                onClick={() => {
                  const canvas = shareCanvas();
                  if (canvas) {
                    void saveShareImage(canvas, `deck-${Date.now()}.png`);
                  }
                }}
              >
                保存到本地
              </button>
              <button type="button" onClick={() => setShareImage(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={note()}>
        <div class="deckbuilder-toast" role="status">{note()}</div>
      </Show>
      <Show when={errors().length > 0}>
        <div class="deckbuilder-errors">
          {errors().map((e) => (
            <div>· {e}</div>
          ))}
        </div>
      </Show>
      <main class="deckbuilder-body">
        <DeckBuilder
          class="deck-builder"
          deck={deck() as never}
          onChangeDeck={(d) => {
            const next = d as unknown as DeckValue;
            setDeck(next);
            void validateDeck(next).then(setErrors);
          }}
        />
      </main>
    </div>
  );
}

render(() => <DeckBuilderPage />, document.getElementById("root")!);
