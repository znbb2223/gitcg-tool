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

import { For, Match, Show, Switch, createSignal } from "solid-js";
import getData from "@gi-tcg/data";
import {
  CURRENT_VERSION,
  GameStateLogEntry,
  Version,
  deserializeGameStateLog,
  VERSIONS,
  Deck,
  Game,
  GameState,
  DetailLogEntry,
} from "@gi-tcg/core";
import { StandaloneChild } from "./StandaloneChild";
import { StandaloneParent } from "./StandaloneParent";
import { IS_BETA, SERVER_HOST, WEB_CLIENT_BASE_PATH } from "@gi-tcg/config";
import { DeckBuilder } from "@gi-tcg/deck-builder";
import "@gi-tcg/deck-builder/style.css";
import "@gi-tcg/state-editor/style.css";
import { DEFAULT_ASSETS_MANAGER } from "@gi-tcg/assets-manager";
import { GameStateEditor } from "@gi-tcg/state-editor";
import { exportExperience, importExperience } from "./learning-storage";
import { pickTextFile, saveTextFile } from "./native";
import { DEFAULT_AI_WEIGHTS, GAME_VERSION, type AiWeights } from "@gi-tcg/ai";

enum GameMode {
  NotStarted = 0,
  Standalone = 1,
  Editor = 2,
}

/** 本地模拟的玩法：双人 / 人机 / 机机 */
type PlayMode = "pvp" | "ai" | "aiai";

/** 「本地双人」入口暂时关闭，相关对局代码保留，改回 true 即可恢复 */
const ENABLE_PVP = false;

type AiDifficulty = "easy" | "normal" | "hard" | "nightmare" | "hell" | "custom";

import { RANDOM_DECK_CODES } from "./data/random-deck-codes";
import { saveAiSettings } from "./ai-settings-store";
import { loadAiFlags } from "./ai-flags";

/** 每次进入从牌组库里随机挑两套预填（不做任何筛选） */
const pickRandomCode = (exclude?: string) => {
  const pool = RANDOM_DECK_CODES.filter((code) => code !== exclude);
  return pool[Math.floor(Math.random() * pool.length)] ?? RANDOM_DECK_CODES[0] ?? "";
};
const INIT_DECK0 = pickRandomCode();
const INIT_DECK1 = pickRandomCode(INIT_DECK0);

if (import.meta.env.DEV) {
  // Debug here!
}

