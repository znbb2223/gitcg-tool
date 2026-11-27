import { createSignal, For } from "solid-js";
import { render } from "@solidjs/web";
import "./ai-settings.css";
import {
  AI_PRESET_LABELS,
  AI_PRESETS,
  applyAiPreset,
  loadAiFlags,
  saveAiFlags,
  type AiFlags,
  type AiPreset,
} from "./ai-flags";
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
  const [flags, setFlags] = createSignal<AiFlags>(loadAiFlags());
  const [advanced, setAdvanced] = createSignal(false);

  /** 开关改动立即落盘：AI 组件属于全局设置，不随 scope 保存 */
  const updateFlags = (patch: (prev: AiFlags) => AiFlags) => {
    setFlags((prev) => {
      const next = patch(prev);
      saveAiFlags(next);
      return loadAiFlags();
    });
  };

  const choosePreset = (preset: AiPreset) => {
    updateFlags((prev) => applyAiPreset(prev, preset));
  };

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
          <h3>
            AI 推理组件{" "}
            <button class="ai-mode-toggle" onClick={() => setAdvanced(!advanced())}>
              {advanced() ? "简易模式" : "高级模式"}
            </button>
          </h3>

          {!advanced() ? (
            <>
              <label>
                <span>预设</span>
                <select
                  value={flags().preset}
                  onChange={(e) => choosePreset(e.currentTarget.value as AiPreset)}
                >
                  <For each={Object.keys(AI_PRESET_LABELS) as AiPreset[]}>
                    {(preset) => (
                      <option value={preset}>{AI_PRESET_LABELS[preset]}</option>
                    )}
                  </For>
                </select>
              </label>
              <label>
                <span>推演搜索</span>
                <input
                  type="checkbox"
                  checked={flags().search.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      preset: "custom",
                      search: { ...prev.search, enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={flags().search.budgetMs}
                  onInput={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      preset: "custom",
                      search: {
                        ...prev.search,
                        budgetMs: Number(e.currentTarget.value) || 0,
                      },
                    }))
                  }
                />
                <em>ms</em>
              </label>
              <label>
                <span>决策记忆</span>
                <input
                  type="checkbox"
                  checked={flags().memory.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      memory: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
              </label>
              <label>
                <span>经验先验</span>
                <input
                  type="checkbox"
                  checked={flags().priors.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      priors: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
              </label>
              <label>
                <span>价值网络</span>
                <input
                  type="checkbox"
                  disabled={!flags().search.enabled}
                  checked={flags().valueNet.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      preset: "custom",
                      valueNet: {
                        enabled: e.currentTarget.checked,
                        model: e.currentTarget.checked ? "v0" : null,
                      },
                    }))
                  }
                />
                <em>{flags().valueNet.enabled ? "v0（120 局）" : "未启用"}</em>
              </label>
              <label>
                <span>策略网络</span>
                <input type="checkbox" disabled checked={false} onChange={() => {}} />
                <em>未训练</em>
              </label>
            </>
          ) : (
            <div class="ai-advanced">
              <div class="ai-group">固定组件（不可关闭）</div>
              <div class="ai-row">
                <span>① 规则引擎</span>
                <em>固定开启 · 对局结算的基础</em>
              </div>
              <div class="ai-row">
                <span>② 启发式评估</span>
                <em>固定开启 · 所有网络的兜底</em>
              </div>

              <div class="ai-group">运行时组件</div>
              <div class="ai-row">
                <span>③ 推演搜索</span>
                <input
                  type="checkbox"
                  checked={flags().search.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      preset: "custom",
                      search: { ...prev.search, enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={flags().search.budgetMs}
                  onInput={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      search: {
                        ...prev.search,
                        budgetMs: Number(e.currentTarget.value) || 0,
                      },
                    }))
                  }
                />
                <em>ms</em>
              </div>
              <div class="ai-row">
                <span>④ 决策记忆</span>
                <input
                  type="checkbox"
                  checked={flags().memory.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      memory: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <em>局面复用，省时间</em>
              </div>
              <div class="ai-row">
                <span>⑤ 经验统计</span>
                <input
                  type="checkbox"
                  checked={flags().priors.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      priors: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <em>牌/角色历史胜率</em>
              </div>
              <div class="ai-row">
                <span>⑥ 价值网络</span>
                <input
                  type="checkbox"
                  disabled={!flags().search.enabled}
                  checked={flags().valueNet.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      preset: "custom",
                      valueNet: {
                        enabled: e.currentTarget.checked,
                        model: e.currentTarget.checked ? "v0" : null,
                      },
                    }))
                  }
                />
                <em>{flags().valueNet.enabled ? "模型 v0" : "需搜索配合"}</em>
              </div>
              <div class="ai-row">
                <span>⑦ 查表价值</span>
                <input
                  type="checkbox"
                  disabled={!flags().search.enabled || flags().valueNet.enabled}
                  checked={flags().valueTable.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      valueTable: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <em>与价值网络互斥</em>
              </div>
              <div class="ai-row">
                <span>⑧ 策略网络</span>
                <input type="checkbox" disabled checked={false} onChange={() => {}} />
                <em>未训练 · 训练后可用</em>
              </div>
              <div class="ai-row">
                <span>⑨ 双头网络</span>
                <input type="checkbox" disabled checked={false} onChange={() => {}} />
                <em>未训练 · 与策略网络互斥</em>
              </div>
              <div class="ai-row">
                <span>⑩ 贝叶斯读牌</span>
                <input
                  type="checkbox"
                  disabled={!flags().search.enabled}
                  checked={flags().bayes.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      bayes: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <em>实验功能</em>
              </div>

              <div class="ai-group">训练器（不参与对局）</div>
              <div class="ai-row">
                <span>⑪ 迭代自对弈</span>
                <em>在电脑训练器里运行</em>
              </div>
              <div class="ai-row">
                <span>⑫ 进化调权重</span>
                <em>离线调参，产出权重文件</em>
              </div>

              <div class="ai-group">附加</div>
              <div class="ai-row">
                <span>⑬ LLM 解说</span>
                <input
                  type="checkbox"
                  checked={flags().llm.enabled}
                  onChange={(e) =>
                    updateFlags((prev) => ({
                      ...prev,
                      llm: { enabled: e.currentTarget.checked },
                    }))
                  }
                />
                <em>不参与下棋</em>
              </div>
            </div>
          )}
          <p class="ai-settings-tip">
            开关立即生效，新开的对局按新配置运行。当前：{flags().preset}
          </p>
        </section>
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
