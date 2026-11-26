// 牌组库页面：读 /data/deck-library.json，纯前端筛选 + 分批渲染。
// 1600+ 套牌时不预先建 DOM，只保留原始数组和一个过滤后的引用数组。

interface DeckCounter {
  id: string;
  label: string;
  winRate: number;
}

interface DeckGuide {
  open: string;
  mid: string;
  watch: string;
  weak: string;
  verdict: string;
}

interface DeckAuthor {
  uid: string;
  nickname: string;
}

interface DeckEntry {
  characterHp?: Record<string, number>;
  rawWinRate?: number | null;
  id: string;
  author?: DeckAuthor | null;
  note?: string;
  title?: string;
  likes?: number;
  views?: number;
  createdAt?: number;
  code: string;
  chars: number[];
  cards: number[];
  tags: string[];
  authorTags?: string[];
  role?: string;
  guideSource?: string;
  elements?: string[];
  tier?: string;
  style: string;
  source: string;
  popularity: number;
  winRate: number;
  games: number;
  counters: DeckCounter[];
  counteredBy: DeckCounter[];
  guide: DeckGuide;
}

interface DeckLibrary {
  version: string;
  lastScrapedAt?: number;
  updatedAt?: number;
  totalGames: number;
  characters: Record<string, string>;
  cards: Record<string, string>;
  decks: DeckEntry[];
}

const DATA_URL = "/data/deck-library.json";
import { encodeShareImage, renderDeckShareImage, saveShareImage } from "./share-image";
import { loadAiSettings, saveAiSettings, DEFAULT_AI_SETTINGS, AI_SCOPE_LABELS, AI_WEIGHT_FIELDS, type AiSettings } from "./ai-settings-store";

const IMAGE_BASE = "/assets-local/api/v5/image";
const PAGE_SIZE = 80;
const MAX_TAG_CHIPS = 12;
/** 推荐排序的收缩强度：样本少的牌组向 50% 回归，避免一两局 100% 霸榜。 */
const SHRINK_GAMES = 24;

const STYLE_LABELS: Record<string, string> = {
  aggro: "快攻",
  midrange: "中速",
  control: "控制",
  combo: "组合技",
};

const SOURCE_LABELS: Record<string, string> = {
  cardsquare: "官方广场",
  miyoushe: "米游社",
  special: "特殊模式",
  "ai-built": "自添加",
  manual: "手动添加",
  lab: "实验室新发现",
};

/** 深度搜索写回：目标牌组码 → 最能克制它的牌组 */
const COUNTER_KEY = "gi-tcg-counter-overrides-v1";

interface CounterOverride {
  counterCode: string;
  rate: number;
  games: number;
  chars: number[];
  updatedAt: number;
}