export function App() {
  if (window.opener !== null) {
    // eslint-disable-next-line solid/components-return-once
    return <StandaloneChild />;
  }
  const [mode, setMode] = createSignal<GameMode>(GameMode.NotStarted);
  const [fromSnapshot, setFromSnapshot] = createSignal(false);
  const [logs, setLogs] = createSignal<GameStateLogEntry[]>();
  const [replayDetailLog, setReplayDetailLog] = createSignal<DetailLogEntry[]>([]);
  const [replayDetailRanges, setDetailRanges] = createSignal<number[]>([]);
  const [replayFrameMutations, setFrameMutations] = createSignal<unknown[][]>([]);
  const [replayHistoryBlocks, setHistoryBlocks] = createSignal<readonly unknown[]>([]);
  const [replayFrameHistory, setFrameHistory] = createSignal<unknown[][]>([]);
  const [deck0, setDeck0] = createSignal(INIT_DECK0);
  const [deck1, setDeck1] = createSignal(INIT_DECK1);
  const [version, setVersion] = createSignal<Version>(CURRENT_VERSION);
  const [playMode, setPlayMode] = createSignal<PlayMode>("ai");
  const [aiDelay, setAiDelay] = createSignal(700);
  const [aiBuildsDeck, setAiBuildsDeck] = createSignal(false);
  /** 搜索是否启用统一由「设置 → AI 推理组件」决定，面板不再单独开关 */
  const [aiThinkingVersion, setAiThinkingVersion] = createSignal(0);
  const aiThinking = () => {
    // 依赖版本号以便设置变化后重新求值
    aiThinkingVersion();
    return loadAiFlags().search.enabled;
  };
  const [aiPerfectInfo, setAiPerfectInfo] = createSignal(false);
  const [aiGoesFirst, setAiGoesFirst] = createSignal(true);
  const [aiBlunder, setAiBlunder] = createSignal(0.15);
  const [aiWeights, setAiWeights] = createSignal<AiWeights>({ ...DEFAULT_AI_WEIGHTS });
  const [aiDeckStrength, setAiDeckStrength] = createSignal<"strong" | "weak" | "random">("random");
  const [aiDifficulty, setAiDifficulty] = createSignal<AiDifficulty>("normal");
  const [aiStylePref, setAiStylePref] = createSignal<
    "auto" | "aggro" | "midrange" | "control" | "random" | "none"
  >("auto");
  const [thinkBudget, setThinkBudget] = createSignal(8000);

  // 高级选项改动后写到「模拟器」作用域的 AI 设置里（不用 effect，避免 Solid 2 的响应式域限制）
  const persistAiSettings = (
    patch: Partial<{
      delayMs: number;
      blunderRate: number;
      style: "aggro" | "midrange" | "control" | "random";
    }> = {},
  ) => {
    const style = aiStylePref();
    saveAiSettings("sim", {
      delayMs: patch.delayMs ?? aiDelay(),
      blunderRate: patch.blunderRate ?? aiBlunder(),
      style:
        patch.style ??
        (style === "auto" || style === "none"
          ? "midrange"
          : (style as "aggro" | "midrange" | "control" | "random")),
      weights: {
        damage: aiWeights().damage ?? 1.1,
        kills: aiWeights().kills ?? 12,
        debuffs: aiWeights().debuffs ?? 0.8,
        created: aiWeights().created ?? 0.45,
        healed: aiWeights().healed ?? 0.5,
        cardValue: aiWeights().cardValue ?? 0.7,
      },
    });
  };

  // 难度直接挂钩胜率：降低思考、增加失误、挑弱牌组
  const applyDifficulty = (level: AiDifficulty) => {
    setAiDifficulty(level);
    if (level === "easy") {
      setAiBlunder(0.35);
      setAiDeckStrength("weak");
      setAiDelay(300);
    } else if (level === "normal") {
      setThinkBudget(2000);
      setAiBlunder(0.15);
      setAiDeckStrength("random");
      setAiDelay(300);
    } else if (level === "hard") {
      setThinkBudget(8000);
      setAiBlunder(0.03);
      setAiDeckStrength("strong");
      setAiDelay(0);
    } else if (level === "nightmare") {
      setThinkBudget(15000);
      setAiBlunder(0.01);
      setAiDeckStrength("strong");
      setAiDelay(0);
    } else if (level === "hell") {
      setThinkBudget(25000);
      setAiBlunder(0);
      setAiDeckStrength("strong");
      setAiDelay(0);
    }
  };

  const REPLAY_KEY = "gi-tcg-replay-bundle";

  const setOrientation = (mode: "landscape" | "portrait") => {
    (window as { AndroidHost?: { setOrientation?: (mode: string) => void } })
      .AndroidHost?.setOrientation?.(mode);
  };

  const goHome = () => {
    sessionStorage.removeItem(REPLAY_KEY);
    setOrientation("portrait");
    location.href = "/";
  };

  // 系统返回键：对局/摆盘回到配置页，配置页才回工具首页
  (window as { __dshBack?: () => string }).__dshBack = () => {
    if (mode() === GameMode.Standalone && fromSnapshot()) {
      // 从摆盘器开的局：标记恢复草稿后回退历史到摆盘器（不新增条目）
      sessionStorage.setItem("gi-tcg-editor-resume", "1");
      history.back();
      return "handled";
    }
    if (mode() === GameMode.Standalone && editorLaunched()) {
      // 摆盘器开的局：退回摆盘器，保留刚才的盘面方便继续调试
      setMode(GameMode.Editor);
      return "handled";
    }
    if (mode() === GameMode.Standalone || mode() === GameMode.Editor) {
      setMode(GameMode.NotStarted);
      return "handled";
    }
    // 开局页没有可退的子界面时，回到进入模拟器之前的页面
    return "back";
  };

  /** 从日志 bundle / 单局日志里选择一局，返回反序列化后的状态日志 */
  const chooseReplay = (raw: unknown) =>
    new Promise<GameStateLogEntry[]>((resolve, reject) => {
      const bundle = raw as {
        kind?: string;
        games?: {
          index: number;
          winner: number | null;
          rounds?: number;
          stateLog: string;
          detailLog?: unknown;
          detailRanges?: number[];
          frameMutations?: unknown[][];
          historyBlocks?: readonly unknown[];
          frameHistory?: unknown[][];
        }[];
      };
      if (Array.isArray(bundle.games)) {
        const overlay = document.createElement("div");
        overlay.style.cssText =
          "position:fixed;inset:0;background:#000c;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:system-ui;color:#fff";
        const title = document.createElement("div");
        title.textContent = `共 ${bundle.games.length} 局，选择要重演的：`;
        title.style.cssText = "font-size:18px;margin-bottom:8px";
        overlay.appendChild(title);
        for (const game of bundle.games) {
          const btn = document.createElement("button");
          const resultText = game.winner === null ? "平局" : `玩家${game.winner + 1} 获胜`;
          btn.textContent = `第 ${game.index} 局 · ${resultText} · ${game.rounds ?? "?"} 回合`;
          btn.style.cssText =
            "min-width:260px;padding:12px 18px;border-radius:10px;border:1px solid #c8a15a;background:#1f242a;color:#f0e6d2;font-size:15px";
          btn.onclick = () => {
            overlay.remove();
            setReplayDetailLog(
              (Array.isArray(game.detailLog) ? game.detailLog : []) as DetailLogEntry[],
            );
            setDetailRanges(Array.isArray(game.detailRanges) ? game.detailRanges : []);
            setFrameMutations(
              Array.isArray(game.frameMutations) ? game.frameMutations : [],
            );
            setHistoryBlocks(
              Array.isArray(game.historyBlocks) ? game.historyBlocks : [],
            );
            setFrameHistory(
              Array.isArray(game.frameHistory) ? game.frameHistory : [],
            );
            const entry = JSON.parse(game.stateLog);
            const version = entry.gv?.replace(/^official\//, "");
            try {
              resolve(deserializeGameStateLog(getData(version as Version), entry));
            } catch (error) {
              reject(error);
            }
          };
          overlay.appendChild(btn);
        }
        const cancel = document.createElement("button");
        cancel.textContent = "取消";
        cancel.style.cssText =
          "margin-top:8px;padding:8px 18px;border-radius:8px;border:none;background:#555;color:#fff";
        cancel.onclick = () => {
          overlay.remove();
          reject("已取消");
        };
        overlay.appendChild(cancel);
        document.body.appendChild(overlay);
        return;
      }
      const entry = raw as { gv?: string };
      try {
        const version = entry.gv?.replace(/^official\//, "");
        resolve(deserializeGameStateLog(getData(version as Version), raw as never));
      } catch (error) {
        reject(error);
      }
    });

  const importLog = () =>
    new Promise<GameStateLogEntry[]>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement)?.files?.[0];
        if (!file) {
          reject(`Failed to read uploaded file`);
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const contents = event.target?.result as string;
          try {
            chooseReplay(JSON.parse(contents)).then(resolve, reject);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsText(file);
      };
      input.oncancel = () => {
        reject(`File upload canceled`);
      };
      input.click();
    });

  setOrientation("landscape");
  const pendingReplay = sessionStorage.getItem(REPLAY_KEY);
  if (pendingReplay) {
    sessionStorage.removeItem(REPLAY_KEY);
    const parsed = JSON.parse(pendingReplay);
    if (parsed?.kind === "gi-tcg-game-log-bundle" || Array.isArray((parsed as { games?: unknown }).games)) {
      chooseReplay(parsed)
        .then((logs) => {
          setLogs(logs);
          setMode(GameMode.Standalone);
        })
        .catch((error) => {
          alert(`回放加载失败：${error instanceof Error ? error.message : String(error)}`);
        });
    } else {
      try {
        if (parsed?.stateLog) {
          const replayLog = JSON.parse(parsed.stateLog);
          const version = replayLog.gv?.replace(/^official\//, "");
          setLogs(
            deserializeGameStateLog(getData(version as Version), replayLog as never),
          );
          setReplayDetailLog(Array.isArray(parsed.detailLog) ? parsed.detailLog : []);
          setDetailRanges(
            Array.isArray((parsed as { detailRanges?: number[] }).detailRanges)
              ? ((parsed as { detailRanges?: number[] }).detailRanges as number[])
              : [],
          );
        } else {
          const entry = parsed as { gv?: string };
          const version = entry.gv?.replace(/^official\//, "");
          setLogs(
            deserializeGameStateLog(getData(version as Version), parsed as never),
          );
        }
        setMode(GameMode.Standalone);
      } catch (error) {
        alert(`回放加载失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const downloadExperience = () => {
    const name = `ai-experience-${GAME_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      saveTextFile(name, exportExperience());
    } catch (error) {
      alert(`导出失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const uploadExperience = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) {
        return;
      }
      const result = importExperience(text);
      alert(`已导入经验：${result.games} 局 / ${result.decks} 副牌组`);
    } catch (error) {
      alert(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  let deckBuilderDialog!: HTMLDialogElement;
  const [loadDeckBuilder, setLoadDeckBuilder] = createSignal(false);
  const [deckBuilderValue, setDeckBuilderValue] = createSignal<Deck>({
    characters: [],
    cards: [],
  });
  const openDeckBuilder = () => {
    setLoadDeckBuilder(true);
    deckBuilderDialog.showModal();
  };
  const closeDeckBuilder = () => {
    deckBuilderDialog.close();
  };
  const loadDeckBuilderValue = async () => {
    const code = prompt(`Input share code:`);
    if (code === null) {
      return;
    }
    try {
      const deck = DEFAULT_ASSETS_MANAGER.decode(code);
      setDeckBuilderValue(deck);
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message);
      }
      console.error(e);
    }
  };
  const saveDeckBuilderValue = async () => {
    const deck = deckBuilderValue();
    try {
      const code = DEFAULT_ASSETS_MANAGER.encode(deck);
      await navigator.clipboard.writeText(code);
      alert(`Deck code copied to clipboard: ${code}`);
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message);
      }
      console.error(e);
    }
  };

  const editorInitialState = () => {
    const d0 = deck0();
    const d1 = deck1();
    try {
      const deck0 = DEFAULT_ASSETS_MANAGER.decode(d0);
      const deck1 = DEFAULT_ASSETS_MANAGER.decode(d1);
      return Game.createInitialState({
        decks: [deck0, deck1],
        data: getData(version()),
      });
    } catch (e) {
      if (e instanceof Error) {
        alert(e.message);
      }
      console.error(e);
    }
  };
  // 摆盘器提交后的局面快照：打完对局按返回时，回到摆盘器仍是同一盘面
  const [editorSnapshot, setEditorSnapshot] = createSignal<GameState | null>(null);
  const [editorLaunched, setEditorLaunched] = createSignal(false);

  const onEditorSubmit = (state: GameState) => {
    setEditorSnapshot(state);
    setEditorLaunched(true);
    setLogs([{ state, canResume: true }]);
    setMode(GameMode.Standalone);
  };

  // 摆盘器的「开始对局」：把快照经 sessionStorage 带过来，直接以该局面开局
  {
    const pendingSnapshot = sessionStorage.getItem("gi-tcg-start-snapshot");
    if (pendingSnapshot) {
      sessionStorage.removeItem("gi-tcg-start-snapshot");
      try {
        const payload = JSON.parse(pendingSnapshot) as {
          mode?: PlayMode;
          log?: Parameters<typeof deserializeGameStateLog>[1];
        };
        if (payload?.log) {
          const restored = deserializeGameStateLog(getData(version()), payload.log);
          if (restored.length > 0) {
            setFromSnapshot(true);
            setPlayMode(payload.mode ?? "ai");
            setLogs(restored);
            // 摆盘器「开始对局」直接开局（与配置页开局同一套布局逻辑）
            setMode(GameMode.Standalone);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  return (
    <div>
      <Switch>
        <Match when={mode() === GameMode.NotStarted}>
          <div class="tabs tabs--full">
            <div class="tab__content config-panel is-active">
              <div class="config-panel__top">
                <button
                  type="button"
                  class="start-top"
                  onClick={() => {
                    persistAiSettings();
                    setMode(1);
                  }}
                >
                  开始对局
                </button>
                <div class="config-panel__scrollhint">往下滑可以改设置 ↓</div>
              </div>
              <div class="config-panel__title">对局配置</div>
              <div class="config-panel__deck">
                <label>先手牌组</label>
                <input
                  type="text"
                  value={deck0()}
                  onInput={(e) => setDeck0(e.currentTarget.value)}
                />
              </div>
              <div class="config-panel__deck">
                <label>后手牌组</label>
                <input
                  type="text"
                  value={deck1()}
                  onInput={(e) => setDeck1(e.currentTarget.value)}
                />
              </div>
              <div class="config-panel__deck">
                <label>游戏版本</label>
                <select
                  value={version()}
                  onChange={(e) => setVersion(e.target.value as Version)}
                >
                  <For each={VERSIONS}>
                    {(ver) => <option value={ver}>{ver}</option>}
                  </For>
                </select>
              </div>
              <div class="config-panel__hint">
                离线包只带最新版（v7.2.0）的立绘与卡牌说明；切到旧版本只影响规则与数值，素材仍按最新版显示。
              </div>
              <div class="config-panel__deck">
                <label>对局模式</label>
                <select
                  value={playMode()}
                  onChange={(e) =>
                    setPlayMode(e.currentTarget.value as PlayMode)
                  }
                >
                  <Show when={ENABLE_PVP}>
                    <option value="pvp">本地双人（两个窗口）</option>
                  </Show>
                  <option value="ai">人机对战（你 vs AI）</option>
                  <option value="aiai">机机对战（AI vs AI 观战）</option>
                </select>
              </div>
              <Show when={playMode() === "ai"}>
                <div class="config-panel__deck row-aideck">
                  <label>AI 牌组</label>
                  <label class="config-panel__checkbox">
                    <input
                      type="checkbox"
                      checked={aiBuildsDeck()}
                      onChange={(e) =>
                        setAiBuildsDeck(e.currentTarget.checked)
                      }
                    />
                    现场自组
                  </label>
                </div>
              </Show>
              <Show when={playMode() !== "pvp"}>
                <div class="config-panel__deck row-diff">
                  <label>AI 难度</label>
                  <select
                    value={aiDifficulty()}
                    onChange={(e) =>
                      applyDifficulty(
                        e.currentTarget.value as AiDifficulty,
                      )
                    }
                  >
                    <option value="easy">简单（明显放水）</option>
                    <option value="normal">普通</option>
                    <option value="hard">困难</option>
                    <option value="nightmare">噩梦</option>
                    <option value="hell">地狱（最强）</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <Show when={playMode() !== "aiai"}>
                  <div class="config-panel__deck row-mover">
                    <label>先手</label>
                    <select
                      value={aiGoesFirst() ? "ai" : "human"}
                      onChange={(e) =>
                        setAiGoesFirst(e.currentTarget.value === "ai")
                      }
                    >
                      <option value="ai">AI 先手</option>
                      <option value="human">AI 后手（旅行者先手）</option>
                    </select>
                  </div>
                </Show>
                <details class="config-panel__advanced">
                  <summary>高级选项（调难度来源）</summary>
                  <div class="config-panel__deck">
                    <label>失误率</label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={aiBlunder()}
                      onInput={(e) => {
                        setAiBlunder(Number(e.currentTarget.value));
                        setAiDifficulty("custom");
                      }}
                    />
                    <span>{Math.round(aiBlunder() * 100)}%</span>
                  </div>
                  <div class="config-panel__deck">
                    <label>组卡强度</label>
                    <select
                      value={aiDeckStrength()}
                      onChange={(e) => {
                        setAiDeckStrength(
                          e.currentTarget.value as "strong" | "weak" | "random",
                        );
                        setAiDifficulty("custom");
                      }}
                    >
                      <option value="strong">挑赢过的（强）</option>
                      <option value="random">随机</option>
                      <option value="weak">挑没赢过的（弱）</option>
                    </select>
                  </div>
                  <div class="config-panel__deck">
                    <label>思考速度</label>
                    <select
                      value={String(aiDelay())}
                      onChange={(e) => {
                        setAiDelay(Number(e.currentTarget.value));
                        setAiDifficulty("custom");
                      }}
                    >
                      <option value="0">闪电（立即）</option>
                      <option value="300">快（0.3 秒）</option>
                      <option value="700">正常（0.7 秒）</option>
                      <option value="1500">慢（1.5 秒）</option>
                    </select>
                  </div>
                  <div class="config-panel__deck">
                    <label>AI 风格</label>
                    <select
                      value={aiStylePref()}
                      onChange={(e) => {
                        setAiStylePref(
                          e.currentTarget.value as
                            | "auto"
                            | "aggro"
                            | "midrange"
                            | "control"
                            | "random"
                            | "none",
                        );
                        setAiDifficulty("custom");
                      }}
                    >
                      <option value="auto">自动（按牌组标签）</option>
                      <option value="aggro">快攻（抢血）</option>
                      <option value="midrange">中速（均衡）</option>
                      <option value="control">控制（苟活）</option>
                      <option value="random">随机（每局随机风格）</option>
                      <option value="none">无风格（自由发挥）</option>
                    </select>
                  </div>
                  <div class="config-panel__deck">
                    <label>评分权重（伤害 / 击杀 / 出牌基础分）</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="number"
                        step="0.05"
                        style={{ flex: 1 }}
                        value={aiWeights().damage}
                        onInput={(e) =>
                          setAiWeights((prev) => ({
                            ...prev,
                            damage: Number(e.currentTarget.value) || 0,
                          }))
                        }
                      />
                      <input
                        type="number"
                        step="0.5"
                        style={{ flex: 1 }}
                        value={aiWeights().kills}
                        onInput={(e) =>
                          setAiWeights((prev) => ({
                            ...prev,
                            kills: Number(e.currentTarget.value) || 0,
                          }))
                        }
                      />
                      <input
                        type="number"
                        step="0.05"
                        style={{ flex: 1 }}
                        value={aiWeights().cardValue}
                        onInput={(e) =>
                          setAiWeights((prev) => ({
                            ...prev,
                            cardValue: Number(e.currentTarget.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Show when={aiThinking()}>
                    <div class="config-panel__deck">
                      <label>信息模式</label>
                      <label class="config-panel__checkbox">
                        <input
                          type="checkbox"
                          checked={aiPerfectInfo()}
                          onChange={(e) => setAiPerfectInfo(e.currentTarget.checked)}
                        />
                        明牌模式（AI 能看到你的手牌/牌堆）
                      </label>
                    </div>
                    <div class="config-panel__deck">
                      <label>每步预算</label>
                      <select
                        value={String(thinkBudget())}
                        onChange={(e) => {
                          setThinkBudget(Number(e.currentTarget.value));
                          setAiDifficulty("custom");
                        }}
                      >
                        <option value="2000">2 秒</option>
                        <option value="8000">8 秒</option>
                        <option value="15000">15 秒</option>
                        <option value="25000">25 秒（最强）</option>
                      </select>
                    </div>
                  </Show>
                </details>
              </Show>
              <div class="config-panel__description">
                <Switch>
                  <Match when={playMode() === "pvp"}>
                    点击下方按钮开始对局；先手方棋盘会在弹出窗口显示，后手方棋盘在本页面显示。
                    <br />
                    （若弹窗不显示为浏览器阻止，请允许本页面使用弹出式窗口。）
                  </Match>
                  <Match when={playMode() === "aiai"}>
                    双方都是内置 AI，本页面自动播放对局，你只需围观即可；结束后可导出日志复盘。
                  </Match>
                </Switch>
                <br />
                <Show when={IS_BETA}>
                  <br />
                  <strong>
                    请注意：本页面包含未发布的测试版卡牌；包含这些卡牌的分享码仅限在本页面内使用，它们可能是无效的正式版分享码。
                  </strong>
                </Show>
              </div>
              <div class="config-panel__button-group">
                <button
                  onClick={async () => {
                    const logs = await importLog().catch(alert);
                    if (logs) {
                      setLogs(logs);
                      setMode(1);
                    }
                  }}
                >
                  导入日志
                </button>
                <button onClick={() => setMode(GameMode.Editor)}>摆盘器</button>
              </div>
            </div>
          </div>
          <h3>友情链接</h3>
          <ul>
            <li>
              获取牌组码：
              <a
                href="https://webstatic.mihoyo.com/ys/event/bbs-lineup-qskp/index.html"
                target="_blank"
              >
                米游社「七圣召唤」卡牌广场
              </a>
            </li>
            <li>
              获取牌组码：
              <a href="https://www.summoners.top/teams" target="_blank">
                召唤之巅：原神赛事数据统计平台
              </a>
            </li>
            <li>
              获取牌组码：<button onClick={openDeckBuilder}>启动组牌器</button>
            </li>
            <li>
              此项目{" "}
              <a
                href="https://github.com/Guyutongxue/genius-invokation"
                target="_blank"
              >
                GitHub
              </a>
            </li>
            <li>
              <a href="https://gi-tcg.taim.site" target="_blank">
                Taimevraiment 七圣召唤模拟器
              </a>
              （
              <a
                href="https://github.com/Taimevraiment/genius-invokation"
                target="_blank"
              >
                GitHub
              </a>
              ）
            </li>
            <li>
              <a
                href="https://jarvis-yu.github.io/Dottore-Genius-Invokation-TCG-PWA/"
                target="_blank"
              >
                Dottore 七圣召唤模拟器
              </a>
              （
              <a
                href="https://github.com/Jarvis-Yu/Dottore-Genius-Invokation-TCG-Simulator"
                target="_blank"
              >
                GitHub
              </a>
              ）
            </li>
            <li>
              <a href="https://lpsim.zyr17.cn/" target="_blank">
                七圣召唤水皇模拟器 "LPSim"
              </a>
              （
              <a href="https://github.com/LPSim/backend" target="_blank">
                GitHub
              </a>
              ）
            </li>
            <li>
              <a
                href="https://flick-ai.github.io/Genius-Invokation"
                target="_blank"
              >
                flick-ai 七圣召唤模拟器
              </a>
              （
              <a
                href="https://github.com/flick-ai/Genius-Invokation"
                target="_blank"
              >
                GitHub
              </a>
              ）
            </li>
          </ul>
        </Match>
        <Match when={mode() === GameMode.Standalone}>
          <StandaloneParent
            logs={logs()}
            autoStartFromSnapshot={fromSnapshot()}
            importedDetailLog={replayDetailLog()}
            initialDetailRanges={replayDetailRanges()}
            initialFrameMutations={replayFrameMutations()}
            initialHistoryBlocks={replayHistoryBlocks()}
            initialFrameHistory={replayFrameHistory()}
            deck0={deck0()}
            deck1={deck1()}
            version={version()}
            playMode={playMode()}
            aiDelayMs={aiDelay()}
            aiBuildsDeck={aiBuildsDeck()}
            aiThinking={aiThinking()}
            aiThinkBudgetMs={thinkBudget()}
            aiPerfectInfo={aiPerfectInfo()}
            aiStylePref={aiStylePref()}
            aiWeights={aiWeights()}
            aiBlunderRate={aiBlunder()}
            aiDeckStrength={aiDeckStrength()}
            aiGoesFirst={aiGoesFirst()}
            onExit={() => setMode(GameMode.NotStarted)}
          />
        </Match>
        <Match when={mode() === GameMode.Editor}>
          <GameStateEditor
            initialValue={editorSnapshot() ?? editorInitialState()}
            onSubmit={onEditorSubmit}
          >
            <button
              class="editor-back-button"
              type="button"
              onClick={() => {
                setEditorLaunched(false);
                setMode(GameMode.NotStarted);
              }}
            >
              返回首页
            </button>
          </GameStateEditor>
        </Match>
      </Switch>
      <dialog ref={deckBuilderDialog!} class="deck-builder-dialog">
        <Show when={loadDeckBuilder()}>
          <DeckBuilder
            class="deck-builder"
            deck={deckBuilderValue()}
            onChangeDeck={setDeckBuilderValue}
          />
        </Show>
        <div class="deck-builder-actions">
          <button onClick={closeDeckBuilder}>Close</button>
          <button onClick={saveDeckBuilderValue}>Save</button>
          <button onClick={loadDeckBuilderValue}>Load from code</button>
        </div>
      </dialog>
    </div>
  );
}
