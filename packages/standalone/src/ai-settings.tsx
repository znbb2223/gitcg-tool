import { createSignal, For } from "solid-js";
import { render } from "@solidjs/web";
import "./ai-settings.css";
import {
  AI_SCOPE_LABELS,
  AI_WEIGHT_FIELDS as WEIGHT_FIELDS,
  DEFAULT_AI_SETTINGS as DEFAULTS,
  loadAiSettings,
  resetAiSettings,
  saveAiSettings,
  type AiScope,
  type AiSettings,
} from "./ai-settings-store";

/** 通过 ?scope=sim|lab|train 区分三处 AI 设置，各自独立保存 */
const scope: AiScope = (() => {
  const value = new URLSearchParams(location.search).get("scope");
  return value === "sim" || value === "train" ? value : "lab";
})();
const loadSettings = () => loadAiSettings(scope);

function AiSettingsPage() {
  const [settings, setSettings] = createSignal<AiSettings>(loadSettings());
  const [saved, setSaved] = createSignal(false);

  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateWeight = (key: keyof AiSettings["weights"], value: number) => {
    setSettings((prev) => ({
      ...prev,
      weights: { ...prev.weights, [key]: value },
    }));
    setSaved(false);
  };

  const save = () => {
    saveAiSettings(scope, settings());
    setSaved(true);
  };

  const reset = () => {
    resetAiSettings(scope);
    setSettings(structuredClone(DEFAULTS));
    setSaved(true);
  };

  return (
    <div class="ai-settings-page">
      <header class="ai-settings-bar">
        <button onClick={() => history.back()}>返回</button>
        <b>{AI_SCOPE_LABELS[scope]}</b>
        <span class="spacer" />
        <button onClick={reset}>恢复默认</button>
        <button class="primary" onClick={save}>
          {saved() ? "已保存" : "保存"}
        </button>
      </header>
      <main class="ai-settings-body">
        <section>
          <h3>基本参数</h3>
          <label>
            <span>思考延时（毫秒）</span>
            <input
              type="number"
              min="0"
              step="50"
              value={settings().delayMs}
              onInput={(e) =>
                update("delayMs", Number(e.currentTarget.value) || 0)
              }
            />
          </label>
          <label>
            <span>失误率 0 ~ 1</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={settings().blunderRate}
              onInput={(e) =>
                update("blunderRate", Number(e.currentTarget.value) || 0)
              }
            />
          </label>
          <label>
            <span>风格</span>
            <select
              value={settings().style}
              onChange={(e) =>
                update("style", e.currentTarget.value as AiSettings["style"])
              }
            >
              <option value="aggro">快攻</option>
              <option value="midrange">中速</option>
              <option value="control">控制</option>
              <option value="random">随机</option>
            </select>
          </label>
        </section>
        <section>
          <h3>评分权重</h3>
          <For each={WEIGHT_FIELDS}>
            {(field) => (
              <label>
                <span>{field.label}</span>
                <input
                  type="range"
                  min="0"
                  max={field.key === "kills" ? 30 : 5}
                  step="0.05"
                  value={settings().weights[field.key]}
                  onInput={(e) =>
                    updateWeight(field.key, Number(e.currentTarget.value))
                  }
                />
                <b>{settings().weights[field.key].toFixed(2)}</b>
              </label>
            )}
          </For>
        </section>
        <p class="ai-settings-tip">
          保存后新开的对局会按这些参数运行；当前进行中的对局不受影响。
        </p>
      </main>
    </div>
  );
}

render(() => <AiSettingsPage />, document.getElementById("root")!);
