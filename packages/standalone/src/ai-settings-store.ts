/**
 * AI 参数的统一存储：模拟器、卡组实验室、牌组库训练各用一份，互不干扰。
 * 兼容旧版两个 key（实验室 gi-tcg-lab-ai-settings-v1 / 模拟器 gi-tcg-ai-settings-v1）。
 */
export type AiScope = "sim" | "lab" | "train";

export interface AiSettings {
  delayMs: number;
  blunderRate: number;
  style: "aggro" | "midrange" | "control" | "random";
  weights: {
    damage: number;
    kills: number;
    debuffs: number;
    created: number;
    healed: number;
    cardValue: number;
  };
}

export type AiWeightKey = keyof AiSettings["weights"];

export const AI_WEIGHT_FIELDS: { key: AiWeightKey; label: string; max: number }[] = [
  { key: "damage", label: "伤害权重", max: 5 },
  { key: "kills", label: "击杀权重", max: 30 },
  { key: "debuffs", label: "负面状态权重", max: 5 },
  { key: "created", label: "生成实体权重", max: 5 },
  { key: "healed", label: "治疗权重", max: 5 },
  { key: "cardValue", label: "出牌基础分", max: 5 },
];

export const DEFAULT_AI_SETTINGS: AiSettings = {
  delayMs: 300,
  blunderRate: 0.05,
  style: "midrange",
  weights: {
    damage: 1.1,
    kills: 12,
    debuffs: 0.8,
    created: 0.45,
    healed: 0.5,
    cardValue: 0.7,
  },
};

export const AI_SCOPE_LABELS: Record<AiScope, string> = {
  sim: "模拟器 · AI 设置",
  lab: "卡组实验室 · AI 设置",
  train: "牌组库训练 · AI 设置",
};

const storageKey = (scope: AiScope) => `gi-tcg-ai-settings-v2:${scope}`;

const LEGACY_KEYS: Partial<Record<AiScope, string>> = {
  sim: "gi-tcg-ai-settings-v1",
  lab: "gi-tcg-lab-ai-settings-v1",
};

export function loadAiSettings(scope: AiScope): AiSettings {
  try {
    const raw =
      localStorage.getItem(storageKey(scope)) ??
      (LEGACY_KEYS[scope] ? localStorage.getItem(LEGACY_KEYS[scope]!) : null);
    if (!raw) {
      return structuredClone(DEFAULT_AI_SETTINGS);
    }
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      ...structuredClone(DEFAULT_AI_SETTINGS),
      ...parsed,
      weights: { ...DEFAULT_AI_SETTINGS.weights, ...(parsed.weights ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_AI_SETTINGS);
  }
}

export function saveAiSettings(scope: AiScope, settings: AiSettings) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(settings));
  } catch {
    // 存储满了就静默失败，AI 参数退回默认
  }
}

export function resetAiSettings(scope: AiScope) {
  saveAiSettings(scope, structuredClone(DEFAULT_AI_SETTINGS));
}
