// Copyright (C) 2024-2025 Guyutongxue
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import getData from "@gi-tcg/data";
import {
  CancellablePlayerIO,
  type Deck,
  DetailLogEntry,
  Game,
  GameState,
  GameStateLogEntry,
  Version,
  exposeState,
  serializeGameStateLog,
  setAsyncContext,
} from "@gi-tcg/core";

import { createClient, StandaloneChessboard } from "@gi-tcg/web-ui-core";
import {
  applyLayoutVars,
  createContext,
  dumpAllAnchors,
  dumpLayout,
  HUD_ANCHOR,
  mountLayoutDebug,
  place,
  stageRect,
  virtualBoardSize,
} from "./board-layout";
import "@gi-tcg/web-ui-core/style.css";
import { Show, createSignal, onCleanup, onSettled, For } from "solid-js";
import { DetailLogViewer } from "@gi-tcg/detail-log-viewer";
import { DEFAULT_ASSETS_MANAGER, getNameSync } from "@gi-tcg/assets-manager";
import {
  buildDeck,
  cardWeights,
  characterWeights,
  createAi,
  createLearning,
  recordGame,
  styleOfDeck,
} from "@gi-tcg/ai";
import { loadLearning, saveLearning } from "./learning-storage";
import { sortCardsForShare } from "./deck-order";
import { loadAiSettings } from "./ai-settings-store";
import { writeCacheLog } from "./native";
import { SearchClient, searchParallel } from "./search-client";
import mergeErrorCause from "merge-error-cause";

export type LocalPlayMode = "pvp" | "ai" | "aiai";


/** 局面价值算法：'v1' 旧线性 / 'v2' 手工特征（默认） */
const aiValueMode = (): "v1" | "v2" =>
  localStorage.getItem("gitcg.ai.valueMode") === "v1" ? "v1" : "v2";

/** 是否启用神经网络价值函数（默认关闭，A/B 达标后再打开） */
const aiNnEnabled = () => localStorage.getItem("gitcg.ai.nn") === "1";

export interface StandaloneParentProps {
  logs?: GameStateLogEntry[];
  importedDetailLog?: readonly DetailLogEntry[];
  /** 回放时带进来的「帧 → detailLog 下标」映射 */
  initialDetailRanges?: number[];
  /** 回放时带进来的「每帧 mutations」 */
  initialFrameMutations?: unknown[][];
  /** 回放时带进来的历史块 */
  initialHistoryBlocks?: readonly unknown[];
  /** 回放时带进来的「每帧历史块」 */
  initialFrameHistory?: unknown[][];
  deck0: string;
  deck1: string;
  version: Version;
  /** 双人 / 人机 / 机机 */
  playMode?: LocalPlayMode;
  /** AI 每步思考时间（毫秒） */
  aiDelayMs?: number;
  /** 人机对战时让 AI 现场自组牌组，而不是用先手牌组输入框 */
  aiBuildsDeck?: boolean;
  /** 是否开启搜索（"深想"） */
  aiThinking?: boolean;
  /** 单步思考预算 */
  aiThinkBudgetMs?: number;
  /** 明牌模式：AI 能看到对手手牌/牌堆（作弊，但方便验证强度） */
  aiPerfectInfo?: boolean;
  /** 风格偏好：auto=按牌组，fixed=指定，random=每局随机，none=无风格 */
  aiStylePref?: "auto" | "aggro" | "midrange" | "control" | "random" | "none";
  /** 失误率（0~1），难度设定的一部分 */
  aiBlunderRate?: number;
  /** 模拟器高级选项里的评分权重 */
  aiWeights?: Partial<import("@gi-tcg/ai").AiWeights>;
  /** 组卡强度偏好 */
  aiDeckStrength?: "strong" | "weak" | "random";
  /** AI 是否先手（默认 true） */
  aiGoesFirst?: boolean;
  /** 返回首页（对局结束/主动退出时调用） */
  onExit?: () => void;
  /** 带着快照进来时，直接从这个局面开始实况对局（不先进回放） */
  autoStartFromSnapshot?: boolean;
}

const CHILD_WHO = 0;
const PARENT_WHO = 1;

/** 机机对战每局的严格记录 */
interface GameRecord {
  index: number;
  deck0: string;
  deck1: string;
  winner: 0 | 1 | null;
  rounds: number;
  at: number;
  /** 逐阶段局面（serializeGameStateLog 格式） */
  stateLog: unknown;
  /** 引擎的结算细节日志 */
  detailLog: unknown;
}