const loadCounterOverrides = (): Record<string, CounterOverride> => {
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/** 本地训练战绩：牌组 id → 额外对局与胜场（叠加在社区战绩上显示） */
const TRAIN_KEY = "gi-tcg-deck-train-v1";

interface TrainRecord {
  games: number;
  wins: number;
  draws: number;
  updatedAt: number;
  lastMethod?: string;
  /** 训练里最常输给哪套（弱点） */
  worstOpponent?: { label: string; rate: number; games: number };
}

const loadTrainRecords = (): Record<string, TrainRecord> => {
  try {
    const raw = localStorage.getItem(TRAIN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveTrainRecords = (records: Record<string, TrainRecord>) => {
  try {
    localStorage.setItem(TRAIN_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
};

/** 用户自己加进来的牌组（模拟器里 AI 现场自组 / 组牌器里手动加）都存在本地 */
const USER_DECKS_KEY = "gi-tcg-user-decks-v1";

const loadUserDecks = (): DeckEntry[] => {
  try {
    const raw = localStorage.getItem(USER_DECKS_KEY);
    const list = raw ? (JSON.parse(raw) as DeckEntry[]) : [];
    // 实验室新发现不再入库：历史遗留的 lab 条目也一律忽略（来源筛选里不再出现）
    return Array.isArray(list)
      ? list.filter((deck) => deck && deck.source !== "lab")
      : [];
  } catch {
    return [];
  }
};

const saveUserDecks = (list: DeckEntry[]) => {
  try {
    localStorage.setItem(USER_DECKS_KEY, JSON.stringify(list));
  } catch {
    // 存不下就算了，下次再说
  }
};

const GUIDE_SECTIONS: Array<[keyof DeckGuide, string]> = [
  ["open", "开局"],
  ["mid", "中期"],
  ["watch", "注意"],
  ["weak", "弱点"],
  ["verdict", "自我评价"],
];

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const grid = $<HTMLDivElement>("grid");
const moreBtn = $<HTMLButtonElement>("more");
const statsEl = $<HTMLDivElement>("stats");
const resultLine = $<HTMLDivElement>("resultLine");
const filterSheet = $<HTMLDivElement>("filterSheet");
const filterGroupsEl = $<HTMLDivElement>("filterGroups");
const filterCountEl = $<HTMLElement>("filterCount");
const activeChipsEl = $<HTMLDivElement>("activeChips");
const openFilterBtn = $<HTMLButtonElement>("openFilter");
const closeFilterBtn = $<HTMLButtonElement>("filterClose");
const resetFilterBtn = $<HTMLButtonElement>("filterReset");
const applyFilterBtn = $<HTMLButtonElement>("filterApply");
const searchInput = $<HTMLInputElement>("q");
const sortSelect = $<HTMLSelectElement>("sort");
const detailPanel = $<HTMLDivElement>("detail");
const detailBody = $<HTMLDivElement>("detailBody");
const toastEl = $<HTMLDivElement>("toast");

interface CardMeta { n: string; ty: string; cost: number; tags: string[] }
interface CharMeta { n: string; e: string; w: string; nations: string[]; tags?: string[] }

let charMeta: Record<string, CharMeta> = {};
let cardMeta: Record<string, CardMeta> = {};

let library: DeckLibrary | null = null;
let decksById = new Map<string, DeckEntry>();
let filtered: DeckEntry[] = [];
let rendered = 0;
let currentDeck: DeckEntry | null = null;
let keyword = "";
let sortMode = "popularity";
let toastTimer = 0;
/** 多选筛选：组内 OR、组间 AND，可以同时用 */
type FilterKey =
  | "style" | "tier" | "element" | "nation" | "weapon"
  | "source" | "tag" | "authorTag" | "chars" | "cards" | "charTag";

/** 每一类各自一个集合 + 一个「或/且」模式 */
const picks: Record<FilterKey, Set<string | number>> = {
  style: new Set(),
  tier: new Set(),
  element: new Set(),
  nation: new Set(),
  weapon: new Set(),
  source: new Set(),
  tag: new Set(),
  authorTag: new Set(),
  chars: new Set(),
  cards: new Set(),
  charTag: new Set(),
};
const modes: Record<FilterKey, "any" | "all"> = {
  style: "any",
  tier: "any",
  element: "any",
  nation: "any",
  weapon: "any",
  source: "any",
  tag: "any",
  authorTag: "any",
  chars: "any",
  cards: "any",
  charTag: "any",
};
/** 卡牌页的二级筛选：类型 / 费用 */
const cardTypePick = new Set<string>();
const cardCostPick = new Set<number>();
const cardTagPick = new Set<string>();
const cardEffectPick = new Set<string>();
let showCharAvatar = true;
let activeFilterTab = "chars";

const characterName = (id: number) => library?.characters[String(id)] ?? String(id);
const cardName = (id: number) => library?.cards[String(id)] ?? `卡牌 ${id}`;
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;

/**
 * 推荐 = 用原始胜率做"强先验收缩"：先验 50%、权重 40 局。
 * 这样 17 战全胜只有约 65 分，打满 80 局 75% 的牌组才会排到前面。
 */
const recommendScore = (deck: DeckEntry) => {
  const games = Math.max(deck.games, 0);
  const wins = Number.isFinite(deck.rawWinRate) ? deck.rawWinRate * games : games * 0.5;
  const score = (wins + 0.5 * 40) / (games + 40);
  return games < 12 ? score * 0.5 : score;
};

const SORTERS: Record<string, (a: DeckEntry, b: DeckEntry) => number> = {
  recommended: (a, b) => recommendScore(b) - recommendScore(a) || b.popularity - a.popularity,
  winRate: (a, b) => b.winRate - a.winRate || b.games - a.games,
  games: (a, b) => b.games - a.games || b.winRate - a.winRate,
  popularity: (a, b) => b.popularity - a.popularity,
};

/** 来源可能是 cardsquare / cardsquare-other 之类，先归到三个大类。 */
const groupOfSource = (source: string) => {
  if (source === "ai-built" || source === "manual" || source === "lab") {
    return source;
  }
  if (source.startsWith("cardsquare")) {
    return "cardsquare";
  }
  if (source.startsWith("miyoushe")) {
    return "miyoushe";
  }
  return "special";
};

const CARD_TAG_LABEL: Record<string, string> = {
  weapon: "武器",
  artifact: "圣遗物",
  talent: "天赋",
  technique: "特技",
  legend: "秘传",
  food: "料理",
  item: "道具",
  ally: "伙伴",
  place: "场地",
  resonance: "元素共鸣",
  blessing: "增益",
  action: "行动",
};

const CARD_EFFECT_LABEL: Record<string, string> = {
  discard: "舍弃",
  pick: "挑选",
  preparingSkill: "准备技能",
  summon: "召唤物",
  heal: "治疗",
  shield: "护盾",
  nightsoul: "夜魂状态",
  bondOfLife: "生命之契",
  technique: "特技",
  piercing: "穿透伤害",
  generateAction: "生成行动牌",
  energy: "充能",
  adventure: "冒险",
  draw: "抽牌",
};

const CHAR_TAG_LABEL: Record<string, string> = {
  pneuma: "始基力·芒性",
  ousia: "始基力·荒性",
};

/** 圣骸 / 灾厄 在数据里是角色标签，但按阵营归类更符合直觉 */
const NATION_EXTRA: Record<string, string> = {
  sacread: "圣骸",
  calamity: "灾厄",
};

const CARD_TYPE_LABEL = {
  equipment: "装备牌",
  event: "事件牌",
  support: "支援牌",
} as const;

type CardKind = keyof typeof CARD_TYPE_LABEL;

/** 卡牌类型：天赋/秘传优先，其次按 tags 区分武器/圣遗物，最后按 definition.type */
const cardKindOf = (id: number): CardKind => {
  const meta = cardMeta[String(id)];
  if (meta?.ty === "eventCard") return "event";
  if (meta?.ty === "support") return "support";
  return "equipment";
};

const cardCostBucket = (id: number) => {
  const cost = cardMeta[String(id)]?.cost ?? library?.cardCosts?.[String(id)] ?? 0;
  return cost >= 5 ? 5 : cost;
};

const matchSet = (key: FilterKey, values: readonly (string | number)[]) => {
  const picked = picks[key];
  if (picked.size === 0) {
    return true;
  }
  if (modes[key] === "all") {
    return [...picked].every((value) => values.includes(value));
  }
  return [...picked].some((value) => values.includes(value));
};

const matches = (deck: DeckEntry, query: string) => {
  if (!matchSet("style", [deck.style])) return false;
  if (!matchSet("tier", [deck.tier ?? "?"])) return false;
  if (!matchSet("source", [groupOfSource(deck.source)])) return false;
  if (charSub.element.size && ![...charSub.element].some((e) => (deck.elements ?? []).includes(e))) {
    return false;
  }
  if (
    charSub.weapon.size &&
    ![...charSub.weapon].some((w) => ((deck as { weapons?: string[] }).weapons ?? []).includes(w))
  ) {
    return false;
  }
  if (charSub.nation.size) {
    const nations = new Set([
      ...((deck as { nations?: string[] }).nations ?? []),
      ...(deck.chars ?? []).flatMap((id) => charMeta[String(id)]?.nations ?? []),
      ...(deck.chars ?? [])
        .flatMap((id) => charMeta[String(id)]?.tags ?? [])
        .map((tag) => NATION_EXTRA[tag])
        .filter(Boolean),
    ]);
    if (![...charSub.nation].some((n) => nations.has(n))) {
      return false;
    }
  }
  if (charSub.tag.size) {
    const tags = (deck.chars ?? []).flatMap((id) => charMeta[String(id)]?.tags ?? []);
    if (![...charSub.tag].some((tag) => tags.includes(String(tag)))) {
      return false;
    }
  }
  if (!matchSet("tag", deck.tags ?? [])) return false;
  if (!matchSet("authorTag", deck.authorTags ?? [])) return false;
  if (!matchSet("chars", deck.chars ?? [])) return false;
  if (!matchSet("cards", deck.cards ?? [])) return false;

  if (picks.charTag.size > 0) {
    const tags = (deck.chars ?? []).flatMap((id) => charMeta[String(id)]?.tags ?? []);
    if (modes.charTag === "all") {
      if (![...picks.charTag].every((tag) => tags.includes(String(tag)))) return false;
    } else if (![...picks.charTag].some((tag) => tags.includes(String(tag)))) {
      return false;
    }
  }

  // 卡牌级筛选：至少要有一张同时满足 类型 / 标签 / 花费 / 技能效果
  if (cardTypePick.size || cardCostPick.size || cardTagPick.size || cardEffectPick.size) {
    const ok = (deck.cards ?? []).some((id) => {
      const meta = cardMeta[String(id)];
      const tags = meta?.tags ?? [];
      const typeOk = cardTypePick.size === 0 || cardTypePick.has(cardKindOf(id));
      const costOk = cardCostPick.size === 0 || cardCostPick.has(cardCostBucket(id));
      const tagOk = cardTagPick.size === 0 || [...cardTagPick].some((tag) => tags.includes(tag));
      const effectOk =
        cardEffectPick.size === 0 ||
        [...cardEffectPick].some((tag) => cardEffectsOf(id).includes(tag));
      return typeOk && costOk && tagOk && effectOk;
    });
    if (!ok) return false;
  }

  if (!query) return true;
  const q = query.toLowerCase();
  if ((deck.title ?? "").toLowerCase().includes(q)) return true;
  if ((deck.author?.nickname ?? "").toLowerCase().includes(q)) return true;
  if ((deck.author?.uid ?? "").includes(q)) return true;
  if (sanitizeNote(deck.note).toLowerCase().includes(q)) return true;
  if ((deck.code ?? "").toLowerCase().includes(q)) return true;
  if ((deck.tags ?? []).some((tag) => tag.toLowerCase().includes(q))) return true;
  if ((deck.authorTags ?? []).some((tag) => tag.toLowerCase().includes(q))) return true;
  if ((deck.chars ?? []).some((id) => characterName(id).toLowerCase().includes(q))) return true;
  if ((deck.cards ?? []).some((id) => cardName(id).toLowerCase().includes(q))) return true;
  return false;
};




const rateClass = (rate: number) => (rate >= 0.53 ? "win-good" : rate < 0.47 ? "win-bad" : "");

/** 胜率（单独一行） */
const rateLine = (deck: DeckEntry) => {
  const trained = loadTrainRecords()[deck.id];
  const baseGames = deck.games ?? 0;
  const localGames = trained?.games ?? 0;
  const games = baseGames + localGames;
  if (games <= 0) {
    return "暂无对局样本";
  }
  const wins = (deck.winRate ?? 0.5) * baseGames + (trained?.wins ?? 0);
  const raw =
    localGames > 0 || !Number.isFinite(deck.rawWinRate)
      ? ""
      : `（原始 ${percent(deck.rawWinRate)}）`;
  return `胜率 ${percent(games > 0 ? wins / games : 0.5)}${raw}`;
};

/** 局数（单独一行，训练 + 本地拆开） */
const gamesLine = (deck: DeckEntry) => {
  const trained = loadTrainRecords()[deck.id];
  const baseGames = deck.games ?? 0;
  const localGames = trained?.games ?? 0;
  const games = baseGames + localGames;
  if (games <= 0) {
    return "";
  }
  const split =
    localGames > 0
      ? `训练 ${baseGames} 局 + 本地 ${localGames} 局`
      : `训练 ${baseGames} 局`;
  const small = games < 20 ? " · 样本少" : "";
  return `共 ${games} 局（${split}）${small}`;
};

const statsLine = (deck: DeckEntry) => {
  const trained = loadTrainRecords()[deck.id];
  const baseGames = deck.games ?? 0;
  const localGames = trained?.games ?? 0;
  const games = baseGames + localGames;
  const wins = (deck.winRate ?? 0.5) * baseGames + (trained?.wins ?? 0);
  if (!(games > 0)) {
    return "暂无对局样本";
  }
  const rate = games > 0 ? wins / games : 0.5;
  const raw =
    localGames > 0 || !Number.isFinite(deck.rawWinRate)
      ? ""
      : `（原始 ${percent(deck.rawWinRate)}）`;
  const split =
    localGames > 0
      ? `训练 ${baseGames} 局 + 本地 ${localGames} 局`
      : `训练 ${baseGames} 局`;
  const small = games < 20 ? " · 样本少" : "";
  return `胜率 ${percent(rate)}${raw} · 共 ${games} 局（${split}）${small}`;
};

const avatarHtml = (id: number) =>
  `<span class="av"><img src="${IMAGE_BASE}/${id}/icon/full.webp" alt="" loading="lazy" decoding="async" /><i class="avname">${esc(characterName(id))}</i></span>`;

const counterSummary = (deck: DeckEntry) => {
  const trained = loadTrainRecords()[deck.id]?.worstOpponent;
  if (trained) {
    return `<span class="cs"><b>训练常输</b> ${esc(trained.label)} ${percent(trained.rate)}</span>`;
  }
  const worst = (deck.styleMatchups ?? [])[0];
  if (worst && worst.rate <= 0.47) {
    const styleName = STYLE_LABELS[worst.style] ?? worst.style;
    return `<span class="cs"><b>遇${esc(styleName)}流</b> 胜率 ${percent(worst.rate)}</span>`;
  }
  const gap = deck.styleGap;
  if (typeof gap !== "number" || (deck.games ?? 0) < 5) {
    return `<span class="cs nowin">样本不足</span>`;
  }
  if (gap <= -0.05) {
    return `<span class="cs bad"><b>同风格偏弱</b> ${percent(Math.abs(gap))}</span>`;
  }
  if (gap >= 0.05) {
    return `<span class="cs good"><b>同风格偏强</b> ${percent(gap)}</span>`;
  }
  return `<span class="cs nowin">同风格平均</span>`;
};

const deckCardHtml = (deck: DeckEntry, index: number) => {
  const style = STYLE_LABELS[deck.style] ?? deck.style;
  const tags = (deck.tags ?? []).slice(0, 3).map((tag) => `<span>${esc(tag)}</span>`).join("");
  const width = Math.min(100, Math.max(2, deck.winRate * 100)).toFixed(1);
  return `<button class="deck" type="button" data-i="${index}">
    <span class="avs">${(deck.chars ?? []).map(avatarHtml).join("")}</span>
    ${(deck.title ?? "").trim() ? `<span class="title">${esc((deck.title ?? "").slice(0, 34))}</span>` : ""}
    ${(deck.role ?? "").trim() ? `<span class="role">${esc(deck.role)}</span>` : ""}
    <span class="brow"><span class="style style-${esc(deck.style)}">${esc(style)}</span><span class="pop">热度 ${deck.popularity}</span></span>
    <span class="bar"><i class="${rateClass(deck.winRate)}" style="width:${width}%"></i></span>
    <span class="wline wrate">${rateLine(deck)}</span>
    <span class="wline wgames">${gamesLine(deck)}</span>
    <span class="tags">${tags}</span>
    ${deck.author?.nickname ? `<span class="author">@${esc(deck.author.nickname)}</span>` : ""}
    ${counterSummary(deck)}
  </button>`;
};

const markActive = (row: HTMLElement, active: HTMLElement) => {
  row.querySelectorAll(".seg").forEach((node) => {
    node.classList.toggle("on", node === active);
  });
};

type Chip = { value: string | number; label: string; count: number; img?: string };

/** 角色筛选的四个子条件（对应官方界面 1/2/3 的分类） */
const charSub = {
  element: new Set<string>(),
  weapon: new Set<string>(),
  nation: new Set<string>(),
  tag: new Set<string>(),
};

const styleLabel = (style: string) => STYLE_LABELS[style] ?? style;
const tierLabel = (tier: string) => `${tier} 级`;
const CHAR_IMG = (id: number) => `${IMAGE_BASE}/${id}/icon/thumb.webp`;

const countDecks = (predicate: (deck: DeckEntry) => boolean) =>
  (library?.decks ?? []).filter(predicate).length;

const chipCount = (predicate: (deck: DeckEntry) => boolean) => countDecks(predicate);

/** 顶层（整副牌）的筛选行 */
const deckRows = (): { key: FilterKey; title: string; hint?: string; chips: Chip[]; searchable?: boolean }[] => {
  const deckCounts = (get: (deck: DeckEntry) => readonly string[]) => {
    const counts = new Map<string, number>();
    for (const deck of library?.decks ?? []) {
      for (const value of get(deck)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  };
  const styleCounts = new Map<string, number>();
  const tierCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const deck of library?.decks ?? []) {
    styleCounts.set(deck.style, (styleCounts.get(deck.style) ?? 0) + 1);
    const tier = deck.tier ?? "?";
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    const source = groupOfSource(deck.source);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const tagCounts = deckCounts((deck) => deck.tags ?? []);
  const authorTagCounts = deckCounts((deck) => deck.authorTags ?? []);

  return [
    {
      key: "style",
      title: "流派",
      hint: "快攻＝低费抢节奏；中速＝中期交换；控制＝靠护盾/回复/解场拖长局；组合技＝攒组件斩杀。",
      chips: ["aggro", "midrange", "control", "combo"].map((style) => ({
        value: style,
        label: styleLabel(style),
        count: styleCounts.get(style) ?? 0,
      })),
    },
    {
      key: "tier",
      title: "梯度",
      chips: ["S", "A", "B", "C"].map((tier) => ({
        value: tier,
        label: tierLabel(tier),
        count: tierCounts.get(tier) ?? 0,
      })),
    },
    {
      key: "source",
      title: "来源",
      chips: ["cardsquare", "miyoushe", "special", "ai-built", "manual"].map((source) => ({
        value: source,
        label: SOURCE_LABELS[source] ?? source,
        count: sourceCounts.get(source) ?? 0,
      })),
    },
    {
      key: "tag",
      title: "玩法标签",
      searchable: true,
      chips: [...(tagCounts.entries() as Iterable<[string, number]>)]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([tag, count]) => ({ value: tag, label: tag, count })),
    },
    {
      key: "authorTag",
      title: "作者标签",
      searchable: true,
      hint: "来自作者说明的人工分析结果。",
      chips: [...(authorTagCounts.entries() as Iterable<[string, number]>)]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .map(([tag, count]) => ({ value: tag, label: tag, count })),
    },
  ];
};

/** 角色区的四个子条件（元素/武器/所属/标签） */
const charSubRows = (): { key: keyof typeof charSub; title: string; chips: Chip[] }[] => {
  const decks = library?.decks ?? [];
  const countBy = (get: (deck: DeckEntry) => readonly string[]) => {
    const counts = new Map<string, number>();
    for (const deck of decks) {
      for (const value of get(deck)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  };
  const elementCounts = countBy((deck) => deck.elements ?? []);
  const weaponCounts = countBy((deck) => (deck as { weapons?: string[] }).weapons ?? []);
  const nationCounts = countBy((deck) =>
    [
      ...((deck as { nations?: string[] }).nations ?? []),
      ...(deck.chars ?? []).flatMap((id) => charMeta[String(id)]?.nations ?? []),
      ...(deck.chars ?? [])
        .flatMap((id) => charMeta[String(id)]?.tags ?? [])
        .map((tag) => NATION_EXTRA[tag])
        .filter(Boolean),
    ],
  );
  const tagCounts = countBy((deck) =>
    (deck.chars ?? []).flatMap((id) => charMeta[String(id)]?.tags ?? []).filter((tag) => CHAR_TAG_LABEL[tag]),
  );
  return [
    {
      key: "element",
      title: "元素",
      chips: ["冰", "水", "火", "雷", "风", "岩", "草"]
        .filter((element) => (elementCounts.get(element) ?? 0) > 0)
        .map((element) => ({ value: element, label: element, count: elementCounts.get(element) ?? 0 })),
    },
    {
      key: "weapon",
      title: "武器",
      chips: ["单手剑", "双手剑", "长柄武器", "弓", "法器"]
        .filter((weapon) => (weaponCounts.get(weapon) ?? 0) > 0)
        .map((weapon) => ({ value: weapon, label: weapon, count: weaponCounts.get(weapon) ?? 0 })),
    },
    {
      key: "nation",
      title: "所属",
      chips: [...(nationCounts.entries() as Iterable<[string, number]>)]
        .sort((a, b) => b[1] - a[1])
        .map(([nation, count]) => ({ value: nation, label: nation, count })),
    },
    {
      key: "tag",
      title: "标签",
      chips: [...(tagCounts.entries() as Iterable<[string, number]>)]
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ value: tag, label: CHAR_TAG_LABEL[tag], count })),
    },
  ];
};

/** 卡牌区的四个子条件（类型/标签/花费/技能效果） */
const cardSubRows = (): { key: "type" | "tag" | "cost" | "effect"; title: string; chips: Chip[] }[] => {
  const typeCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const costCounts = new Map<number, number>();
  const effectCounts = new Map<string, number>();
  for (const deck of library?.decks ?? []) {
    const kinds = new Set<string>();
    const tags = new Set<string>();
    const costs = new Set<number>();
    const effects = new Set<string>();
    for (const id of deck.cards ?? []) {
      const meta = cardMeta[String(id)];
      kinds.add(cardKindOf(id));
      costs.add(cardCostBucket(id));
      for (const tag of meta?.tags ?? []) {
        if (CARD_TAG_LABEL[tag]) {
          tags.add(tag);
        }
      }
      for (const effect of cardEffectsOf(id)) {
        effects.add(effect);
      }
    }
    for (const kind of kinds) typeCounts.set(kind, (typeCounts.get(kind) ?? 0) + 1);
    for (const tag of tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    for (const cost of costs) costCounts.set(cost, (costCounts.get(cost) ?? 0) + 1);
    for (const effect of effects) effectCounts.set(effect, (effectCounts.get(effect) ?? 0) + 1);
  }
  return [
    {
      key: "type",
      title: "类型",
      chips: (Object.keys(CARD_TYPE_LABEL) as CardKind[])
        .filter((kind) => (typeCounts.get(kind) ?? 0) > 0)
        .map((kind) => ({ value: kind, label: CARD_TYPE_LABEL[kind], count: typeCounts.get(kind) ?? 0 })),
    },
    {
      key: "tag",
      title: "标签",
      chips: Object.entries(CARD_TAG_LABEL)
        .filter(([tag]) => (tagCounts.get(tag) ?? 0) > 0)
        .map(([tag, label]) => ({ value: tag, label, count: tagCounts.get(tag) ?? 0 })),
    },
    {
      key: "cost",
      title: "花费",
      chips: [0, 1, 2, 3, 4, 5]
        .filter((cost) => (costCounts.get(cost) ?? 0) > 0)
        .map((cost) => ({ value: cost, label: cost === 5 ? "5+" : String(cost), count: costCounts.get(cost) ?? 0 })),
    },
    {
      key: "effect",
      title: "技能效果",
      chips: Object.entries(CARD_EFFECT_LABEL)
        .filter(([tag]) => (effectCounts.get(tag) ?? 0) > 0)
        .map(([tag, label]) => ({ value: tag, label, count: effectCounts.get(tag) ?? 0 })),
    },
  ];
};

const charPassesSub = (id: number) => {
  const meta = charMeta[String(id)];
  if (!meta) {
    return true;
  }
  if (charSub.element.size && !charSub.element.has(meta.e)) {
    return false;
  }
  if (charSub.weapon.size && !charSub.weapon.has(meta.w)) {
    return false;
  }
  if (charSub.nation.size) {
    const extra = (meta.tags ?? []).map((tag) => NATION_EXTRA[tag]).filter(Boolean);
    const nations = [...(meta.nations ?? []), ...extra];
    if (!nations.some((n) => charSub.nation.has(n))) {
      return false;
    }
  }
  if (charSub.tag.size && !(meta.tags ?? []).some((tag) => charSub.tag.has(tag))) {
    return false;
  }
  return true;
};

/** 角色候选：先按元素/武器/所属/标签缩小，再按出现次数排序 */
const charChipsAll = (): Chip[] => {
  const counts = new Map<number, number>();
  for (const deck of library?.decks ?? []) {
    for (const id of deck.chars ?? []) {
      if (!charPassesSub(id)) {
        continue;
      }
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ value: id, label: characterName(id), count, img: CHAR_IMG(id) }));
};

const cardEffectsOf = (id: number): string[] => {
  const meta = cardMeta[String(id)] as { effects?: string[] } | undefined;
  return meta?.effects ?? [];
};

const cardPassesSub = (id: number) => {
  const meta = cardMeta[String(id)];
  const tags = meta?.tags ?? [];
  if (cardTypePick.size && !cardTypePick.has(cardKindOf(id))) {
    return false;
  }
  if (cardCostPick.size && !cardCostPick.has(cardCostBucket(id))) {
    return false;
  }
  if (cardTagPick.size && ![...cardTagPick].some((tag) => tags.includes(tag))) {
    return false;
  }
  if (cardEffectPick.size && ![...cardEffectPick].some((tag) => (meta?.effects as string[] ?? []).includes(tag))) {
    return false;
  }
  return true;
};

/** 卡牌候选：先按类型/标签/花费/技能效果缩小 */
const cardChipsAll = (): Chip[] => {
  const counts = new Map<number, number>();
  for (const deck of library?.decks ?? []) {
    for (const id of deck.cards ?? []) {
      if (!cardPassesSub(id)) {
        continue;
      }
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ value: id, label: cardName(id), count }));
};

const chipHtml = (chip: Chip, attrs: string, avatar = false) => {
  const img = avatar && showCharAvatar && chip.img ? `<img src="${chip.img}" loading="lazy" decoding="async" alt="" />` : "";
  return `<button class="fchip" type="button" ${attrs} data-value="${esc(String(chip.value))}" data-label="${esc(
    chip.label.toLowerCase(),
  )}">${img}<span>${esc(chip.label)}</span><i>${chip.count}</i></button>`;
};

const TABS: { key: string; label: string }[] = [
  { key: "chars", label: "角色" },
  { key: "cards", label: "卡牌" },
  { key: "tag", label: "玩法标签" },
  { key: "authorTag", label: "作者标签" },
  { key: "style", label: "流派" },
  { key: "tier", label: "梯度" },
  { key: "source", label: "来源" },
];

const chipsOf = (
  chips: Chip[],
  attrs: string,
  picked: Set<string | number>,
  avatar = false,
) =>
  chips
    .map((chip) => {
      const img =
        avatar && showCharAvatar && chip.img
          ? `<img src="${chip.img}" loading="lazy" decoding="async" alt="" />`
          : "";
      const on = picked.has(chip.value) ? " on" : "";
      const sub = attrs.includes("data-sub=") ? " sub" : "";
      return `<button class="fchip${sub}${on}" type="button" ${attrs} data-value="${esc(
        String(chip.value),
      )}" data-label="${esc(chip.label.toLowerCase())}">${img}<span>${esc(chip.label)}</span><i>${
        chip.count
      }</i></button>`;
    })
    .join("");

const renderFilterRows = () => {
  if (!filterGroupsEl) {
    return;
  }
  const tabs = TABS.map(
    (tab) =>
      `<button class="ftab${activeFilterTab === tab.key ? " on" : ""}" type="button" data-tab-key="${
        tab.key
      }">${tab.label}</button>`,
  ).join("");

  let pane = "";
  if (activeFilterTab === "chars") {
    const subs = charSubRows()
      .map((sub) => {
        const picked = charSub[sub.key];
        return `<div class="fsub">
          <div class="subline"><span class="subhead">${sub.title}</span></div>
          <div class="chips">${chipsOf(sub.chips, `data-sub="${sub.key}"`, picked as Set<string | number>)}</div>
        </div>`;
      })
      .join("");
    pane = `<div class="fpane" data-sec="chars">
      <div class="panehead">
        <button class="fav" type="button" data-act="avatar">${showCharAvatar ? "头像" : "名字"}</button>
        <button class="fmode" type="button" data-mode="chars">${modes.chars === "all" ? "且" : "或"}</button>
        <input class="fgsearch" data-sec="chars" placeholder="搜角色名" />
      </div>
      ${subs}
      <div class="subline"><span class="subhead">具体角色</span></div>
      <div class="chips listchips">${chipsOf(charChipsAll(), 'data-row="chars"', picks.chars, true)}</div>
    </div>`;
  } else if (activeFilterTab === "cards") {
    const subs = cardSubRows()
      .map((sub) => {
        const picked =
          sub.key === "type"
            ? cardTypePick
            : sub.key === "tag"
              ? cardTagPick
              : sub.key === "cost"
                ? cardCostPick
                : cardEffectPick;
        return `<div class="fsub">
          <div class="subline"><span class="subhead">${sub.title}</span></div>
          <div class="chips">${chipsOf(sub.chips, `data-sub="${sub.key}"`, picked as Set<string | number>)}</div>
        </div>`;
      })
      .join("");
    pane = `<div class="fpane" data-sec="cards">
      <div class="panehead">
        <button class="fmode" type="button" data-mode="cards">${modes.cards === "all" ? "且" : "或"}</button>
        <input class="fgsearch" data-sec="cards" placeholder="搜卡牌名" />
      </div>
      ${subs}
      <div class="subline"><span class="subhead">具体卡牌</span></div>
      <div class="chips listchips">${chipsOf(cardChipsAll(), 'data-row="cards"', picks.cards)}</div>
    </div>`;
  } else {
    const row = deckRows().find((item) => item.key === activeFilterTab);
    if (row) {
      pane = `<div class="fpane">
        <div class="panehead">
          <button class="fmode" type="button" data-mode="${row.key}">${modes[row.key] === "all" ? "且" : "或"}</button>
          ${row.searchable ? `<input class="fgsearch" data-row="${row.key}" placeholder="搜${row.title}" />` : ""}
        </div>
        <div class="chips">${chipsOf(row.chips, `data-row="${row.key}"`, picks[row.key])}</div>
      </div>`;
    }
  }

  filterGroupsEl.innerHTML = `<div class="ftabs">${tabs}</div>${pane}`;
};

const activeFilterChips = () => {
  const chips: { group: string; value: string; label: string }[] = [];
  const labelOf = (key: FilterKey, value: string | number) => {
    switch (key) {
      case "style":
        return styleLabel(String(value));
      case "tier":
        return tierLabel(String(value));
      case "source":
        return SOURCE_LABELS[String(value)] ?? String(value);
      case "chars":
        return characterName(Number(value));
      case "cards":
        return cardName(Number(value));
      default:
        return String(value);
    }
  };
  for (const key of Object.keys(picks) as FilterKey[]) {
    for (const value of picks[key]) {
      chips.push({ group: key, value: String(value), label: labelOf(key, value) });
    }
  }
  for (const [key, set] of Object.entries(charSub) as [keyof typeof charSub, Set<string>][]) {
    for (const value of set) {
      chips.push({ group: `char:${key}`, value, label: value });
    }
  }
  for (const kind of cardTypePick) chips.push({ group: "card:type", value: kind, label: CARD_TYPE_LABEL[kind as CardKind] });
  for (const tag of cardTagPick) chips.push({ group: "card:tag", value: tag, label: CARD_TAG_LABEL[tag] ?? tag });
  for (const cost of cardCostPick) chips.push({ group: "card:cost", value: String(cost), label: cost === 5 ? "花费5+" : `花费${cost}` });
  for (const effect of cardEffectPick) chips.push({ group: "card:effect", value: effect, label: CARD_EFFECT_LABEL[effect] ?? effect });
  return chips;
};

const syncFilterSummary = () => {
  const chips = activeFilterChips();
  if (filterCountEl) {
    filterCountEl.textContent = chips.length ? String(chips.length) : "";
    filterCountEl.hidden = chips.length === 0;
  }
  if (activeChipsEl) {
    activeChipsEl.innerHTML = chips.length
      ? chips
          .map(
            (chip) =>
              `<button class="achip" type="button" data-group="${chip.group}" data-value="${esc(
                String(chip.value),
              )}">${esc(chip.label)}<i>✕</i></button>`,
          )
          .join("") + `<button class="achip clear" type="button" data-clear="1">清空</button>`
      : "";
    activeChipsEl.hidden = chips.length === 0;
  }
};

const clearAllPicks = () => {
  for (const key of Object.keys(picks) as FilterKey[]) {
    picks[key].clear();
  }
  cardTypePick.clear();
  cardCostPick.clear();
  cardTagPick.clear();
  cardEffectPick.clear();
  for (const set of Object.values(charSub)) {
    set.clear();
  }
};

const renderSlice = () => {
  const next = filtered.slice(rendered, rendered + PAGE_SIZE);
  if (!next.length) {
    moreBtn.hidden = true;
    return;
  }
  grid.insertAdjacentHTML(
    "beforeend",
    next.map((deck, offset) => deckCardHtml(deck, rendered + offset)).join(""),
  );
  rendered += next.length;
  moreBtn.hidden = rendered >= filtered.length;
  moreBtn.textContent = `加载更多（${rendered} / ${filtered.length}）`;
};

const applyFilters = () => {
  const query = keyword.trim();
  filtered = (library?.decks ?? []).filter((deck) => matches(deck, query));
  filtered.sort(SORTERS[sortMode]);
  grid.innerHTML = "";
  rendered = 0;
  resultLine.textContent = `筛选出 ${filtered.length} 套 · 共 ${library?.decks.length ?? 0} 套`;
  renderSlice();
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty">没有符合条件的牌组<br /><span class="muted">换个流派、标签或关键词试试</span></div>`;
  }
};

const toast = (message: string) => {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 2200);
};

const groupCards = (ids: number[]) => {
  const counts = new Map<number, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, name: cardName(id), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

/** 深度搜索写回的「最克这套」牌组：可直接复制它的牌组码去打 */
const searchCounterHtml = (deck: DeckEntry) => {
  const entry = loadCounterOverrides()[deck.code ?? ""];
  if (!entry) {
    return `<div class="muted">还没搜过。到卡组实验室对这套牌做一次深度搜索，结果会自动写回这里。</div>`;
  }
  const target = decksByCode.get(entry.counterCode);
  const label = target?.title?.slice(0, 14) ?? "实验室搜到的克制牌组";
  return `<div class="chips"><button class="chip" type="button" data-code="${esc(
    entry.counterCode,
  )}">${esc(label)} <b>${percent(entry.rate)}</b></button></div>`;
};

/** 这套牌在所属风格里的相对强弱（比流派级“弱点”更有意义） */
const styleCompareHtml = (deck: DeckEntry) => {
  const gap = deck.styleGap;
  const avg = deck.styleAvgRate;
  const styleName = STYLE_LABELS[deck.style] ?? deck.style;
  if (typeof gap !== "number" || typeof avg !== "number") {
    return `<div class="muted">暂无同风格样本</div>`;
  }
  const tone = gap <= -0.05 ? "bad" : gap >= 0.05 ? "good" : "even";
  const text =
    tone === "bad"
      ? `低于${styleName}流平均 ${percent(Math.abs(gap))}`
      : tone === "good"
        ? `高于${styleName}流平均 ${percent(gap)}`
        : `与${styleName}流平均接近`;
  return `<div class="chips"><span class="chip static ${tone}">${esc(text)} <b>${percent(
    deck.winRate ?? 0.5,
  )}</b></span><span class="chip static">${styleName}流平均 ${percent(avg)}</span></div>`;
};

/** 流派对局：优势/劣势都列出来（数据来自流派对局统计） */
const styleMatchupHtml = (deck: DeckEntry) => {
  const rows = deck.styleMatchups ?? [];
  if (rows.length === 0) {
    return `<div class="muted">暂无流派对局样本（组合技目前还没积累到足够对局）</div>`;
  }
  const worst = rows[0]?.rate ?? 1;
  const best = rows[rows.length - 1]?.rate ?? 0;
  return `<p class="muted matchupHint">下面是这套牌遇到各流派时的胜率，50% 以上算优势。</p>
  <div class="chips">${rows
    .map((row) => {
      const styleName = STYLE_LABELS[row.style] ?? row.style;
      const tone = row.rate === worst ? "bad" : row.rate === best ? "good" : "even";
      const verdict = row.rate >= 0.5 ? "优势" : "劣势";
      return `<span class="chip static ${tone}" title="按 ${row.games} 局流派对局统计">遇${esc(
        styleName,
      )}流 · 胜率 ${percent(row.rate)}（${verdict}）</span>`;
    })
    .join("")}</div>`;
};

const counterChips = (items: DeckCounter[], emptyText: string) =>
  items.length
    ? `<div class="chips">${items
        .map((item) => {
          const styleName = item.style ? (STYLE_LABELS[item.style] ?? item.style) : "";
          const label = styleName ? `${styleName}流` : item.label;
          return `<span class="chip static" title="按流派统计的对局胜率">${esc(
            label,
          )} <b>${percent(item.winRate)}</b></span>`;
        })
        .join("")}</div>`
    : `<div class="muted">${emptyText}</div>`;

const cardChip = (group: { name: string; count: number }) =>
  `<span class="cc">${esc(group.name)}<b>×${group.count}</b></span>`;

const authorBlockHtml = (deck: DeckEntry) => {
  const author = deck.author;
  const note = sanitizeNote(deck.note);
  const noteHtml = note
    ? `<p class="authornote">${esc(note)}</p>`
    : `<p class="authornote empty">作者发布时没有写说明</p>`;
  if (!author?.uid && !author?.nickname) {
    const authorTagHtml = (deck.authorTags ?? []).length
    ? `<div class="atags">${(deck.authorTags ?? [])
        .map((tag) => `<span class="atag">${esc(tag)}</span>`)
        .join("")}</div>`
    : "";
  return `<div class="authorline"><span class="authorname">未知发布者</span></div>${noteHtml}`;
  }
  const when = deck.createdAt
    ? `<span class="authorwhen">${new Date(deck.createdAt * 1000).toLocaleDateString("zh-CN")}</span>`
    : "";
  const statLine = [
    deck.likes ? `👍 ${deck.likes}` : "",
    deck.views ? `👁 ${deck.views}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const authorTagHtml = (deck.authorTags ?? []).length
    ? `<div class="atags">${(deck.authorTags ?? [])
        .map((tag) => `<span class="atag">${esc(tag)}</span>`)
        .join("")}</div>`
    : "";
  return `<div class="authorline">
      <span class="authorname">${esc(author.nickname || "匿名")}</span>
      ${author.uid ? `<span class="authoruid">米游社 ID ${esc(author.uid)}</span>` : ""}
      ${when}
      ${statLine ? `<span class="authorwhen">${statLine}</span>` : ""}
    </div>${authorTagHtml}${noteHtml}`;
};

const detailHtml = (deck: DeckEntry) => {
  const groups = groupCards(deck.cards ?? []);
  const style = STYLE_LABELS[deck.style] ?? deck.style;
  const source = SOURCE_LABELS[groupOfSource(deck.source)] ?? deck.source;
  const rate = Math.min(100, Math.max(2, deck.winRate * 100)).toFixed(1);
  return `
    <div class="dtop">
      <button class="close" type="button" data-act="close" aria-label="关闭">✕</button>
      <div>
        <div class="dtitle">${esc(
          (deck.title ?? "").trim() || (deck.chars ?? []).map(characterName).join(" · "),
        )}</div>
        <div class="dchars">${esc((deck.chars ?? []).map(characterName).join(" · "))}${
          (deck.role ?? "").trim() ? ` <b class="droletag">${esc(deck.role)}</b>` : ""
        }</div>
        <div class="dsub">${esc(style)} · ${esc(source)} · 热度 ${deck.popularity}${
          deck.author?.nickname ? ` · @${esc(deck.author.nickname)}` : ""
        }</div>
      </div>
    </div>

    <nav class="dtabs">
      <button class="dtab on" type="button" data-tab="main">角色 · 行动牌</button>
      <button class="dtab" type="button" data-tab="guide">AI 玩法说明</button>
      <button class="dtab" type="button" data-tab="author">发布者与说明</button>
    </nav>

    <div class="dbody">
      <section class="dpane" data-pane="main">
        <h2>角色</h2>
        <div class="bigchars">
          ${(deck.chars ?? [])
            .map(
              (id) => `<figure class="clickable" data-card="${id}" data-kind="character" role="button" tabindex="0">
                <div class="art"><img src="${IMAGE_BASE}/${id}/unspecified/full.webp" alt="" data-fallback="${IMAGE_BASE}/${id}/icon/full.webp" loading="lazy" decoding="async" /><b class="hpb"><img class="hpb-life" src="${MYS}/life.png" alt="" /><img class="hpb-num" src="${numImg(library?.characterHp?.[String(id)] ?? 10)}" alt="" /></b></div>
                <figcaption>${esc(characterName(id))}</figcaption>
              </figure>`,
            )
            .join("")}
        </div>

        <h2 class="mt">行动牌</h2>
        <div class="actgrid">
          ${(deck.cards ?? [])
            .map(
              (id) => `<button class="actcard" type="button" data-card="${id}" data-kind="card">
                <img src="${IMAGE_BASE}/${id}/cardFace/full.webp" alt="" data-fallback="${IMAGE_BASE}/${id}/unspecified/full.webp" loading="lazy" decoding="async" />
                ${costBadgeHtml(id)}
                <span class="actname">${esc(cardName(id))}</span>
              </button>`,
            )
            .join("")}
        </div>
      </section>

      <section class="dpane guide" data-pane="guide" hidden>
        <h2>玩法说明<i class="aibadge">AI 生成</i>${
          deck.guideSource === "ai"
            ? `<i class="srcbadge">结合作者说明提炼</i>`
            : deck.guideSource === "digest"
              ? `<i class="srcbadge">按发布者说明整理</i>`
              : ""
        }</h2>
        <p class="ainote">以下说明由 AI 依据角色、费用曲线、卡牌构成与训练战绩自动生成，仅供参考。</p>
        ${GUIDE_SECTIONS.map(
          ([key, title]) => `<h3>${title}</h3><p>${esc(deck.guide?.[key] ?? "暂无")}</p>`,
        ).join("")}
      </section>

      <section class="dpane" data-pane="author" hidden>
        <h2>发布者与说明</h2>
        ${authorBlockHtml(deck)}
      </section>
    </div>

    <div class="dfoot folded">
      <button class="dfold" type="button" data-act="togglefoot" aria-expanded="false">
        <span class="dfold-label">展开对战数据 · 分享码 · 训练</span>
        <i class="dfold-icon">▴</i>
      </button>
      <div class="dfinner">
        <section>
          <h2>对战数据</h2>
          <div class="bigbar"><i style="width:${rate}%"></i></div>
          <div class="wmeta"><div class="wrate">${rateLine(deck)}</div><div class="wgames">${gamesLine(
            deck,
          )}</div></div>
          <div class="subhead">流派对局</div>
          ${styleMatchupHtml(deck)}
          <div class="subhead">同风格对比</div>
          ${styleCompareHtml(deck)}
          <div class="subhead">深度搜索找到的克制牌组</div>
          ${searchCounterHtml(deck)}
        </section>
        <section>
          <h2>分享码</h2>
          <div class="codebox" id="deckCode">${esc(deck.code ?? "")}</div>
          <button class="copy" type="button" data-act="copy">复制分享码</button>
          <button class="shareBtn" type="button" data-act="share">生成牌组图</button>
          <button class="trainBtn" type="button" data-act="train">训练这套牌</button>
          <div class="trainstat" id="trainStat"></div>
        </section>
      </div>
    </div>`;
};

// ---------- 卡牌详情弹窗 + 分享图 ----------

const DATUM_BASE = "/assets-local/api/v5/datum/latest/CHS";

const ensureModal = (id: string, className: string) => {
  let el = document.getElementById(id) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
};

/** 卡牌详情：费用右边那排胶囊（类型 + 标签） */
const cardKindPill = (id: number) =>
  `<span class="pill kind">${CARD_TYPE_LABEL[cardKindOf(id)] ?? "卡牌"}</span>`;

const cardTagPills = (id: number) => {
  const meta = cardMeta[String(id)];
  const tags = (meta?.tags ?? []) as string[];
  const labels: string[] = [];
  for (const tag of tags) {
    const label = CARD_TAG_LABEL[tag];
    if (label && !labels.includes(label)) labels.push(label);
  }
  for (const effect of cardEffectsOf(id)) {
    const label = CARD_EFFECT_LABEL[effect];
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.map((label) => `<span class="pill">${esc(label)}</span>`).join("");
};

const cardDetailModal = ensureModal("cardDetailModal", "modal cardmodal");
const shareModal = ensureModal("shareModal", "modal sharemodal");

const datumCache = new Map<number, Record<string, unknown> | null>();
const loadDatum = async (id: number) => {
  if (datumCache.has(id)) {
    return datumCache.get(id) ?? null;
  }
  try {
    const response = await fetch(`${DATUM_BASE}/${id}.json`);
    const json = (await response.json()) as Record<string, unknown>;
    datumCache.set(id, json);
    return json;
  } catch {
    datumCache.set(id, null);
    return null;
  }
};

const MYS = "/assets-local/ui/mys";
const DICE_ICON: Record<string, { file: string; label: string }> = {
  GCG_COST_DICE_SAME: { file: `${MYS}/none.png`, label: "相同元素骰" },
  GCG_COST_DICE_VOID: { file: `${MYS}/none-dark.png`, label: "任意元素骰" },
  GCG_COST_DICE_CRYO: { file: `${MYS}/frost.png`, label: "冰元素骰" },
  GCG_COST_DICE_HYDRO: { file: `${MYS}/water.png`, label: "水元素骰" },
  GCG_COST_DICE_PYRO: { file: `${MYS}/fire.png`, label: "火元素骰" },
  GCG_COST_DICE_ELECTRO: { file: `${MYS}/elect.png`, label: "雷元素骰" },
  GCG_COST_DICE_ANEMO: { file: `${MYS}/wind.png`, label: "风元素骰" },
  GCG_COST_DICE_GEO: { file: `${MYS}/roach.png`, label: "岩元素骰" },
  GCG_COST_DICE_DENDRO: { file: `${MYS}/grass.png`, label: "草元素骰" },
  GCG_COST_ENERGY: { file: `${MYS}/charge.png`, label: "充能" },
  GCG_COST_LEGEND: { file: `${MYS}/secret.png`, label: "秘传" },
};
const numImg = (n: number) => `${MYS}/num/${Math.max(0, Math.min(30, Math.round(n)))}.png`;

const costChips = (datum: Record<string, unknown> | null, id?: number) => {
  const cost = (datum?.playCost ?? []) as Array<{ type?: string; count?: number }>;
  const total = cost.reduce((sum, item) => sum + (item.count ?? 0), 0);
  if (total === 0) {
    // 0 费：和别的费用用同一套骰子渲染，只是数字换成 0
    const icon = DICE_ICON.GCG_COST_DICE_SAME;
    return `<div class="dcosts"><span class="dcost" title="无需元素骰">
      <img class="hex" src="${icon.file}" alt="" />
      <img class="num" src="${numImg(0)}" alt="" />
    </span></div>`;
  }
  const rows = cost
    .map((item) => {
      const icon = DICE_ICON[item.type ?? ""] ?? DICE_ICON.GCG_COST_DICE_VOID;
      return `<span class="dcost" title="${esc(icon.label)}">
        <img class="hex" src="${icon.file}" alt="" />
        <img class="num" src="${numImg(item.count ?? 1)}" alt="" />
      </span>`;
    })
    .join("");
  return `<div class="dcosts">${rows}</div>`;
};

const TAG_LABELS: Record<string, string> = {
  GCG_TAG_ELEMENT_CRYO: "冰元素",
  GCG_TAG_ELEMENT_HYDRO: "水元素",
  GCG_TAG_ELEMENT_PYRO: "火元素",
  GCG_TAG_ELEMENT_ELECTRO: "雷元素",
  GCG_TAG_ELEMENT_ANEMO: "风元素",
  GCG_TAG_ELEMENT_GEO: "岩元素",
  GCG_TAG_ELEMENT_DENDRO: "草元素",
  GCG_TAG_WEAPON_POLE: "长柄武器",
  GCG_TAG_WEAPON_SWORD: "单手剑",
  GCG_TAG_WEAPON_CLAYMORE: "双手剑",
  GCG_TAG_WEAPON_BOW: "弓",
  GCG_TAG_WEAPON_CATALYST: "法器",
  GCG_TAG_NATION_LIYUE: "璃月",
  GCG_TAG_NATION_MONDSTADT: "蒙德",
  GCG_TAG_NATION_INAZUMA: "稻妻",
  GCG_TAG_NATION_SUMERU: "须弥",
  GCG_TAG_NATION_FONTAINE: "枫丹",
  GCG_TAG_NATION_NATLAN: "纳塔",
  GCG_TAG_NATION_SNEZHNAYA: "至冬",
};
const ELEM_ICON: Record<string, string> = {
  冰元素: "Ice", 水元素: "Water", 火元素: "Fire", 雷元素: "Electric",
  风元素: "Wind", 岩元素: "Rock", 草元素: "Grass",
};
const ELEMENT_DICE: Record<string, string> = ELEM_ICON;
const costBadgeHtml = (id: number) => {
  const entry = library?.cardCosts?.[String(id)];
  const total = typeof entry === "object" && entry ? entry.total : (entry ?? 0);
  const type = typeof entry === "object" && entry ? entry.type : "";
  // 指定元素的费用优先用元素骰；0 费/相同元素用亮标；其余用任意骰暗标
  const icon = total === 0
    ? DICE_ICON.GCG_COST_DICE_SAME
    : DICE_ICON[type] ?? DICE_ICON.GCG_COST_DICE_SAME;
  const energy = typeof entry === "object" && entry ? (entry.energy ?? 0) : 0;
  const charge = energy > 0
    ? `<b class="chargebadge"><img class="hex" src="${MYS}/charge.png" alt="" /><img class="num" src="${numImg(energy)}" alt="" /></b>`
    : "";
  return `<b class="costbadge" title="${esc(icon.label)}"><img class="hex" src="${icon.file}" alt="" /><img class="num" src="${numImg(total)}" alt="" /></b>${charge}`;
};

const tagLabels = (tags: unknown) =>
  ((tags as string[]) ?? [])
    .map((tag) => TAG_LABELS[tag])
    .filter(Boolean)
    .slice(0, 5)
    .map((label) => {
      const icon = ELEM_ICON[label];
      return `<span class="tagpill">${icon ? `<img class="tagdice" src="/assets-local/api/v5/image/raw/UI_Gcg_Buff_Common_Element_${icon}.webp" alt="" />` : ""}${esc(label)}</span>`;
    })
    .join("");

const SKILL_TYPE: Record<string, string> = {
  GCG_SKILL_TAG_A: "普通攻击",
  GCG_SKILL_TAG_E: "元素战技",
  GCG_SKILL_TAG_Q: "元素爆发",
  GCG_SKILL_TAG_P: "被动",
  GCG_SKILL_TAG_NORMAL_ATTACK: "普通攻击",
  GCG_SKILL_TAG_ELEMENTAL_SKILL: "元素战技",
  GCG_SKILL_TAG_ELEMENTAL_BURST: "元素爆发",
  GCG_SKILL_TAG_PASSIVE: "被动",
  GCG_SKILL_TAG_ATTACK: "普通攻击",
  GCG_SKILL_TAG_BURST: "元素爆发",
};

/** 技能类型：英文标签统一翻成中文，未知的也尽量给出可读结果 */
const skillTypeLabel = (type?: string) => {
  if (!type) {
    return "";
  }
  const mapped = SKILL_TYPE[type];
  if (mapped) {
    return mapped;
  }
  if (/PASSIVE|被动/i.test(type)) {
    return "被动";
  }
  if (/NORMAL|ATTACK|普通攻击/i.test(type)) {
    return "普通攻击";
  }
  if (/BURST|爆发/i.test(type)) {
    return "元素爆发";
  }
  if (/SKILL|战技/i.test(type)) {
    return "元素战技";
  }
  return "技能";
};

/** 说明字段兜底清洗：历史数据里有些被存成了 {"describe":...,"imgs":[...]} 的原文 */
const sanitizeNote = (raw: string | undefined) => {
  const text = String(raw ?? "").trim();
  if (!text.startsWith("{")) {
    // 普通说明也去掉 _(可莉-好耶)_ 这类表情标记
    const trimmed = /_\(|\)_/.test(text)
      ? text.replace(/_?\([^()]{1,10}\)/g, " ").replace(/[ \t]+/g, " ")
      : text;
    return trimmed.trim();
  }
  try {
    const parsed = JSON.parse(text) as { describe?: string; imgs?: unknown[] };
    let describe = String(parsed.describe ?? "")
      .replace(/_\([^)]*\)_/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (describe.length >= 6) {
      return describe.slice(0, 200);
    }
    return Array.isArray(parsed.imgs) && parsed.imgs.length > 0
      ? "（作者只发了图片，没有文字说明）"
      : "";
  } catch {
    return text;
  }
};

const openCardDetail = async (id: number, isCharacter: boolean) => {
  const datum = (await loadDatum(id)) as Record<string, any> | null;
  const name = (datum?.name as string) ?? (isCharacter ? characterName(id) : cardName(id));
  const art = isCharacter
    ? `${IMAGE_BASE}/${id}/unspecified/full.webp`
    : `${IMAGE_BASE}/${id}/cardFace/full.webp`;
  const description =
    (datum?.description as string) ||
    (datum?.rawDescription as string) ||
    (datum?.storyText as string) ||
    "暂无说明";

  const skills = ((datum?.skills ?? []) as Array<Record<string, any>>)
    .filter((skill) => !skill?.hidden)
    .map(
      (skill) => `<div class="skillrow">
        <div class="skillhead">
          <span class="skillname">${esc(skill.name ?? "")}</span>
          <span class="skilltype">${esc(skillTypeLabel(skill.type))}</span>
        </div>
        ${skill.playCost?.length ? costChips(skill) : ""}
        <p class="skilldesc">${esc(skill.description ?? skill.rawDescription ?? "")}</p>
      </div>`,
    )
    .join("");

  const stats = isCharacter
    ? `<div class="statrow">
        <span>生命 ${datum?.hp ?? "?"}</span>
        <span class="energyline">充能 ${Array.from({ length: Math.max(0, Number(datum?.maxEnergy ?? 0)) })
          .map(() => `<img class="energyicon" src="/assets-local/ui/EnergyIconActive.svg.webp" alt="" />`)
          .join("") || "0"}</span>
      </div>`
    : "";
  const flavor = (datum?.storyText as string) ? `<p class="flavor">${esc(datum.storyText as string)}</p>` : "";

  cardDetailModal.innerHTML = `
    <div class="modalsheet">
      <button class="modalclose" type="button" data-close="1" aria-label="关闭">✕</button>
      <img class="modalart${isCharacter ? " charart" : " cardart"}" src="${art}" alt="" data-fallback="${IMAGE_BASE}/${id}/unspecified/full.webp" />
      <h3>${esc(name)}</h3>
      ${stats}
      ${isCharacter ? `<div class="tagrow">${tagLabels(datum?.tags)}</div>` : ""}
      ${isCharacter ? `<div class="costhead">技能</div>${skills}` : `<div class="cardpills">${costChips(datum, id)}${cardKindPill(id)}${cardTagPills(id)}</div>`}
      <p class="modaldesc">${esc(isCharacter ? "" : description)}</p>
      ${flavor}
    </div>`;
  cardDetailModal.querySelector("[data-close]")?.addEventListener("click", () => {
    cardDetailModal.classList.remove("open");
    cardDetailModal.setAttribute("aria-hidden", "true");
  });
  cardDetailModal.classList.add("open");
  cardDetailModal.setAttribute("aria-hidden", "false");
  cardDetailModal.scrollTop = 0;
};

const trainModal = ensureModal("trainModal", "modal trainmodal");

const openTrainModal = (deck: DeckEntry) => {
  trainModal.innerHTML = `
    <div class="modalsheet">
      <button class="modalclose" type="button" data-close="1" aria-label="关闭">✕</button>
      <h3>训练这套牌</h3>
      <p class="trainhint">让 AI 用这套牌跟牌组库里的对手反复对打，结果会写进对局日志和这套牌的本地战绩。</p>
      <div class="trainrow"><label>训练场数</label><input id="trainGames" type="number" min="2" max="500" step="1" value="20" /></div>
      <div class="trainrow"><label>时长上限（分钟）</label><input id="trainMinutes" type="number" min="1" max="120" step="1" value="5" /></div>
      <div class="trainrow"><label>训练方式</label>
        <select id="trainMethod">
          <option value="fast">快速自对弈（默认，适合刷样本）</option>
          <option value="deep">深度强化（更多回合思考，速度慢）</option>
        </select>
      </div>
      <div class="trainrow"><label>对手来源</label>
        <select id="trainOpponent">
          <option value="all">牌组库全部对手</option>
          <option value="counter">专挑克制它的对手</option>
        </select>
      </div>
      <div class="trainprogress" id="trainProgress">准备就绪</div>
      <div class="trainactions">
        <button class="trainStart" type="button" data-act="trainStart">开始训练</button>
        <button class="trainAisettings" type="button" data-act="trainAiSettings">AI 设置</button>
        <button class="trainStop" type="button" data-act="trainStop" hidden>停止</button>
      </div>
      <div class="trainAiPanel" id="trainAiPanel" hidden></div>
    </div>`;
  trainModal.classList.add("open");
  trainModal.setAttribute("aria-hidden", "false");
  {
    const panel = trainModal.querySelector("#trainAiPanel") as HTMLElement;
    const field = (label: string, input: string) => `<label class="trainAiRow"><span>${label}</span>${input}</label>`;
    const renderPanel = () => {
      const settings = loadAiSettings("train");
      panel.innerHTML = `
        <div class="trainAiTitle">${AI_SCOPE_LABELS.train}（只影响这套牌的训练，与模拟器/实验室互不影响）</div>
        ${field("思考延时（毫秒）", `<input type="number" min="0" step="50" data-k="delayMs" value="${settings.delayMs}" />`)}
        ${field("失误率 0~1", `<input type="number" min="0" max="1" step="0.01" data-k="blunderRate" value="${settings.blunderRate}" />`)}
        ${field(
          "AI 风格",
          `<select data-k="style">${[
            ["aggro", "快攻"],
            ["midrange", "中速"],
            ["control", "控制"],
            ["random", "随机"],
          ]
            .map(([v, l]) => `<option value="${v}"${settings.style === v ? " selected" : ""}>${l}</option>`)
            .join("")}</select>`,
        )}
        ${Object.entries(settings.weights)
          .map(([key, value]) =>
            field(
              `${
                AI_WEIGHT_FIELDS.find((item) => item.key === key)?.label ?? key
              }`,
              `<input type="number" min="0" step="0.05" data-w="${key}" value="${value}" />`,
            ),
          )
          .join("")}
        <button class="trainAiSave" type="button" data-act="trainAiSave">保存 AI 设置</button>`;
    };
    trainModal.querySelector("[data-act='trainAiSettings']")?.addEventListener("click", () => {
      panel.hidden = panel.hidden === false;
      if (!panel.hidden) {
        renderPanel();
      }
    });
    panel.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.dataset.act !== "trainAiSave") {
        return;
      }
      const next: AiSettings = structuredClone(DEFAULT_AI_SETTINGS);
      next.delayMs = Number((panel.querySelector("[data-k='delayMs']") as HTMLInputElement).value) || 0;
      next.blunderRate = Number((panel.querySelector("[data-k='blunderRate']") as HTMLInputElement).value) || 0;
      next.style = (panel.querySelector("[data-k='style']") as HTMLSelectElement).value as AiSettings["style"];
      for (const input of panel.querySelectorAll<HTMLInputElement>("input[data-w]")) {
        const key = input.dataset.w as keyof AiSettings["weights"];
        next.weights[key] = Number(input.value) || 0;
      }
      saveAiSettings("train", next);
      (trainModal.querySelector("#trainProgress") as HTMLElement).textContent = "AI 设置已保存（下次开训生效）";
    });
  }

  trainModal.querySelector("[data-close]")?.addEventListener("click", () => {
    trainModal.classList.remove("open");
    trainModal.setAttribute("aria-hidden", "true");
  });

  const progressEl = trainModal.querySelector("#trainProgress") as HTMLElement;
  let worker: Worker | null = null;

  /** 训练进行中：把这一轮的战绩实时叠加到下面的「对战数据」里 */
  const updateLiveStats = (played: number, wins: number) => {
    if (played <= 0) {
      return;
    }
    const baseGames = deck.games ?? 0;
    const baseWins = (deck.winRate ?? 0.5) * baseGames;
    const games = baseGames + played;
    const rate = games > 0 ? (baseWins + wins) / games : 0.5;
    const bar = detailBody.querySelector(".dfoot .bigbar i") as HTMLElement | null;
    if (bar) {
      bar.style.width = `${Math.max(2, Math.round(rate * 100))}%`;
    }
    const meta = detailBody.querySelector(".dfoot .wmeta") as HTMLElement | null;
    if (meta) {
      meta.textContent = `胜率 ${percent(rate)} · ${games} 局 · 本地训练 ${played} 局（进行中，${wins} 胜）`;
    }
    const statEl = detailBody.querySelector("#trainStat") as HTMLElement | null;
    if (statEl) {
      statEl.textContent = `本轮训练 ${played} 局 · 胜率 ${percent(played > 0 ? wins / played : 0)}`;
    }
  };
  let opponentsForRun: { id?: string; label: string; characters: number[]; cards: number[] }[] = [];

  const finish = (
    played: number,
    wins: number,
    draws: number,
    stopped: boolean,
    opponentStats: { index: number; games: number; opponentWins: number }[],
  ) => {
    const records = loadTrainRecords();
    const prev = records[deck.id] ?? { games: 0, wins: 0, draws: 0, updatedAt: 0 };
    // 找出训练中最常输的对手（至少 2 局样本）
    let worst = prev.worstOpponent;
    for (const stat of opponentStats) {
      const info = opponentsForRun[stat.index];
      if (!info || stat.games < 1) {
        continue;
      }
      const rate = stat.opponentWins / stat.games;
      // 弱点要至少 2 局样本才可信；对局本身不论几局都记进对局日志
      if (rate >= 0.5 && stat.games >= 2 && (!worst || rate > worst.rate)) {
        worst = { label: info.label || "对手牌组", rate, games: stat.games };
      }
      // 对手也一起练：把这局的对局结果记进对局日志
      bumpLearning(
        { chars: info.characters, cards: info.cards, title: info.label, id: info.id ?? "" } as DeckEntry,
        stat.games,
        stat.opponentWins,
        stat.games - stat.opponentWins - 0,
      );
    }
    records[deck.id] = {
      games: prev.games + played,
      wins: prev.wins + wins,
      draws: prev.draws + draws,
      updatedAt: Date.now(),
      lastMethod: (trainModal.querySelector("#trainMethod") as HTMLSelectElement)?.value ?? "fast",
      worstOpponent: worst,
    };
    saveTrainRecords(records);
    bumpLearning(deck, played, wins, draws);
    progressEl.textContent = `${stopped ? "已停止" : "训练完成"}：${played} 局 · ${wins} 胜 ${played - wins - draws} 负 ${draws} 平`;
    updateLiveStats(0, 0);
    const meta = detailBody.querySelector(".dfoot .wmeta") as HTMLElement | null;
    if (meta) {
      meta.textContent = statsLine(deck);
    }
    const statEl = detailBody.querySelector("#trainStat");
    if (statEl) {
      statEl.textContent = `本地训练 ${records[deck.id].games} 局 · 胜率 ${percent(
        records[deck.id].wins / Math.max(1, records[deck.id].games),
      )}`;
    }
  };

  trainModal.querySelector("[data-act='trainStart']")?.addEventListener("click", () => {
    if (worker) {
      return;
    }
    const games = Math.max(2, Math.min(500, Number((trainModal.querySelector("#trainGames") as HTMLInputElement).value) || 20));
    const minutes = Math.max(1, Math.min(120, Number((trainModal.querySelector("#trainMinutes") as HTMLInputElement).value) || 5));
    const opponentMode = (trainModal.querySelector("#trainOpponent") as HTMLSelectElement).value;
    const pool = (library?.decks ?? [])
      .filter((item) => item.id !== deck.id && (item.chars?.length ?? 0) === 3)
      .filter((item) =>
        opponentMode === "counter"
          ? (deck.counteredBy ?? []).some(
              (counter) =>
                counter.id === item.id ||
                counter.label.includes(item.title ?? ""),
            )
          : true,
      )
      .slice(0, 60)
      .map((item) => ({
        id: item.id,
        label: `${(item.title ?? "").slice(0, 12)}`,
        characters: item.chars,
        cards: item.cards,
      }));
    if (opponentMode === "counter" && pool.length === 0) {
      // 没有克制记录时回退到全部对手（下面的 fallback 兜底），训练照常开始
      console.info("[deck-library] no counter records, fallback to full library");
    }
    const opponents = pool.length > 0 ? pool : (library?.decks ?? []).slice(0, 40).map((item) => ({
      id: item.id,
      label: `${(item.title ?? "").slice(0, 12)}`,
      characters: item.chars,
      cards: item.cards,
    }));
    opponentsForRun = opponents;

    const startButton = trainModal.querySelector("[data-act='trainStart']") as HTMLButtonElement;
    const stopButton = trainModal.querySelector("[data-act='trainStop']") as HTMLButtonElement;
    const settingsButton = trainModal.querySelector("[data-act='trainAiSettings']") as HTMLButtonElement | null;
    startButton.hidden = true;
    settingsButton && (settingsButton.hidden = true);
    stopButton.hidden = false;
    progressEl.textContent = "训练中…";
    let stopped = false;

    // 多线程训练：按 CPU 核数拆成多个 worker，汇总同一套牌的胜率与对手统计
    const cores = Math.max(2, (navigator.hardwareConcurrency ?? 4) - 1);
    const workerCount = Math.max(1, Math.min(cores, games));
    const perWorker = Math.max(1, Math.floor(games / workerCount));
    const workers: Worker[] = [];
    const live = new Map<number, { played: number; wins: number }>();
    const totals = { played: 0, wins: 0, draws: 0 };
    const opponentTotals = new Map<number, { index: number; games: number; opponentWins: number }>();
    let doneCount = 0;
    const deadline = Date.now() + minutes * 60_000;
    progressEl.textContent = `训练中（${workerCount} 线程）…`;

    const stopAll = () => {
      workers.forEach((item) => item.terminate());
      workers.length = 0;
    };

    for (let index = 0; index < workerCount; index++) {
      const workerItem = new Worker(new URL("./deck-train.worker.ts", import.meta.url), {
        type: "module",
      });
      workerItem.addEventListener("message", (event) => {
        const data = event.data as {
          type: string;
          played: number;
          wins: number;
          draws: number;
          stopped?: boolean;
          opponentStats?: { index: number; games: number; opponentWins: number }[];
        };
        if (data.type === "progress") {
          live.set(index, { played: data.played, wins: data.wins });
          let played = 0;
          let wins = 0;
          for (const item of live.values()) {
            played += item.played;
            wins += item.wins;
          }
          progressEl.textContent = `已打 ${played} 局 · ${wins} 胜`;
          updateLiveStats(played, wins);
          return;
        }
        if (data.type !== "done") {
          return;
        }
        doneCount += 1;
        totals.played += data.played;
        totals.wins += data.wins;
        totals.draws += data.draws;
        for (const stat of data.opponentStats ?? []) {
          const prev = opponentTotals.get(stat.index) ?? {
            index: stat.index,
            games: 0,
            opponentWins: 0,
          };
          prev.games += stat.games;
          prev.opponentWins += stat.opponentWins;
          opponentTotals.set(stat.index, prev);
        }
        if (doneCount < workerCount) {
          return;
        }
        stopAll();
        startButton.hidden = false;
        settingsButton && (settingsButton.hidden = false);
        stopButton.hidden = true;
        finish(
          totals.played,
          totals.wins,
          totals.draws,
          stopped,
          [...opponentTotals.values()],
        );
      });
      workerItem.postMessage({
        type: "start",
        deck: { characters: deck.chars, cards: deck.cards },
        opponents,
        games: index === workerCount - 1 ? games - perWorker * (workerCount - 1) : perWorker,
        deadline,
        method: (trainModal.querySelector("#trainMethod") as HTMLSelectElement)?.value === "deep" ? "deep" : "fast",
        aiSettings: loadAiSettings("train"),
      });
      workers.push(workerItem);
    }

    stopButton.addEventListener("click", () => {
      stopped = true;
      stopAll();
      startButton.hidden = false;
      settingsButton && (settingsButton.hidden = false);
      stopButton.hidden = true;
      progressEl.textContent = "已停止（这轮成绩不完整，未写入）";
    });
  });
};

/** 训练结果写进对局日志（学习数据） */
const bumpLearning = (deck: DeckEntry, games: number, wins: number, draws: number) => {
  const KEY = "gi-tcg-ai-learning-v1";
  let learning: {
    kind: string;
    version: number;
    gameVersion?: string;
    games: number;
    cards: Record<string, { games: number; wins: number; draws: number }>;
    characters: Record<string, { games: number; wins: number; draws: number }>;
    decks: Record<string, unknown>;
    updatedAt: number;
  };
  try {
    const raw = localStorage.getItem(KEY);
    learning = raw
      ? JSON.parse(raw)
      : {
          kind: "gi-tcg-ai-learning",
          version: 1,
          gameVersion: "7.2.0",
          games: 0,
          cards: {},
          characters: {},
          decks: {},
          updatedAt: Date.now(),
        };
  } catch {
    return;
  }
  learning.games += games;
  const fp = `${[...deck.chars].sort((a, b) => a - b).join(",")}|${[...deck.cards]
    .sort((a, b) => a - b)
    .join(",")}`;
  const prevDeck = (learning.decks[fp] ?? {
    characters: deck.chars,
    cards: deck.cards,
    games: 0,
    wins: 0,
    draws: 0,
  }) as { games: number; wins: number; draws: number };
  learning.decks[fp] = {
    ...prevDeck,
    characters: deck.chars,
    cards: deck.cards,
    games: prevDeck.games + games,
    wins: prevDeck.wins + wins,
    draws: prevDeck.draws + draws,
    origin: "library",
    subject: deck.title,
    updatedAt: Date.now(),
  };
  for (const id of new Set(deck.chars ?? [])) {
    const entry = learning.characters[String(id)] ?? { games: 0, wins: 0, draws: 0 };
    learning.characters[String(id)] = {
      games: entry.games + games,
      wins: entry.wins + wins,
      draws: entry.draws + draws,
    };
  }
  for (const id of new Set(deck.cards ?? [])) {
    const entry = learning.cards[String(id)] ?? { games: 0, wins: 0, draws: 0 };
    learning.cards[String(id)] = {
      games: entry.games + games,
      wins: entry.wins + wins,
      draws: entry.draws + draws,
    };
  }
  learning.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(learning));
  } catch {
    // ignore
  }
};

const closeOnBackdrop = (modal: HTMLDivElement) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    }
  });
};
closeOnBackdrop(cardDetailModal);
closeOnBackdrop(shareModal);

const openShareImage = async () => {
  const deck = currentDeck;
  if (!deck) {
    return;
  }
  toast("正在生成牌组图…");
  const trained = loadTrainRecords()[deck.id];
  const shareGames = (deck.games ?? 0) + (trained?.games ?? 0);
  const shareWins = (deck.winRate ?? 0.5) * (deck.games ?? 0) + (trained?.wins ?? 0);
  const baseGames = deck.games ?? 0;
  const localGames = trained?.games ?? 0;
  const shareNote =
    shareGames > 0
      ? `胜率 ${percent(shareGames > 0 ? shareWins / shareGames : 0.5)} · 共 ${shareGames} 局（${
          localGames > 0 ? `训练 ${baseGames} 局 + 本地 ${localGames} 局` : `训练 ${baseGames} 局`
        }）`
      : "";
  const canvas = await renderDeckShareImage(
    { characters: deck.chars ?? [], cards: deck.cards ?? [] },
    { note: shareNote, code: deck.code ?? "" },
  );
  shareModal.innerHTML = `
    <div class="modalsheet">
      <button class="modalclose" type="button" data-close="1" aria-label="关闭">✕</button>
      <img class="shareimg" src="${encodeShareImage(canvas)}" alt="牌组图" />
      <button class="copy" type="button" data-save="1">保存图片</button>
    </div>`;
  shareModal.querySelector("[data-close]")?.addEventListener("click", () => {
    shareModal.classList.remove("open");
    shareModal.setAttribute("aria-hidden", "true");
  });
  shareModal.querySelector("[data-save]")?.addEventListener("click", () => {
    const result = saveShareImage(canvas, `deck-share-${Date.now()}`);
    toast(result === "saved" ? "已保存到 下载/" : "已开始下载");
  });
  shareModal.classList.add("open");
  shareModal.setAttribute("aria-hidden", "false");
};

const injectStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
.actgrid[hidden]{display:none!important}
.actgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px 8px}
.actcard{position:relative;display:flex;flex-direction:column;gap:4px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer}
.actcard img{width:100%;aspect-ratio:420/720;object-fit:cover;border-radius:9px;border:2px solid #e8dcc0;background:#1b2230}
.actcard .costbadge{position:absolute;top:-3px;left:-3px;width:30px;height:30px;background:transparent;border:0}.actcard .costbadge .hex{position:absolute;inset:0;width:100%;height:100%;border-radius:6px;background:rgba(18,34,58,.9)}.actcard .costbadge i{position:relative;font-style:normal;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)}
.actgrid .actcard .costbadge{position:absolute!important;top:-8px!important;left:-8px!important;width:30px!important;height:30px!important;z-index:6!important}
.bigchars{margin-top:20px}
.actgrid{margin-top:16px}
.bigchars .art{position:relative;display:block;overflow:visible;aspect-ratio:420/720;width:100%}
.bigchars figure{overflow:visible}
.bigchars .art{border:0!important;background:transparent!important;border-radius:0!important}
.bigchars .art img{width:100%;height:100%;object-fit:cover;display:block;border:0;border-radius:10px;background:transparent}
.bigchars .art::after{content:"";position:absolute;inset:0;border:2px solid #e8dcc0;border-radius:10px;pointer-events:none;z-index:5;box-shadow:0 3px 10px rgba(0,0,0,.4)}
.hpbadge{position:absolute;top:6px;left:6px;z-index:9;min-width:24px;height:22px;padding:0 5px;border-radius:6px;background:rgba(20,26,36,.82);border:1px solid rgba(226,198,139,.75);color:#f4e6c6;font-size:12px;font-weight:700;line-height:20px;text-align:center}
.hpbadge img{width:12px;height:12px}
.actcard .cnt{position:absolute;bottom:-8px;right:-8px;width:26px;height:26px;z-index:5}
.actcard .cnt{position:absolute;bottom:-8px;right:-8px;width:26px;height:26px;z-index:5}
.actname{font-size:10px;line-height:13px;color:rgba(255,255,255,.72);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-height:26px}
.clickable{cursor:pointer}
.shareBtn{margin-top:10px;width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(226,198,139,.55);background:rgba(226,198,139,.12);color:#e2c68b;font-size:15px}
.modal{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(4,7,12,.82)}
.modal.open{display:flex}
.modalsheet{position:relative;width:100%;max-width:min(420px,calc(100vw - 36px));max-height:88dvh;overflow:auto;padding:16px;border-radius:18px;border:1px solid rgba(226,198,139,.35);background:#0e141d}
.modalclose{position:absolute;top:8px;right:8px;width:36px;height:36px;border-radius:10px;border:1px solid rgba(226,198,139,.35);background:rgba(0,0,0,.35);color:#e2c68b;font-size:16px}
.modalart{display:block;margin:0 auto 10px;max-width:72%;max-height:30dvh;object-fit:contain;border-radius:12px}
.modalart.charart{max-width:64%;max-height:34dvh}
.shareimg{display:block;width:100%;border-radius:12px}
.statrow{display:flex;gap:14px;font-size:13px;color:rgba(255,255,255,.8);margin:4px 0 6px}
.tagrow{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.costbadge .num,.hpbadge .num,.cnt .num{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;transform:scale(.58)}
.dcost{position:relative;width:26px;height:26px;display:inline-block}
.dcost .hex{position:absolute;inset:0;width:100%;height:100%}
.dcost .num{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform:scale(.6)}
.actgrid .actcard .costbadge,.actgrid .actcard .costbadge .hex,.actgrid .actcard .costbadge .num,.actgrid .actcard .cnt,.actgrid .actcard .cnt .hex,.actgrid .actcard .cnt .num{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important}
.bigchars .art{overflow:visible!important}
.actgrid .actcard .chargebadge{position:absolute!important;top:25px!important;left:-8px!important;width:30px!important;height:30px!important;z-index:6!important;background:transparent!important;border:0!important}
.actgrid .actcard .chargebadge,.actgrid .actcard .chargebadge img,.actgrid .actcard .chargebadge *{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}
.actgrid .actcard .chargebadge .hex,.actgrid .actcard .chargebadge .num{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:transparent!important}
.actgrid .actcard .chargebadge .num{transform:scale(.56)}
.hpb,.hpb img{background:transparent!important;border:0!important;box-shadow:none!important}
.hpb{position:absolute;top:-9px;left:-9px;width:34px;height:34px;z-index:30;pointer-events:none}
.hpb-life{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.hpb-num{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transform:scale(.5)}
.tagdice{width:16px;height:16px;vertical-align:-3px;margin-right:3px}
.energyline{display:inline-flex;align-items:center;gap:2px}
.energyicon{width:18px;height:18px}
.tagpill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;border:1px solid rgba(226,198,139,.35);font-size:11px;color:rgba(226,198,139,.9)}
.dcosts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0}
.dcost{display:inline-flex;align-items:center;gap:2px;padding:2px 6px 2px 2px;border-radius:999px;background:rgba(255,255,255,.06)}
.dcost img{width:22px;height:22px}
.dcost b{font-size:12px;color:#e2c68b}
.dcosttotal{font-size:11px;color:rgba(255,255,255,.55)}
.costhead{margin:10px 0 4px;font-size:13px;color:rgba(226,198,139,.9)}
.skillrow{padding:8px 0;border-top:1px solid rgba(255,255,255,.08)}
.skillhead{display:flex;align-items:center;gap:8px}
.skillname{font-size:14px;color:#fff}
.skilltype{font-size:11px;color:rgba(226,198,139,.8)}
.skilldesc{margin:4px 0 0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.78)}
.flavor{margin:8px 0 0;font-size:12px;color:rgba(255,255,255,.45)}
.modalmeta{margin:8px 0 6px;font-size:12px;color:rgba(226,198,139,.85)}
.modaldesc{margin:0;font-size:14px;line-height:1.7;color:rgba(255,255,255,.82);white-space:pre-wrap}
.h2row{display:flex;align-items:center;gap:10px;justify-content:space-between}
.duptoggle{min-height:30px;padding:0 10px;border-radius:9px;border:1px solid rgba(226,198,139,.45);background:rgba(226,198,139,.08);color:#e2c68b;font-size:12px}
.sharehint{margin-top:10px;text-align:center;font-size:12px;color:rgba(255,255,255,.6)}
`;
  document.head.appendChild(style);
};
injectStyles();

let deepLinkTries = 0;
function deepLinkDeck() {
  const params = new URLSearchParams(location.search);
  // 兼容两种参数名：?code= 是老约定，?deck= 是实验室那边传过来的
  const code = params.get("code") ?? params.get("deck");
  const id = params.get("id");
  if (!code && !id) return;
  const deck = library?.decks.find(
    (item) => (id ? item.id === id : item.code === code),
  );
  if (deck) {
    openDetail(deck);
    return;
  }
  if (library && deepLinkTries++ >= 10) {
    // 临时牌组（实验室新发现未入库）：按 URL 参数渲染详情
    const chars = (params.get("chars") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const cards = (params.get("cards") ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (chars.length === 3 && cards.length === 30 && code) {
      openDetail({
        id: `temp-${Date.now().toString(36)}`,
        code,
        chars,
        cards,
        tags: [],
        elements: [],
        nations: [],
        weapons: [],
        tier: "?",
        style: "midrange",
        source: "lab",
        popularity: 0,
        winRate: 0,
        rawWinRate: 0,
        games: 0,
        title: "实验室新发现（临时）",
        likes: 0,
        views: 0,
        author: null,
        note: "实验室深度搜索得到的临时牌组，未入库；复制牌组码可在组牌器里继续编辑。",
        createdAt: Math.floor(Date.now() / 1000),
        counters: [],
        counteredBy: [],
        guide: {
          open: "实验室临时牌组，先按费用曲线打。",
          mid: "围绕核心角色铺开，注意骰子规划。",
          watch: "临时牌组未入库，复制牌组码可保存到组牌器。",
          weak: "未知。",
          verdict: "临时牌组，未入库。",
        },
        guideSource: "lab",
        authorTags: [],
        role: "实验室新发现",
        styleAvgRate: 0,
        styleGap: 0,
        styleMatchups: [],
      });
      return;
    }
  }
  if (deepLinkTries++ < 50) {
    setTimeout(deepLinkDeck, 100);
  }
}

const decksByCode = new Map<string, DeckEntry>();

const openDetailByCode = (code: string) => {
  const deck = decksByCode.get(code);
  if (deck) {
    openDetail(deck);
    return;
  }
  toast("牌组库里还没有这套牌，等它被抓取或手动添加后才能打开详情");
};

const openDetail = (deck: DeckEntry) => {
  currentDeck = deck;
  detailBody.innerHTML = detailHtml(deck);
  detailPanel.classList.add("open");
  detailPanel.setAttribute("aria-hidden", "false");
  detailPanel.scrollTop = 0;
  document.body.classList.add("locked");
};

const closeDetail = () => {
  currentDeck = null;
  detailPanel.classList.remove("open");
  detailPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("locked");
  // 列表卡片里的胜率/本地训练局数是渲染时算的，关闭详情后彻底重画一次，保证和训练结果同步
  applyFilters();
};

const selectCode = () => {
  const box = document.getElementById("deckCode");
  if (!box) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(box);
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  selection.removeAllRanges();
  selection.addRange(range);
};

const copyCode = async () => {
  const code = currentDeck?.code ?? "";
  if (!code) {
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    toast("分享码已复制");
  } catch {
    selectCode();
    toast("已选中分享码，请长按复制");
  }
};

const orientation = (mode: "landscape" | "portrait") => {
  (window as { AndroidHost?: { setOrientation?: (mode: string) => void } }).AndroidHost?.setOrientation?.(
    mode,
  );
};

const setFilterSheetOpen = (open: boolean) => {
  filterSheet.classList.toggle("open", open);
  filterSheet.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    renderFilterRows();
  }
};

openFilterBtn.addEventListener("click", () => {
  renderFilterRows();
  syncFilterSummary();
  setFilterSheetOpen(true);
});

closeFilterBtn.addEventListener("click", () => setFilterSheetOpen(false));
applyFilterBtn.addEventListener("click", () => {
  setFilterSheetOpen(false);
  applyFilters();
});

filterSheet.addEventListener("click", (event) => {
  if (event.target === filterSheet) {
    setFilterSheetOpen(false);
  }
});

// 面板内：点选项 / 切「或·且」/ 切头像显示 / 卡牌类型费用
filterGroupsEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const tabBtn = target.closest(".ftab") as HTMLElement | null;
  if (tabBtn) {
    activeFilterTab = tabBtn.dataset.tabKey ?? "chars";
    renderFilterRows();
    return;
  }

  const modeBtn = target.closest(".fmode") as HTMLElement | null;
  if (modeBtn) {
    const key = modeBtn.dataset.mode as FilterKey;
    modes[key] = modes[key] === "all" ? "any" : "all";
    modeBtn.textContent = modes[key] === "all" ? "且" : "或";
    syncFilterSummary();
    applyFilters();
    return;
  }

  if (target.closest("[data-act='avatar']")) {
    showCharAvatar = !showCharAvatar;
    renderFilterRows();
    return;
  }

  const sub = target.closest(".fchip.sub") as HTMLElement | null;
  if (sub) {
    const value = sub.dataset.value ?? "";
    const inChars = !!sub.closest('[data-sec="chars"]');
    if (inChars) {
      const key = sub.dataset.sub as keyof typeof charSub;
      const set = charSub[key];
      if (!set) return;
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      sub.classList.toggle("on", set.has(value));
      renderFilterRows();
      syncFilterSummary();
      applyFilters();
      return;
    }
    if (sub.dataset.sub === "tag") {
      if (cardTagPick.has(value)) {
        cardTagPick.delete(value);
      } else {
        cardTagPick.add(value);
      }
      sub.classList.toggle("on", cardTagPick.has(value));
      renderFilterRows();
    } else if (sub.dataset.sub === "effect") {
      if (cardEffectPick.has(value)) {
        cardEffectPick.delete(value);
      } else {
        cardEffectPick.add(value);
      }
      sub.classList.toggle("on", cardEffectPick.has(value));
      renderFilterRows();
    } else if (sub.dataset.sub === "type") {
      if (cardTypePick.has(value)) {
        cardTypePick.delete(value);
      } else {
        cardTypePick.add(value);
      }
      sub.classList.toggle("on", cardTypePick.has(value));
      renderFilterRows();
    } else {
      const cost = Number(value);
      if (cardCostPick.has(cost)) {
        cardCostPick.delete(cost);
      } else {
        cardCostPick.add(cost);
      }
      sub.classList.toggle("on", cardCostPick.has(cost));
      renderFilterRows();
    }
    syncFilterSummary();
    applyFilters();
    return;
  }

  const chip = target.closest(".fchip") as HTMLElement | null;
  if (!chip) {
    return;
  }
  const key = chip.dataset.row as FilterKey | undefined;
  if (!key) {
    return;
  }
  const raw = chip.dataset.value ?? "";
  const value = key === "chars" || key === "cards" ? Number(raw) : raw;
  const picked = picks[key];
  if (picked.has(value)) {
    picked.delete(value);
  } else {
    picked.add(value);
  }
  chip.classList.toggle("on", picked.has(value));
  syncFilterSummary();
  applyFilters();
});

// 面板内搜索：只在当前行里过滤
filterGroupsEl.addEventListener("input", (event) => {
  const input = (event.target as HTMLElement).closest(".fgsearch") as HTMLInputElement | null;
  if (!input) {
    return;
  }
  const text = input.value.trim().toLowerCase();
  const pane = input.closest(".fpane") as HTMLElement | null;
  pane?.querySelectorAll<HTMLElement>(".fchip").forEach((chip) => {
    const label = chip.dataset.label ?? (chip.textContent ?? "").toLowerCase();
    chip.hidden = text.length > 0 && !label.includes(text);
  });
});

// 已选条：点一下取消，或者清空
activeChipsEl.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-clear]")) {
    clearAllPicks();
    renderFilterRows();
    syncFilterSummary();
    applyFilters();
    return;
  }
  const chip = target.closest(".achip") as HTMLElement | null;
  if (!chip) {
    return;
  }
  const key = chip.dataset.group as FilterKey | undefined;
  const raw = chip.dataset.value ?? "";
  if (!key) {
    return;
  }
  if (key.startsWith("char:")) {
    charSub[key.slice(5) as keyof typeof charSub]?.delete(raw);
  } else if (key.startsWith("card:")) {
    const sub = key.slice(5);
    if (sub === "type") cardTypePick.delete(raw);
    else if (sub === "tag") cardTagPick.delete(raw);
    else if (sub === "cost") cardCostPick.delete(Number(raw));
    else if (sub === "effect") cardEffectPick.delete(raw);
  } else if (raw.startsWith("type:")) {
    cardTypePick.delete(raw.slice(5));
  } else if (raw.startsWith("cost:")) {
    cardCostPick.delete(Number(raw.slice(5)));
  } else if (raw.startsWith("ctag:")) {
    cardTagPick.delete(raw.slice(5));
  } else if (raw.startsWith("ceff:")) {
    cardEffectPick.delete(raw.slice(5));
  } else {
    picks[key].delete(key === "chars" || key === "cards" ? Number(raw) : raw);
  }
  renderFilterRows();
  syncFilterSummary();
  applyFilters();
});

