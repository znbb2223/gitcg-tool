import { For, Show, createSignal, onSettled } from "solid-js";
import { render } from "@solidjs/web";
import {
  AURA_OPTIONS,
  DICE_OPTIONS,
  GameStateEditor,
  buildEditorCatalog,
  validateGameState,
} from "@gi-tcg/state-editor";
import {
  Game,
  deserializeGameStateLog,
  serializeGameStateLog,
  type GameState,
} from "@gi-tcg/core";
import getData from "@gi-tcg/data";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import "@gi-tcg/state-editor/style.css";
import "./style.css";
import "./state-editor.css";

const INIT_DECK0 =
  "FZDByRUNGRCB0WoNFlGgWpEPE0AB9TAPFGCB9kgWGIERCoEQDLFADcQQDPFgacYWDJAA";
const INIT_DECK1 =
  "FdHxNj8TAWDQxFkMFkAhyWIYCYDA45wOCUDQ5J0PGEAh9IIPGWDh9p4YC6FgirYRCxAA";

const pickOne = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)];

const randomInt = (max: number) => Math.floor(Math.random() * max);

interface RandomDeck {
  c: readonly number[];
  k: readonly number[];
}

let deckPool: RandomDeck[] | null = null;

/** 轻量牌组池：public/data/random-decks.json（600 套，约 140KB） */
async function loadDeckPool(): Promise<RandomDeck[]> {
  if (deckPool) {
    return deckPool;
  }
  try {
    const res = await fetch("/data/random-decks.json");
    const list = (await res.json()) as RandomDeck[];
    if (Array.isArray(list) && list.length > 0) {
      deckPool = list;
      return list;
    }
  } catch {
    // 下载不到就退回内置两套
  }
  deckPool = [
    { c: DEFAULT_ASSETS_MANAGER.decode(INIT_DECK0).characters, k: DEFAULT_ASSETS_MANAGER.decode(INIT_DECK0).cards },
    { c: DEFAULT_ASSETS_MANAGER.decode(INIT_DECK1).characters, k: DEFAULT_ASSETS_MANAGER.decode(INIT_DECK1).cards },
  ];
  return deckPool;
}

/** 把局面随机化：回合、阶段、行动方、骰子、手牌、支援、血量、充能、出战角色、附着 */
function randomizeState(state: GameState) {
  const draft = state as unknown as {
    roundNumber: number;
    phase: string;
    currentTurn: 0 | 1;
    players: {
      activeCharacterId: number;
      dice: number[];
      hands: unknown[];
      pile: { definition: { type?: string } }[];
      supports: unknown[];
      characters: {
        id: number;
        variables: Record<string, number>;
      }[];
    }[];
  };
  draft.roundNumber = 1 + randomInt(8);
  draft.phase = pickOne(["roll", "action", "end"] as const);
  draft.currentTurn = randomInt(2) as 0 | 1;
  for (const player of draft.players) {
    player.dice = Array.from({ length: randomInt(13) }, () => pickOne(DICE_OPTIONS) as number);

    const handCount = randomInt(9);
    for (let i = 0; i < handCount && player.pile.length > 0; i++) {
      player.hands.push(player.pile.splice(randomInt(player.pile.length), 1)[0]);
    }

    const supportCount = randomInt(4);
    for (let i = 0; i < supportCount; i++) {
      const index = player.pile.findIndex((card) => card.definition?.type === "GCG_CARD_ASSIST");
      if (index < 0) {
        break;
      }
      player.supports.push(player.pile.splice(index, 1)[0]);
    }

    for (const character of player.characters) {
      const maxHealth = character.variables.maxHealth ?? 10;
      const maxEnergy = character.variables.maxEnergy ?? 0;
      character.variables.health = Math.max(1, 1 + randomInt(maxHealth));
      character.variables.energy = maxEnergy > 0 ? randomInt(maxEnergy + 1) : 0;
      character.variables.aura = pickOne(AURA_OPTIONS);
    }

    player.activeCharacterId = pickOne(player.characters).id;
  }
}