export function StandaloneParent(props: StandaloneParentProps) {
  const playMode = () => props.playMode ?? "pvp";
  const [uiIo, Chessboard] = createClient(PARENT_WHO, {
    onGiveUp: () => {
      game?.giveUp(PARENT_WHO);
    },
    // 机机对战时人类只观战，不能操作
    disableAction: playMode() === "aiai",
  });

  const [popupWindow, setPopupWindow] = createSignal<Window | null>(null);
  const [aiDeckCode, setAiDeckCode] = createSignal<string | null>(null);
  const [layoutMode, setLayoutMode] = createSignal<
    "classic" | "stretch" | "anchor"
  >("classic");
  const [records, setRecords] = createSignal<GameRecord[]>([]);

  /** 原生壳（安卓 APK）里用来切横竖屏；网页版自动 no-op */
  const setOrientation = (mode: "landscape" | "portrait") => {
    (window as any).AndroidHost?.setOrientation?.(mode);
  };

  const exitToHome = () => {
    setOrientation("portrait");
    // 从摆盘器开的局：退出直接回摆盘器（草稿会恢复同一盘面），不回对局配置页
    if (props.autoStartFromSnapshot) {
      // 标记摆盘器恢复草稿后回退历史（不新增/覆盖条目，避免返回时绕路）
      sessionStorage.setItem("gi-tcg-editor-resume", "1");
      if (history.length > 1) {
        history.back();
      } else {
        location.replace("/state-editor.html");
      }
      return;
    }
    props.onExit?.();
  };

  const restartGame = async () => {
    game?.terminate();
    game = null;
    setStateLog([]);
    setViewingLogIndex(-1);
    setFromImport(false);
    setAiWinRate(null);
    await startGame();
  };
  const [aiWinRate, setAiWinRate] = createSignal<number | null>(null);
  let lastDecks: [Deck, Deck] | null = null;
  const [decksForAvatar, setDecksForAvatar] = createSignal<[Deck, Deck] | null>(
    null,
  );
  const UI_BASE = () =>
    (globalThis as { __UI_ASSET_BASE__?: string }).__UI_ASSET_BASE__ ??
    "https://ui-assets.piovium.org/";
  const [travelerAvatar, setTravelerAvatar] = createSignal<"lumine" | "aether">(
    Math.random() < 0.5 ? "lumine" : "aether",
  );
  const avatarUrl = (who: 0 | 1) => {
    if (playMode() === "aiai") {
      return `${UI_BASE()}avatar-paimon.webp`;
    }
    return who === PARENT_WHO
      ? `${UI_BASE()}avatar-${travelerAvatar()}.webp`
      : `${UI_BASE()}avatar-paimon.webp`;
  };

  const showPopup = async () => {
    if (popupWindow() !== null) {
      return;
    }
    const newWindow = window.open(
      window.location.href,
      "_blank",
      "popup=yes, depended=yes, height=750, width=750",
    );
    // 安卓 WebView / 浏览器拦截弹窗时 window.open 返回 null，
    // 继续等 initialized 消息会永远挂住（带快照进房就是这么卡在回放界面的）
    if (!newWindow) {
      return;
    }
    setPopupWindow(newWindow);
    // 不知道为什么 onbeforeload 不起作用
    const autoGiveupWhenChildCloseInterval = window.setInterval(() => {
      if (newWindow?.closed && autoGiveupWhenChildCloseInterval !== null) {
        window.clearInterval(autoGiveupWhenChildCloseInterval);
        game?.giveUp(CHILD_WHO);
        setPopupWindow(null);
      }
    }, 1000);
    await new Promise<void>((resolve) => {
      const handler = (e: MessageEvent) => {
        const { data } = e;
        if (typeof data !== "object" || data === null) {
          return;
        }
        if (data.giTcg !== "1.0") {
          return;
        }
        if (!("method" in data)) {
          return;
        }
        if (data.method === "initialized") {
          window?.removeEventListener("message", handler);
          resolve();
        }
      };
      window?.addEventListener("message", handler);
    });
  };

  const childIo: CancellablePlayerIO = {
    notify: (...params) => {
      popupWindow()?.postMessage({
        giTcg: "1.0",
        method: "notify",
        params,
      });
    },
    rpc: async (...params): Promise<any> => {
      const id = Math.random().toString(36).slice(2);
      const result = new Promise((resolve) => {
        const handler = (e: MessageEvent) => {
          const { data } = e;
          if (typeof data !== "object" || data === null) {
            return;
          }
          if (data.giTcg !== "1.0") {
            return;
          }
          if (!("method" in data)) {
            return;
          }
          if (data.method === "rpc" && data.id === id) {
            window?.removeEventListener("message", handler);
            resolve(data.result);
          }
        };
        window?.addEventListener("message", handler);
      });
      popupWindow()?.postMessage({
        giTcg: "1.0",
        method: "rpc",
        params,
        id,
      });
      return result;
    },
    cancelRpc: () => {
      popupWindow()?.postMessage({
        giTcg: "1.0",
        method: "cancelRpc",
      });
    },
  };

  const [stateLog, setStateLog] = createSignal<GameStateLogEntry[]>([]);
  const [fromImport, setFromImport] = createSignal(false);
  // 每帧对应 detailLog 的结束下标，用来把技能/事件翻译成可读步骤
  const [detailRanges, setDetailRanges] = createSignal<number[]>(props.initialDetailRanges ?? []);
  // 每帧的 mutations，回放时喂给棋盘，历史面板才有内容
  const [frameMutations, setFrameMutations] = createSignal<unknown[][]>(
    props.initialFrameMutations ?? [],
  );
  // 每帧累积的历史块快照（回放随时间轴前进/后退）
  const [frameHistory, setFrameHistory] = createSignal<unknown[][]>(
    props.initialFrameHistory ?? [],
  );
  const [toolbarCollapsed, setToolbarCollapsed] = createSignal(false);
  const [autoPlay, setAutoPlay] = createSignal(false);
  const [autoSpeed, setAutoSpeed] = createSignal(1);
  // -1 代表不显示历史
  const [viewingLogIndex, setViewingLogIndex] = createSignal<number>(-1);
  const [viewingWho, setViewingWho] = createSignal<0 | 1>(1);
  const viewingState = (): GameStateLogEntry | undefined => {
    const index = viewingLogIndex();
    return stateLog()[index];
  };
  const showLogIndex = (index: number) => {
    setViewingLogIndex(index);
    document.body.classList.toggle("replaying", index >= 0);
  };
  const detailSource = () =>
    (game?.detailLog ?? props.importedDetailLog ?? []) as readonly {
      type: string;
      value: string;
    }[];
  const stepHighlights = (index: number): string[] => {
    const source = detailSource();
    const ranges = detailRanges();
    if (!source.length || !ranges.length) {
      return [];
    }
    const from = index > 0 ? ranges[index - 1] ?? 0 : 0;
    const to = ranges[index] ?? source.length;
    const picks = new Set<string>();
    for (let i = from; i < Math.min(to, source.length); i++) {
      const entry = source[i];
      if (!entry) continue;
      const value = String(entry.value);
      const nameOf = (id: number) =>
        DEFAULT_ASSETS_MANAGER.getNameSync(id) ?? `#${id}`;
      for (const m of value.matchAll(/Using skill \[skill:(\d+)/g)) {
        picks.add(`使用「${nameOf(Number(m[1]))}」`);
      }
      for (const m of value.matchAll(
        /play card \[(?:eventCard|support|equipment|status|character):(\d+)\]/g,
      )) {
        picks.add(`打出「${nameOf(Number(m[1]))}」`);
      }
      for (const m of value.matchAll(/Switch active .* to \[character:(\d+)\]/g)) {
        picks.add(`换成「${nameOf(Number(m[1]))}」`);
      }
      if (picks.size >= 4) break;
    }
    return [...picks].slice(0, 4);
  };

  const describeStep = (index: number) => {
    const prev = index > 0 ? stateLog()[index - 1]?.state : null;
    const cur = stateLog()[index]?.state;
    if (!cur) {
      return `第 ${index + 1} 步`;
    }
    if (!prev) {
      return `第 ${index + 1} 步 · 开局`;
    }
    const parts: string[] = [`第 ${index + 1} 步`];
    parts.push(...stepHighlights(index));
    if (cur.roundNumber !== prev.roundNumber) {
      parts.push(`进入第 ${cur.roundNumber} 回合`);
    }
    if (cur.phase !== prev.phase) {
      parts.push(`进入${phaseLabel(cur.phase)}`);
    }
    if (cur.currentTurn !== prev.currentTurn) {
      parts.push(cur.currentTurn === 0 ? "切换为先手行动" : "切换为后手行动");
    }
    type MaybeState = {
      players?: { handCard?: unknown[]; dice?: unknown[] }[];
    };
    const cp = cur as unknown as MaybeState;
    const pp = prev as unknown as MaybeState;
    const handLen = (s: MaybeState) =>
      (s.players?.[0]?.handCard?.length ?? 0) +
      (s.players?.[1]?.handCard?.length ?? 0);
    const handDelta = handLen(cp) - handLen(pp);
    if (handDelta < 0) {
      parts.push(`打出 ${-handDelta} 张手牌`);
    } else if (handDelta > 0) {
      parts.push(`抽 ${handDelta} 张牌`);
    }
    const diceLen = (s: MaybeState) =>
      (s.players?.[0]?.dice?.length ?? 0) +
      (s.players?.[1]?.dice?.length ?? 0);
    const diceDelta = diceLen(cp) - diceLen(pp);
    if (diceDelta !== 0) {
      parts.push(`骰子 ${diceDelta > 0 ? "+" : ""}${diceDelta}`);
    }
    // 谁挨了多少打、谁被击倒、抽到了哪张牌
    type CharLike = {
      health?: number;
      definitionId?: number;
      definition?: { id?: number };
    };
    type PlayerLike = {
      handCard?: { definitionId?: number }[];
      character?: (CharLike | null)[];
    };
    type StateLike = { players?: PlayerLike[] };
    const cs2 = cur as unknown as StateLike;
    const ps2 = prev as unknown as StateLike;
    const charName = (c?: CharLike | null) => {
      const id = c?.definition?.id ?? c?.definitionId;
      return id ? (DEFAULT_ASSETS_MANAGER.getNameSync(id) ?? `#${id}`) : "角色";
    };
    for (let who = 0; who < 2; who++) {
      const before = ps2.players?.[who]?.character ?? [];
      const after = cs2.players?.[who]?.character ?? [];
      for (let k = 0; k < after.length; k++) {
        const from = before[k]?.health ?? 0;
        const to = after[k]?.health ?? 0;
        if (to < from) {
          parts.push(
            `${charName(after[k])} -${from - to} 血` +
              (to <= 0 ? "（被击倒）" : `（剩 ${to}）`),
          );
        }
      }
      const hadIds = new Set(
        (ps2.players?.[who]?.handCard ?? []).map((c) => c.definitionId),
      );
      const drawn = (cs2.players?.[who]?.handCard ?? []).filter(
        (c) => c.definitionId && !hadIds.has(c.definitionId),
      );
      if (drawn.length > 0) {
        parts.push(
          `${who === 0 ? "先手" : "后手"}抽到「${drawn
            .map((c) => DEFAULT_ASSETS_MANAGER.getNameSync(c.definitionId!) ?? "?")
            .join("」「")}」`,
        );
      }
    }
    if (parts.length === 1) {
      parts.push(`回合 ${cur.roundNumber} · ${phaseLabel(cur.phase)}`);
    }
    return parts.join(" · ");
  };

  const phaseLabel = (phase: string) =>
    ({
      initHands: "开局换牌",
      initActives: "选择出战角色",
      roll: "掷骰阶段",
      action: "行动阶段",
      end: "结束阶段",
      gameEnd: "对局结束",
    })[phase] ?? phase;
  const statusLine = (who: 0 | 1) => {
    const state = viewingState()?.state;
    if (!state) {
      return "";
    }
    const player = state.players[who];
    const characters = player.characters
      .filter(
        (character): character is NonNullable<typeof character> =>
          character !== null,
      )
      .map(
        (character) =>
          `${getNameSync("CHS", character.definition.id) ?? character.definition.id} ${character.variables.health}/${character.variables.maxHealth}`,
      )
      .join("、");
    return `${who === 0 ? "先手" : "后手"}：${characters} · 骰${player.dice.length} · 手${player.hands.length} · 牌堆${player.pile.length}`;
  };
  const enableLog = () => {
    setViewingWho(1);
    showLogIndex(stateLog().length - 1);
  };
  const maxLogIndex = () => {
    return stateLog().length - (fromImport() ? 1 : 2);
  };

  let autoTimer = 0;
  const startAutoTimer = () => {
    window.clearInterval(autoTimer);
    autoTimer = window.setInterval(() => {
      setViewingLogIndex((index) => {
        if (index >= maxLogIndex()) {
          window.clearInterval(autoTimer);
          setAutoPlay(false);
          return index;
        }
        return index + 1;
      });
    }, 800 / autoSpeed());
  };
  const toggleAutoPlay = () => {
    if (autoPlay()) {
      window.clearInterval(autoTimer);
      setAutoPlay(false);
      return;
    }
    if (viewingLogIndex() >= maxLogIndex()) {
      setViewingLogIndex(0);
    }
    setAutoPlay(true);
    startAutoTimer();
  };
  const restartReplay = () => {
    window.clearInterval(autoTimer);
    setAutoPlay(false);
    setViewingLogIndex(0);
  };
  const changeSpeed = (value: number) => {
    setAutoSpeed(value);
    if (autoPlay()) {
      startAutoTimer();
    }
  };

  const exportLog = () => {
    const logs = serializeGameStateLog(stateLog());
    const blob = new Blob([JSON.stringify({ ...logs, gv: props.version })], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gameLog.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  let game: Game | null = null;
  const pause = async (
    state: GameState,
    mutations: unknown,
    canResume: boolean,
  ) => {
    if (game !== null) {
      setStateLog((logs) => [...logs, { state, canResume }]);
      setDetailRanges((ranges) => [...ranges, game?.detailLog.length ?? 0]);
      if (!canResume) {
        // 对局结束帧：立即写缓存日志（不等页面退出，避免中途返回漏记）
        recordCacheLog();
      }
      // 深拷贝：历史块是同一个数组引用，不拷贝的话每一帧都会变成最终内容
      setFrameHistory((frames) => [
        ...frames,
        JSON.parse(
          JSON.stringify(uiIo.getHistoryBlocks?.() ?? []),
        ) as unknown[],
      ]);
      setFrameMutations((frames) => [
        ...frames,
        Array.isArray(mutations) ? (mutations as unknown[]) : [],
      ]);
    }
  };

  const onGameError = (e: unknown, from?: Game) => {
    if (!from || from === game) {
      const merged = mergeErrorCause(e);
      console.error(merged);
      alert(
        `游戏出现了内部错误！请点击主窗口下方“导出日志”按钮生成日志文件，并反馈至 GitHub Issue，thanks~\n${merged.message}\n${merged.stack}`,
      );
    }
  };

  let searchClient: SearchClient | null = null;
  const getSearchClient = () => (searchClient ??= new SearchClient());
  let lastPonderAt = 0;

  const styleFor = (deck: Deck) => {
    const pref = props.aiStylePref ?? "auto";
    if (pref === "auto") {
      return styleOfDeck(deck);
    }
    if (pref === "random") {
      return "random" as const;
    }
    if (pref === "none") {
      return "midrange" as const;
    }
    return pref;
  };
  // 模拟器使用自己的那份 AI 设置（与实验室、牌组库训练互不干扰）
  const readAiSettings = () => loadAiSettings("sim");

  /**
   * 本地对局经验 → 单卡先验：胜率高于 50% 的牌轻微加权，低于的轻微减权。
   * 幅度限制在 ±0.25，避免几局样本把评分带偏。
   */
  const cardPriorsFromLearning = () => {
    const learning = loadLearning();
    if (!learning) {
      return undefined;
    }
    const priors = new Map<number, number>();
    for (const [rawId, entry] of Object.entries(learning.cards ?? {})) {
      const games = (entry.games ?? 0) - (entry.draws ?? 0);
      if (games < 6) {
        continue;
      }
      const rate = (entry.wins ?? 0) / games;
      const bonus = Math.max(-0.25, Math.min(0.25, (rate - 0.5) * 0.8));
      priors.set(Number(rawId), bonus);
    }
    return priors.size > 0 ? priors : undefined;
  };
  const createAiFor = (who: 0 | 1, game: Game, deck: Deck) => {
    const saved = readAiSettings();
    return createAi({
      who,
      style: saved?.style === "random" ? "random" : (saved?.style ?? styleFor(deck)),
      blunderRate: saved?.blunderRate ?? props.aiBlunderRate ?? 0,
      weights: (saved.weights ?? props.aiWeights) as never,
      cardPriors: cardPriorsFromLearning(),
      // 开搜索时，思考时间已经由搜索预算承担，不再叠加人为延时
      delayMs: saved?.delayMs ?? (props.aiThinking ? 0 : (props.aiDelayMs ?? 700)),
      name: who === CHILD_WHO ? "AI·先手" : "AI·后手",
      // 让评分能分辨"只能打破的盾"和"会自己到期的盾"
      data: getData(props.version),
      log: import.meta.env.DEV ? console.debug : undefined,
      selectAction: props.aiThinking
        ? async (request, context) => {
            const outcome = await searchParallel({
              version: props.version,
              who,
              budgetMs: props.aiThinkBudgetMs ?? 8000,
              valueMode: aiValueMode(),
              nnEnabled: aiNnEnabled(),
              stateLog: JSON.stringify(
                serializeGameStateLog([{ state: game.state, canResume: true }]),
              ),
              request,
              perfectInformation: props.aiPerfectInfo,
              heuristicScores: Object.fromEntries(
                context.heuristicScores.map((entry) => [entry.index, entry.score]),
              ),
            });
            return outcome
              ? {
                  chosenActionIndex: outcome.chosenActionIndex,
                  usedDice: outcome.usedDice,
                }
              : null;
          }
        : undefined,
    });
  };

  /** 现场自组出来的牌必须先过组牌器规则 + 引擎校验，不合法就重抽/回退 */
  const ensureLegalAiDeck = async (candidate: Deck, deckData: Awaited<ReturnType<typeof DEFAULT_ASSETS_MANAGER.getDeckData>>) => {
    const { validateDeck: validateByEngine } = await import("@gi-tcg/ai");
    const { validateDeckRules } = await import("./deck-rules");
    const check = (deck: Deck) => {
      const localErrors = validateDeckRules({ characters: deck.characters, cards: deck.cards });
      const engineErrors = validateByEngine(deck as never, deckData).errors;
      return [...localErrors, ...engineErrors];
    };
    if (check(candidate).length === 0) {
      return candidate;
    }
    return null;
  };

  const createGame = async (state?: GameState) => {
    if (!state) {
      // 现场自组：一半概率直接取「对局日志牌组池」里的高分牌组（利用），一半概率现组（探索）
      let libraryPick: { characters: number[]; cards: number[] } | null = null;
      if (playMode() !== "pvp" && props.aiBuildsDeck && Math.random() < 0.5) {
        try {
          const res = await fetch("/data/ai-deck-pool.json");
          const pool = (await res.json()) as { c: number[]; k: number[]; w: number }[];
          if (Array.isArray(pool) && pool.length > 0) {
            // 按权重偏向高胜率，但不完全固定
            const weights = pool.map((item) => Math.max(0.05, item.w - 0.45));
            const total = weights.reduce((a, b) => a + b, 0);
            let roll = Math.random() * total;
            const picked = pool.findIndex((_, i) => {
              roll -= weights[i];
              return roll <= 0;
            });
            const item = pool[picked >= 0 ? picked : 0];
            libraryPick = { characters: [...item.c], cards: [...item.k] };
          }
        } catch {
          libraryPick = null;
        }
      }

      let deck0: Deck;
      if (playMode() !== "pvp" && props.aiBuildsDeck) {
        const deckData = await DEFAULT_ASSETS_MANAGER.getDeckData();
        const buildOnce = () =>
          libraryPick ??
          buildDeck({
            deckData,
            seed: Math.floor(Math.random() * 1e9),
            cardWeights: (() => {
              const learning = loadLearning();
              return learning ? cardWeights(learning) : undefined;
            })(),
            characterWeights: (() => {
              const learning = loadLearning();
              return learning ? characterWeights(learning) : undefined;
            })(),
            deckWinRates: (() => {
              const learning = loadLearning();
              if (!learning) return undefined;
              return new Map(
                Object.entries(learning.decks).map(([key, record]) => [
                  key,
                  (record.wins + 1) / (record.games + 2),
                ]),
              );
            })(),
            deckStrength: props.aiDeckStrength ?? "strong",
            log: import.meta.env.DEV ? console.debug : undefined,
          });
        // 组牌器规则 + 引擎校验，不合法就重抽；实在不行回退到玩家给的牌组
        let legal: Deck | null = null;
        for (let attempt = 0; attempt < 5 && !legal; attempt++) {
          legal = await ensureLegalAiDeck(buildOnce(), deckData);
        }
        deck0 = legal ?? DEFAULT_ASSETS_MANAGER.decode(props.deck0);
        // 出码前统一成规范顺序（天赋→装备→支援→事件→料理），和游戏内导出一致
        deck0 = {
          characters: [...deck0.characters],
          cards: sortCardsForShare(deck0.cards, (id) => deckData.actionCards.get(id)),
        };
      } else {
        deck0 = DEFAULT_ASSETS_MANAGER.decode(props.deck0);
      }
      if (playMode() !== "pvp" && props.aiBuildsDeck) {
        setAiDeckCode(DEFAULT_ASSETS_MANAGER.encode(deck0));
        // 现场自组的牌组同步进牌组库（来源：自添加）；同一套只留一份
        try {
          const KEY = "gi-tcg-user-decks-v1";
          const stored: Array<{ chars: number[]; cards: number[] }> = JSON.parse(
            localStorage.getItem(KEY) ?? "[]",
          );
          const fp = `${[...deck0.characters].sort((a, b) => a - b).join(",")}|${[...deck0.cards]
            .sort((a, b) => a - b)
            .join(",")}`;
          const exists = Array.isArray(stored)
            ? stored.some(
                (item) =>
                  `${[...item.chars].sort((a, b) => a - b).join(",")}|${[...item.cards]
                    .sort((a, b) => a - b)
                    .join(",")}` === fp,
              )
            : false;
          if (!exists) {
            const list = Array.isArray(stored) ? stored : [];
            list.unshift({
              id: `ai-built-${Date.now().toString(36)}`,
              code: DEFAULT_ASSETS_MANAGER.encode(deck0),
              chars: [...deck0.characters],
              cards: [...deck0.cards],
              title: `AI 自组 · ${new Date().toLocaleDateString("zh-CN")}`,
              tags: ["AI 自组"],
              elements: [],
              nations: [],
              weapons: [],
              tier: "?",
              style: "midrange",
              source: "ai-built",
              popularity: 1,
              winRate: 0.5,
              rawWinRate: 0.5,
              games: 0,
              author: null,
              note: "模拟器里勾选「AI 牌组现场自组」后由 AI 自动组出",
              createdAt: Math.floor(Date.now() / 1000),
              authorTags: ["AI 自组"],
              role: "AI 自组",
              guide: {
                open: "还没训练过，先按费用曲线打。",
                mid: "中期看核心角色能否站住。",
                watch: "可以到牌组详情里点「训练这套牌」补样本。",
                weak: "未知。",
                verdict: "AI 现场自组的牌组，战绩随训练累积。",
              },
              guideSource: "ai-built",
              counters: [],
              counteredBy: [],
            } as never);
            localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
          }
        } catch {
          // 存储不可用时不影响开局
        }
      }
      const deck1 = DEFAULT_ASSETS_MANAGER.decode(props.deck1);
      lastDecks = [deck0, deck1];
      setDecksForAvatar([deck0, deck1]);
      setTravelerAvatar(Math.random() < 0.5 ? "lumine" : "aether");
      state = Game.createInitialState({
        decks: [deck0, deck1],
        data: getData(props.version),
        versionBehavior: props.version,
      });
      // 默认 player 0（AI）先手；想让玩家先手时把先手权交给 player 1
      if (props.aiGoesFirst === false) {
        (state as { currentTurn: 0 | 1 }).currentTurn = PARENT_WHO;
      }
    }
    await setAsyncContext(true);
    const game = new Game(state);
    (window as any).theGame = game;
    game.onPause = pause;
    game.players[PARENT_WHO].io = uiIo;
    if (playMode() === "pvp") {
      game.players[CHILD_WHO].io = childIo;
    } else {
      const withPonder = (ai: ReturnType<typeof createAiFor>, who: 0 | 1) => ({
        notify: (notification: { state?: { currentTurn: number } }) => {
          ai.notify(notification as never);
          if (!props.aiThinking || playMode() !== "ai") {
            return;
          }
          const state = notification.state;
          // 对手（人类）回合时，用等待时间估算当前胜率
          if (!state || state.currentTurn === who) {
            return;
          }
          const now = Date.now();
          if (now - lastPonderAt < 4000) {
            return;
          }
          lastPonderAt = now;
          void getSearchClient()
            .ponder({
              version: props.version,
              who,
              budgetMs: 2500,
              valueMode: aiValueMode(),
              nnEnabled: aiNnEnabled(),
              perfectInformation: props.aiPerfectInfo,
              stateLog: JSON.stringify(
                serializeGameStateLog([{ state: game.state, canResume: true }]),
              ),
            })
            .then((estimate) => {
              if (estimate !== null) {
                setAiWinRate(estimate);
              }
            });
        },
        rpc: (request: Parameters<typeof ai.rpc>[0]) => ai.rpc(request),
      });

      const aiDeck = lastDecks?.[CHILD_WHO] ?? { characters: [], cards: [] };
      game.players[CHILD_WHO].io = withPonder(
        createAiFor(CHILD_WHO, game, aiDeck),
        CHILD_WHO,
      );
      if (playMode() === "aiai") {
        // 后手方也是 AI；顺便把通知转给棋盘，让人类能观战
        const secondAi = createAiFor(
          PARENT_WHO,
          game,
          lastDecks?.[PARENT_WHO] ?? { characters: [], cards: [] },
        );
        game.players[PARENT_WHO].io = {
          notify: (notification) => {
            secondAi.notify(notification);
            uiIo.notify(notification);
          },
          rpc: (request) => secondAi.rpc(request),
        };
      }
    }
    return game;
  };

  const startGame = async () => {
    try {
      if (playMode() === "pvp") {
        await showPopup();
      }
      const initialGame = await createGame();
      game = initialGame;
      setOrientation("landscape");
      initialGame
        .start()
        .then((winner) => {
          if (playMode() !== "pvp" && lastDecks) {
            // 人机/机机对局结果也记进长期对局日志
            const learning = loadLearning() ?? createLearning();
            recordGame(learning, lastDecks, winner);
            saveLearning(learning);
          }
          if (playMode() === "aiai") {
            setRecords((previous) => [
              ...previous,
              {
                index: previous.length + 1,
                deck0: aiDeckCode() ?? props.deck0,
                deck1: props.deck1,
                winner,
                rounds: initialGame.state.roundNumber,
                at: Date.now(),
                stateLog: serializeGameStateLog(stateLog()),
                detailLog: initialGame.detailLog,
              },
            ]);
          }
          return winner;
        })
        .catch((e) => onGameError(e, initialGame));
    } catch (e) {
      onGameError(e);
    }
  };

  const resumeGame = async () => {
    if (playMode() === "pvp") {
      await showPopup();
    }
    const logs = stateLog().slice(0, viewingLogIndex() + 1);
    childIo.cancelRpc?.();
    uiIo.cancelRpc?.();
    game?.terminate();
    const latestState = logs[logs.length - 1];
    if (!latestState?.state) {
      return;
    }
    // 带快照进来时 lastDecks 还是空的，AI 会拿到空牌组；按场上信息补一份
    if (!lastDecks) {
      const build = (player: (typeof latestState.state.players)[number]): Deck => ({
        characters: player.characters.map((character) => character.id),
        cards: [...player.hands, ...player.pile].map((card) => card.definition.id),
      });
      const rebuilt: [Deck, Deck] = [
        build(latestState.state.players[PARENT_WHO]),
        build(latestState.state.players[CHILD_WHO]),
      ];
      lastDecks = rebuilt;
      setDecksForAvatar(rebuilt);
    }
    const newGame = await createGame(latestState.state);
    game = newGame;
    newGame.start().catch((e) => onGameError(e, newGame));
    setStateLog(logs);
    showLogIndex(-1);
    setFromImport(false);
  };

  const exportRecords = () => {
    const lines = records().map((record) => JSON.stringify(record)).join("\n");
    const blob = new Blob([lines], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-games-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const childGiveUpHandler = (e: MessageEvent) => {
    const { data } = e;
    if (typeof data !== "object" || data === null) {
      return;
    }
    if (data.giTcg !== "1.0") {
      return;
    }
    if (!("method" in data)) {
      return;
    }
    if (data.method === "giveUp") {
      game?.giveUp(CHILD_WHO);
    }
  };
  let detailDialog!: HTMLDialogElement;
  const [detailLog, setDetailLog] = createSignal<readonly DetailLogEntry[]>([]);
  const showDetail = () => {
    setDetailLog(
      fromImport() ? (props.importedDetailLog ?? []) : (game?.detailLog ?? []),
    );
    detailDialog.showModal();
    detailDialog.scrollIntoView({ block: "end" });
  };
  const closeDetail = () => {
    detailDialog.close();
    setDetailLog([]);
  };

  // 打过的对局写进实验室同一套缓存日志，方便之后回放；
  // 摆盘器快照局复用导入通道但也是真实对局，同样要写缓存。
  // 写在 pagehide：历史后退走 bfcache 不会卸载组件，onCleanup 不触发。
  let cacheRecorded = false;
  const recordCacheLog = () => {
    if (cacheRecorded) {
      return;
    }
    if ((!fromImport() || props.autoStartFromSnapshot) && stateLog().length > 1) {
      cacheRecorded = true;
      try {
        // 引擎在结束后不再回调 pause，这里手动补最后一帧（含胜负），否则回放少了结局
        const logged = stateLog();
        const finalState = game?.state;
        const logs =
          finalState && logged[logged.length - 1]?.state !== finalState
            ? [...logged, { state: finalState, canResume: false }]
            : logged;
        writeCacheLog(
          `sim-${playMode()}-${Date.now()}.json`,
          JSON.stringify({
            kind: "gi-tcg-game-log-bundle",
            version: "7.2.0",
            deckCode: "",
            mode: playMode(),
            games: [
              {
                index: 1,
                winner: null,
                rounds: logs[logs.length - 1].state.roundNumber,
                stateLog: JSON.stringify({
                  ...serializeGameStateLog(logs),
                  gv: props.version,
                }),
                detailLog: game?.detailLog ?? [],
                detailRanges: detailRanges(),
                frameMutations: frameMutations(),
                historyBlocks: JSON.parse(
                  JSON.stringify(uiIo.getHistoryBlocks?.() ?? []),
                ) as unknown[],
                frameHistory: frameHistory(),
              },
            ],
          }),
        );
      } catch (error) {
        console.error(error);
      }
    }
  };

  // 页面每次离开时都尝试写缓存（bfcache / 卸载 / 关闭都能触发）
  window.addEventListener("pagehide", recordCacheLog);
  onCleanup(() => {
    searchClient?.terminate();
    window.clearInterval(autoTimer);
    document.body.classList.remove("replaying");
    recordCacheLog();
    window.removeEventListener("pagehide", recordCacheLog);
  });

  onSettled(() => {
    document.body.classList.add("game-active");
    // 布局方案：20:9 屏幕专用回滚——始终用 0.11.121 布局（classic），
    // 设置里的三个选项在 20:9 下不生效；其他比例默认锚点偏移，stretch/anchor
    // 各自生效，显式 classic 或未知值回落 classic。
    const resolveLayoutMode = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (Math.abs(vw / vh - 20 / 9) < 0.03) {
        return "classic";
      }
      const stored = localStorage.getItem("gitcg.gameLayout");
      return stored === "stretch" || stored === "anchor"
        ? stored
        : stored === null
          ? "anchor"
          : "classic";
    };
    const applyLayoutMode = () => {
      const mode = resolveLayoutMode();
      const twentyToNine =
        Math.abs(window.innerWidth / window.innerHeight - 20 / 9) < 0.03;
      document.body.dataset.gameLayout = mode;
      setLayoutMode(mode);
      // 宽屏棋盘：锚点模式或 20:9 专用回滚（与配置页开局一致的新背景 + 全幅盒子）
      (window as { __WIDE_BOARD__?: boolean }).__WIDE_BOARD__ =
        mode === "anchor" || (mode === "classic" && twentyToNine);
      // 20:9 时通知 layout.ts 用 0.11.121 原始坐标
      (window as { __GI_CLASSIC_20X9__?: boolean }).__GI_CLASSIC_20X9__ =
        mode === "classic" && twentyToNine;
      return mode;
    };
    applyLayoutMode();

    // 相对定位系统：用 2400×1080 设计基准换算出舞台缩放与十字中心偏移
    const syncLayout = () => {
      applyLayoutMode();
      const ctx = createContext(window.innerWidth, window.innerHeight);
      applyLayoutVars(ctx);
      // HUD 锚定在 20:9 舞台的右上角：距舞台边 12px/8px，按舞台缩放同比放大
      const stage = stageRect(ctx);
      const root = document.documentElement;
      root.style.setProperty("--gi-hud-top", `${stage.y + 8 * ctx.scale}px`);
      root.style.setProperty(
        "--gi-hud-right",
        `${ctx.vw - (stage.x + stage.w) + 12 * ctx.scale}px`,
      );
      // HUD 也走锚点计算：右上角距舞台边 12/8 设计像素
      const hud = HUD_ANCHOR;
      const hudRect = place(
        { ...hud, dx: hud.dx, dy: hud.dy },
        ctx,
      );
      root.style.setProperty("--gi-anchor-hud-x", `${hudRect.x}px`);
      root.style.setProperty("--gi-anchor-hud-y", `${hudRect.y}px`);
      // 铺满模式不使用虚拟尺寸：虚拟宽高与真实容器单位不一致会把内容挤偏，
      // 改为保持真实尺寸、只让棋盘填满窗口（等比由根字号控制）。
      delete (window as { __GI_VIRTUAL_SIZE?: unknown }).__GI_VIRTUAL_SIZE;
      // 锚点模式不再改根字号：等比缩放与十字中心偏移由
      // TransformWrapper + layout.ts 的 spread 机制负责。
      root.style.removeProperty("font-size");
      root.style.setProperty("--gi-stretch-x", "1");
      root.style.setProperty(
        "--gi-stretch-y",
        String(ctx.vh / Math.max(1, (ctx.vw * 9) / 20)),
      );
      // 棋盘可能比 onSettled 更晚挂载：重试几次，确保样式一定写上
      if (new URLSearchParams(location.search).get("debugLayout") === "1") {
        mountLayoutDebug(ctx);
      }
      if (new URLSearchParams(location.search).get("dumpLayout") === "1") {
        setTimeout(() => {
          dumpLayout(ctx);
          const all = dumpAllAnchors(ctx);
          console.info("[gi-layout-all]", JSON.stringify(all));
        }, 1500);
      }
    };
    syncLayout();
    window.addEventListener("resize", syncLayout);
    window.addEventListener("orientationchange", syncLayout);

    const closePopup = () => popupWindow()?.close();
    window.addEventListener("beforeunload", closePopup);
    window.addEventListener("message", childGiveUpHandler);
    if (Array.isArray(props.logs)) {
      setStateLog(props.logs);
      showLogIndex(0);
      setFromImport(true);
      if (props.autoStartFromSnapshot) {
        // 摆盘器快照：直接开局（布局与配置页开局一致），不进回放
        queueMicrotask(() => void resumeGame());
      }
    } else {
      startGame();
    }
    return () => {
      window.removeEventListener("resize", syncLayout);
      window.removeEventListener("orientationchange", syncLayout);
      document.body.classList.remove("game-active");
      window.removeEventListener("beforeunload", closePopup);
      window.removeEventListener("message", childGiveUpHandler);
    };
  });

  return (
    <>
      <div class="standalone-board-shell">
      <Show
        when={viewingState()}
        fallback={
          <>
            <div class="title-row">
              <span class="title">
                {playMode() === "pvp"
                  ? "后手方棋盘"
                  : playMode() === "ai"
                    ? "你的棋盘（对手：AI）"
                    : "观战：AI vs AI"}
              </span>
              <Show when={aiWinRate() !== null && playMode() === "ai"}>
                <span class="record-count">
                  AI 后台评估：{Math.round((aiWinRate() ?? 0) * 100)}% 胜率
                </span>
              </Show>
              <button disabled={stateLog().length <= 1} onClick={enableLog}>
                查看历史
              </button>
              <Show when={records().length > 0}>
                <span class="record-count">已记录 {records().length} 局</span>
                <button onClick={exportRecords}>导出记录</button>
              </Show>
            </div>
            <Show when={aiDeckCode()}>
              {(code) => (
                <div class="ai-deck-code">
                  AI 自组牌组码：<code>{code()}</code>
                </div>
              )}
            </Show>
            <div class="gi-stage">
            <Chessboard
              spectatorMode={playMode() === "aiai"}
              spread={layoutMode() === "anchor" && playMode() !== "pvp"}
              myPlayerInfo={{
                name: playMode() === "aiai" ? "AI" : "旅行者",
                avatarUrl: avatarUrl(1),
              }}
              oppPlayerInfo={{ name: "AI", avatarUrl: avatarUrl(0) }}
              gameEndExtra={
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    "margin-top": "0.5rem",
                  }}
                >
                  <button
                    style={{
                      padding: "0.5rem 1.5rem",
                      "border-radius": "999px",
                      background: "#f5e6c8",
                      color: "#4a3a1a",
                      "font-weight": "bold",
                    }}
                    onClick={() => void restartGame()}
                  >
                    再来一局
                  </button>
                  <button
                    style={{
                      padding: "0.5rem 1.5rem",
                      "border-radius": "999px",
                      background: "transparent",
                      color: "#e8dcc0",
                      border: "1px solid #e8dcc0",
                    }}
                    onClick={exitToHome}
                  >
                    返回配置
                  </button>
                </div>
              }
            />
            </div>
          </>
        }
      >
        {(state) => (
          <>
            <div class="title-row replay-toolbar" data-collapsed={toolbarCollapsed() ? "true" : undefined}>
              <button
                class="toolbar-toggle"
                title={toolbarCollapsed() ? "展开工具条" : "收起工具条"}
                onClick={() => setToolbarCollapsed((value) => !value)}
              >
                {toolbarCollapsed() ? "展开" : "收起"}
              </button>
              <span class="title">
                {viewingWho() ? "后手" : "先手"}回放
              </span>
              <Show when={!fromImport()}>
                <Show
                  when={viewingLogIndex() <= maxLogIndex() && state().canResume}
                >
                  <button onClick={resumeGame}>从此处继续</button>
                </Show>
              </Show>
              <button
                title="切换玩家"
                onClick={() => setViewingWho((i) => (1 - i) as 0 | 1)}
              >
                ⇄
              </button>
              <Show
                when={stateLog().length > 1}
                fallback={<span class="replay-warning">该日志只有结果（旧版导出），请在实验室「对局详情」重新生成</span>}
              >
                <button title="从头播放" onClick={restartReplay}>
                  ⏮
                </button>
                <button
                  title="后退一步"
                  disabled={viewingLogIndex() <= 0}
                  onClick={() => setViewingLogIndex((i) => i - 1)}
                >
                  ‹
                </button>
                <input
                  class="replay-slider"
                  type="range"
                  min="0"
                  max={maxLogIndex()}
                  value={viewingLogIndex()}
                  onInput={(e) => {
                    window.clearInterval(autoTimer);
                    setAutoPlay(false);
                    setViewingLogIndex(Number(e.currentTarget.value));
                  }}
                />
                <span>
                  {viewingLogIndex() + 1} / {stateLog().length} · 回合 {state().state.roundNumber}
                </span>
                <button
                  title="前进一步"
                  disabled={viewingLogIndex() >= maxLogIndex()}
                  onClick={() => setViewingLogIndex((i) => i + 1)}
                >
                  ›
                </button>
                <button
                  title={autoPlay() ? "暂停" : "自动播放"}
                  onClick={toggleAutoPlay}
                >
                  {autoPlay() ? "⏸" : "▶"}
                </button>
                <select
                  value={autoSpeed()}
                  onChange={(e) => changeSpeed(Number(e.currentTarget.value))}
                >
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="4">4x</option>
                </select>
                <Show when={!fromImport()}>
                  <button title="返回游戏" onClick={() => showLogIndex(-1)}>
                    ↩
                  </button>
                </Show>
              </Show>
              <button title="对局日志" onClick={showDetail}>
                📜
              </button>
              <button title="退出回放，返回配置" onClick={exitToHome}>
                ✕
              </button>
            </div>
            <div class="gi-stage">
            <StandaloneChessboard
              who={viewingWho()}
              state={exposeState(viewingWho(), state().state)}
              mutations={
                (frameMutations()[viewingLogIndex()] ?? []) as never
              }
              historyBlocks={
                (frameHistory()[viewingLogIndex()] ??
                  props.initialHistoryBlocks ??
                  []) as never
              }
            />
            </div>
          </>
        )}
      </Show>
      <button disabled={stateLog().length === 0} onClick={exportLog}>
        导出日志
      </button>
      <button onClick={showDetail}>显示细节</button>
      <dialog ref={detailDialog!} class="replay-detail-dialog">
        <div class="replay-dialog-head">
          <div class="replay-state-panel">
            <div>
              回合 {viewingState()?.state.roundNumber} · 阶段{" "}
              {phaseLabel(viewingState()?.state.phase ?? "")} · 当前{" "}
              {viewingState()?.state.currentTurn === 0 ? "先手" : "后手"}
            </div>
            <div>{statusLine(0)}</div>
            <div>{statusLine(1)}</div>
            <div class="replay-state-tip">点日志文字跳到那一步</div>
          </div>
          <button class="replay-dialog-x" onClick={closeDetail} title="关闭">
            ✕
          </button>
        </div>
        <div class="replay-log-scroll">
          <Show
            when={detailLog().length > 0}
            fallback={
              <div class="replay-state-log">
                <For each={stateLog()}>
                  {(entry, i) => (
                    <button
                      class="replay-state-log-line"
                      onClick={() => {
                        showLogIndex(i());
                        closeDetail();
                      }}
                    >
                      {describeStep(i())}
                    </button>
                  )}
                </For>
              </div>
            }
          >
            <DetailLogViewer
              logs={detailLog()}
              onSeek={(index: number) => {
                showLogIndex(Math.min(index, maxLogIndex()));
                closeDetail();
              }}
            />
          </Show>
        </div>
        <button class="replay-dialog-bottom" onClick={closeDetail}>
          关闭
        </button>
      </dialog>
      </div>
    </>
  );
}