resetFilterBtn.addEventListener("click", () => {
  clearAllPicks();
  renderFilterRows();
  syncFilterSummary();
  applyFilters();
});

searchInput.addEventListener("input", () => {
  keyword = searchInput.value;
  applyFilters();
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  applyFilters();
});

grid.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-act='retry']")) {
    void load();
    return;
  }
  const index = (target.closest(".deck") as HTMLElement | null)?.dataset.i;
  if (index === undefined) {
    return;
  }
  const deck = filtered[Number(index)];
  if (deck) {
    openDetail(deck);
  }
});

detailPanel.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const tab = target.closest("[data-tab]") as HTMLElement | null;
  if (tab) {
    const name = tab.dataset.tab;
    detailBody.querySelectorAll(".dtab").forEach((node) => {
      node.classList.toggle("on", node === tab);
    });
    detailBody.querySelectorAll<HTMLElement>(".dpane").forEach((pane) => {
      pane.hidden = pane.dataset.pane !== name;
    });
    detailBody.querySelector<HTMLElement>(".dbody")?.scrollTo({ top: 0 });
    return;
  }
  if (target.closest("[data-act='close']")) {
    closeDetail();
    return;
  }
  const foot = target.closest("[data-act='togglefoot']") as HTMLElement | null;
  if (foot) {
    const panel = detailBody.querySelector(".dfoot");
    const folded = panel?.classList.toggle("folded") ?? false;
    foot.setAttribute("aria-expanded", folded ? "false" : "true");
    const label = foot.querySelector(".dfold-label");
    if (label) {
      label.textContent = folded ? "展开对战数据 · 分享码 · 训练" : "对战数据 · 分享码 · 训练";
    }
    const icon = foot.querySelector(".dfold-icon");
    if (icon) {
      icon.textContent = folded ? "▴" : "▾";
    }
    return;
  }
  const fold = target.closest("[data-act='fold']") as HTMLElement | null;
  if (fold) {
    document.getElementById("restCards")?.removeAttribute("hidden");
    fold.remove();
    return;
  }
  if (target.closest("[data-act='copy']")) {
    void copyCode();
    return;
  }
  const dupBtn = target.closest("[data-act='dup']") as HTMLElement | null;
  if (dupBtn) {
    const grouped = document.getElementById("actGridGrouped");
    const expanded = document.getElementById("actGridExpanded");
    if (grouped && expanded) {
      const showingExpanded = !expanded.hasAttribute("hidden");
      if (showingExpanded) {
        expanded.setAttribute("hidden", "");
        grouped.removeAttribute("hidden");
        dupBtn.textContent = "展开重复牌";
      } else {
        grouped.setAttribute("hidden", "");
        expanded.removeAttribute("hidden");
        dupBtn.textContent = "折叠重复牌";
      }
    }
    return;
  }
  const counterChip = target.closest(".chip[data-code]") as HTMLElement | null;
  if (counterChip) {
    const code = counterChip.dataset.code ?? "";
    if (code) {
      openDetailByCode(code);
    }
    return;
  }

  if (target.closest("[data-act='train']")) {
    if (currentDeck) {
      openTrainModal(currentDeck);
    }
    return;
  }

  if (target.closest("[data-act='share']")) {
    void openShareImage();
    return;
  }
  const cardEl = target.closest("[data-card]") as HTMLElement | null;
  if (cardEl) {
    void openCardDetail(Number(cardEl.dataset.card), cardEl.dataset.kind === "character");
    return;
  }
  const chip = target.closest("[data-deck]") as HTMLElement | null;
  const deck = chip ? decksById.get(chip.dataset.deck ?? "") : undefined;
  if (deck) {
    openDetail(deck);
  } else if (chip) {
    toast("牌组库里没有这套牌");
  }
});