/** 随机生成一套合法局面（校验不过就重来，最多 6 次） */
export async function createRandomState(version = "v7.2.0"): Promise<GameState> {
  const pool = await loadDeckPool();
  const data = getData(version as never);
  for (let attempt = 0; attempt < 6; attempt++) {
    const deckA = pickOne(pool);
    const deckB = pickOne(pool);
    const state = Game.createInitialState({
      decks: [
        { characters: [...deckA.c], cards: [...deckA.k] },
        { characters: [...deckB.c], cards: [...deckB.k] },
      ],
      data,
      versionBehavior: version as never,
    });
    randomizeState(state);
    const errors = validateGameState(state, buildEditorCatalog(state));
    if (errors.length === 0) {
      return state;
    }
    console.warn("随机局面不合法，重试：", errors.slice(0, 3));
  }
  // 兜底：用固定默认局面（一定合法）
  const deck0 = DEFAULT_ASSETS_MANAGER.decode(INIT_DECK0);
  const deck1 = DEFAULT_ASSETS_MANAGER.decode(INIT_DECK1);
  return Game.createInitialState({
    decks: [deck0, deck1],
    data,
    versionBehavior: version as never,
  });
}

function exportState(state: GameState) {
  // 用引擎自己的序列化（保留 Map / 符号），以后导入时能直接 deserialize
  const text = JSON.stringify(
    {
      kind: "gi-tcg-board-snapshot",
      version: "v7.2.0",
      snapshot: serializeGameStateLog([{ state, canResume: true }]),
    },
    null,
    2,
  );
  const name = `gi-tcg-board-${Date.now()}.json`;
  const host = (window as { AndroidHost?: { saveTextFile?: (n: string, t: string) => void } }).AndroidHost;
  if (host?.saveTextFile) {
    host.saveTextFile(name, text);
    alert(`已导出：${name}`);
    return;
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

type PlayMode = "ai" | "pvp" | "aiai";

const PLAY_MODES: { id: PlayMode; label: string; hint: string }[] = [
  { id: "ai", label: "人机对战", hint: "你 vs AI" },
  { id: "aiai", label: "机机对战", hint: "AI vs AI" },
];

const PHASE_TEXT: Record<string, string> = {
  roll: "掷骰阶段",
  action: "行动阶段",
  end: "结束阶段",
  initHands: "初始摸牌",
};

function StateEditorPage() {
  const [draft, setDraft] = createSignal<GameState | null>(null);
  const [playMode, setPlayMode] = createSignal<PlayMode>("ai");
  // 每次进入都随机生成一套合法局面；「重新随机」可换一副
  const [initial, setInitial] = createSignal<GameState | null>(null);
  const [seeding, setSeeding] = createSignal(true);

  /** 摆盘草稿：返回本页时恢复上次的盘面，而不是重新随机 */
  const DRAFT_KEY = "gi-tcg-editor-draft-v1";
  const persistDraft = (state: GameState) => {
    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          mode: playMode(),
          log: serializeGameStateLog([{ state, canResume: true }]),
        }),
      );
    } catch {
      // 存不下就忽略
    }
  };
  const restoreDraft = (): GameState | null => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as { mode?: PlayMode; log?: unknown };
      if (parsed.mode) {
        setPlayMode(parsed.mode);
      }
      const entries = deserializeGameStateLog(
        getData("v7.2.0" as never),
        parsed.log as never,
      );
      return entries[0]?.state ?? null;
    } catch {
      return null;
    }
  };

  // 系统返回键：完成页 → 回摆盘器首页（清草稿，不重新随机）；首页 → 交给系统（回工具首页）
  (window as { __dshBack?: () => string }).__dshBack = () => {
    if (draft()) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      setDraft(null);
      return "handled";
    }
    return "back";
  };

  const reroll = async () => {
    setSeeding(true);
    setDraft(null);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    const state = await createRandomState();
    setInitial(state);
    setSeeding(false);
  };

  const resetAll = async () => {
    if (!confirm("重置摆盘器？会清空手牌、牌库、骰子、角色与状态，回到第 1 回合的空白桌。")) {
      return;
    }
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem("gi-tcg-start-snapshot");
    } catch {
      // ignore
    }
    setDraft(null);
    setPlayMode("ai");
    setSeeding(true);
    const base = await createRandomState();
    // 最干净的状态：没有手牌/牌库/骰子/角色/召唤物/支援/状态，回合与阶段回到初始
    const state = base as unknown as {
      roundNumber: number;
      phase: string;
      currentTurn: number;
      winner: number | null;
      players: Array<Record<string, unknown>>;
    };
    state.roundNumber = 1;
    state.phase = "initHands";
    state.currentTurn = 0;
    state.winner = null;
    for (const player of state.players) {
      player.hands = [];
      player.pile = [];
      player.characters = [];
      player.dice = [];
      player.summons = [];
      player.supports = [];
      player.combatStatuses = [];
      player.activeCharacterId = 0;
      player.declaredEnd = false;
      player.hasDefeated = false;
      player.legendUsed = false;
    }
    setInitial(base);
    setDraft(null);
    setSeeding(false);
  };

  const onImportSnapshot = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as {
        kind?: string;
        snapshot?: unknown;
      };
      if (parsed.kind !== "gi-tcg-board-snapshot" || !parsed.snapshot) {
        throw new Error("不是摆盘快照文件");
      }
      const entries = deserializeGameStateLog(
        getData("v7.2.0" as never),
        parsed.snapshot as never,
      );
      const state = entries[0]?.state;
      if (!state) {
        throw new Error("快照里没有局面");
      }
      setInitial(state);
      setDraft(state);
      persistDraft(state);
      alert("快照已导入");
    } catch (error) {
      alert(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      input.value = "";
    }
  };

  onSettled(async () => {
    // 先准备好牌库/角色资源：否则角色选择器只有 ID、没有名字和头像
    try {
      await DEFAULT_ASSETS_MANAGER.getDeckData();
    } catch {
      // 资源失败也允许继续，名字会退回 #id
    }
    // 只有从对局返回（游戏退出时置位 gi-tcg-editor-resume）才恢复草稿；
    // 从首页进入时走正常的新局面（不直接跳摆盘完成页）
    let returning = false;
    try {
      returning = sessionStorage.getItem("gi-tcg-editor-resume") === "1";
      sessionStorage.removeItem("gi-tcg-editor-resume");
    } catch {
      // ignore
    }
    const saved = returning ? restoreDraft() : null;
    if (saved) {
      setInitial(saved);
      setDraft(saved);
      setSeeding(false);
      return;
    }
    void reroll();
  });

  const summary = () => {
    const state = draft();
    if (!state) {
      return "";
    }
    const [me, opp] = state.players;
    return `第 ${state.roundNumber} 回合 · ${PHASE_TEXT[state.phase] ?? state.phase} · 我方 ${me.hands.length} 手牌 / ${me.pile.length} 牌库 · 对手 ${opp.hands.length} / ${opp.pile.length}`;
  };

  const startGame = () => {
    const state = draft();
    if (!state) {
      return;
    }
    persistDraft(state);
    try {
      sessionStorage.setItem(
        "gi-tcg-start-snapshot",
        JSON.stringify({
          mode: playMode(),
          log: serializeGameStateLog([{ state, canResume: true }]),
        }),
      );
      location.href = "app.html";
    } catch (error) {
      alert(
        `快照传给模拟器失败：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <div class="state-editor-page">
      <Show
        when={initial()}
        keyed
        fallback={
          <div class="state-editor-loading">
            {seeding() ? "正在随机生成局面…" : "局面加载失败"}
          </div>
        }
      >
        {(state) => (
          <GameStateEditor
            initialValue={state}
            onSubmit={(next) => {
              setDraft(next);
              persistDraft(next);
            }}
          >
            <div class="editor-tools">
              <button class="editor-back-button" type="button" onClick={reroll}>
                🎲 重新随机
              </button>
              <button
                class="editor-back-button"
                type="button"
                onClick={() => document.getElementById("importSnapshotTop")?.click()}
              >
                导入快照
              </button>
              <button class="editor-back-button" type="button" onClick={() => void resetAll()}>
                ↺ 重置
              </button>
              <input
                id="importSnapshotTop"
                type="file"
                accept="application/json,.json"
                hidden
                onChange={onImportSnapshot}
              />
            </div>          </GameStateEditor>
        )}
      </Show>

      <Show when={draft()}>
        <div class="board-done">
          <div class="board-done__card">
            <h2>摆盘完成</h2>
            <p class="board-done__summary">{summary()}</p>

            <div class="board-done__modes">
              <For each={PLAY_MODES}>
                {(mode) => (
                  <button
                    type="button"
                    class="board-done__mode"
                    data-active={playMode() === mode.id ? "true" : undefined}
                    onClick={() => setPlayMode(mode.id)}
                  >
                    <b>{mode.label}</b>
                    <span>{mode.hint}</span>
                  </button>
                )}
              </For>
            </div>

            <div class="board-done__actions">
              <button type="button" onClick={() => setDraft(null)}>
                继续编辑
              </button>
              <button type="button" onClick={() => exportState(draft())}>
                保存快照
              </button>
              <button type="button" class="primary" onClick={startGame}>
                开始对局
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

render(() => <StateEditorPage />, document.getElementById("root")!);