document.getElementById("toTop")?.addEventListener("click", () => {
  // 距离很远时平滑滚动会拖很久，直接跳
  window.scrollTo({ top: 0, behavior: window.scrollY > 8000 ? "auto" : "smooth" });
});

document.getElementById("toBottom")?.addEventListener("click", () => {
  // 先加载完剩余结果，再滚到最底
  while (rendered < filtered.length) {
    renderSlice();
  }
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
});

moreBtn.addEventListener("click", renderSlice);

// 滚动到接近底部时追加下一批；moreBtn 自己隐藏时观察器不会回调。
new IntersectionObserver(
  (entries) => {
    if (!moreBtn.hidden && entries.some((entry) => entry.isIntersecting)) {
      renderSlice();
    }
  },
  { rootMargin: "500px 0px" },
).observe(moreBtn);

// 头像/角色大图加载失败：先退到 icon，仍然失败就留灰底占位。
document.addEventListener(
  "error",
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) {
      return;
    }
    const fallback = img.dataset.fallback;
    if (fallback && img.dataset.fallbackUsed !== "1") {
      img.dataset.fallbackUsed = "1";
      img.src = fallback;
      return;
    }
    img.remove();
  },
  true,
);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && detailPanel.classList.contains("open")) {
    closeDetail();
  }
});

const load = async () => {
  statsEl.textContent = "读取中…";
  resultLine.textContent = "";
  grid.innerHTML = "";
  const data = await fetchLibrary();
  if (!data) {
    statsEl.textContent = "数据读取失败";
    grid.innerHTML = `<div class="empty">牌组库数据读取失败<br /><span class="muted">检查 /data/deck-library.json 是否存在</span><br /><button class="retry" type="button" data-act="retry">重试</button></div>`;
    return;
  }
  const userDecks = loadUserDecks();
  if (userDecks.length > 0) {
    data.decks = [...userDecks, ...(data.decks ?? [])];
  }
  library = data;
  try {
    const meta = await fetch("/data/filter-meta.json").then((res) => res.json());
    charMeta = meta.characters ?? {};
    cardMeta = meta.cards ?? {};
  } catch {
    charMeta = {};
    cardMeta = {};
  }
  setTimeout(deepLinkDeck, 0);
  decksById = new Map((data.decks ?? []).map((deck): [string, DeckEntry] => [deck.id, deck]));
  decksByCode.clear();
  for (const deck of data.decks ?? []) {
    if (deck.code) {
      decksByCode.set(deck.code, deck);
    }
  }
  const scraped = data.lastScrapedAt
    ? new Date(data.lastScrapedAt * 1000).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "未知";
  // 「上次抓取」单独起一行，避免和前面的统计挤在一起
  statsEl.innerHTML = `<div>${(data.decks ?? []).length} 套牌 · 训练对局 ${(
    data.totalGames ?? 0
  ).toLocaleString()} 局 · 数据 ${esc(data.version ?? "")}</div><div class="scrapeline">上次抓取 ${esc(
    scraped,
  )}</div>`;
  renderFilterRows();
  syncFilterSummary();
  applyFilters();
};

const fetchLibrary = async () => {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    return response.ok ? ((await response.json()) as DeckLibrary) : null;
  } catch {
    return null;
  }
};

// 从别的页面（实验室结果）带 code 直接进来的：返回键直接回上一页，而不是先关详情
const deepLinkedDetail = Boolean(new URLSearchParams(location.search).get("code"));

// 系统返回键：详情开着先关详情，否则回首页。
(window as { __dshBack?: () => string }).__dshBack = () => {
  if (deepLinkedDetail) {
    return "back";
  }
  if (detailPanel.classList.contains("open")) {
    closeDetail();
    return "handled";
  }
  // 回到进入本页之前的页面（A → B → 返回 A），没有历史时由壳层兜底回首页
  return "back";
};

orientation(
  localStorage.getItem("gitcg.mainOrientation") === "landscape"
    ? "landscape"
    : "portrait",
);
void load();

