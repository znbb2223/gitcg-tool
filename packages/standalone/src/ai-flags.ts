/**
 * AI 运行组件开关。
 *
 * 分类依据：见 docs/AI-ROADMAP.zh.md
 * - 不可关：规则引擎、启发式评估（代码里没有开关，永远是兜底）
 * - 建议开：推演搜索、决策记忆、经验先验
 * - 可选：价值网络 / 查表价值（互斥）、策略网络、贝叶斯读牌
 */

export type AiPreset = "saver" | "balanced" | "strong" | "custom";

export interface AiFlags {
  preset: AiPreset;
  /** 推演搜索：关掉就只剩启发式（最省电） */
  search: { enabled: boolean; budgetMs: number };
  /** 决策记忆：局面复用，纯性能优化 */
  memory: { enabled: boolean };
  /** 经验先验：牌/角色历史胜率 */
  priors: { enabled: boolean };
  /** 价值网络：需要搜索配合，模型 id 为空表示未装载 */
  valueNet: { enabled: boolean; model: string | null };
  /** 查表价值：与价值网络互斥 */
  valueTable: { enabled: boolean };
  /** 策略网络：可独立出招（未训练前禁用） */
  policyNet: { enabled: boolean; model: string | null };
  /** 双头网络：与策略网络互斥（同一个位置只能装一个） */
  twinNet: { enabled: boolean; model: string | null };
  /** 贝叶斯读牌：实验功能，依赖搜索 */
  bayes: { enabled: boolean };
  /** LLM 解说：不参与下棋，只做对局解说 */
  llm: { enabled: boolean };
  /**
   * DMC 自对弈动作网络：按 Q(s,a) 直接出招，不跑搜索。
   * 与策略网络互斥；model 为权重 JSON 的 URL/路径，加载失败自动回退。
   */
  dmc: { enabled: boolean; model: string | null };
}

export const AI_FLAGS_KEY = "gitcg.ai.flags";

export const DEFAULT_AI_FLAGS: AiFlags = {
  preset: "balanced",
  search: { enabled: true, budgetMs: 2500 },
  memory: { enabled: true },
  priors: { enabled: true },
  valueNet: { enabled: false, model: null },
  valueTable: { enabled: false },
  policyNet: { enabled: false, model: null },
  twinNet: { enabled: false, model: null },
  bayes: { enabled: false },
  llm: { enabled: false },
  dmc: { enabled: false, model: null },
};

/** 预设：只改组件组合，不改用户的历史选择细节 */
export const AI_PRESETS: Record<
  Exclude<AiPreset, "custom">,
  Pick<AiFlags, "search" | "memory" | "priors" | "valueNet" | "valueTable" | "policyNet" | "bayes">
> = {
  saver: {
    search: { enabled: false, budgetMs: 0 },
    memory: { enabled: true },
    priors: { enabled: true },
    valueNet: { enabled: false, model: null },
    valueTable: { enabled: false },
    policyNet: { enabled: false, model: null },
    twinNet: { enabled: false, model: null },
    bayes: { enabled: false },
    llm: { enabled: false },
  },
  balanced: {
    search: { enabled: true, budgetMs: 2500 },
    memory: { enabled: true },
    priors: { enabled: true },
    valueNet: { enabled: false, model: null },
    valueTable: { enabled: false },
    policyNet: { enabled: false, model: null },
    twinNet: { enabled: false, model: null },
    bayes: { enabled: false },
    llm: { enabled: false },
  },
  strong: {
    search: { enabled: true, budgetMs: 8000 },
    memory: { enabled: true },
    priors: { enabled: true },
    valueNet: { enabled: false, model: null },
    valueTable: { enabled: false },
    policyNet: { enabled: false, model: null },
    twinNet: { enabled: false, model: null },
    bayes: { enabled: false },
    llm: { enabled: false },
  },
};

export const AI_PRESET_LABELS: Record<AiPreset, string> = {
  saver: "省电（纯启发式）",
  balanced: "均衡（搜索 2.5 秒）",
  strong: "最强（搜索 8 秒）",
  custom: "自定义",
};

/**
 * 规整非法组合：
 * - 价值网络与查表价值互斥（同时开等于两个裁判打架）
 * - 没开搜索时，价值网络/查表/贝叶斯都无意义 → 自动关闭
 * - 模型为空的网络视为关闭
 */
export function normalizeAiFlags(flags: AiFlags): AiFlags {
  const next: AiFlags = {
    ...flags,
    search: { ...flags.search },
    memory: { ...flags.memory },
    priors: { ...flags.priors },
    valueNet: { ...flags.valueNet },
    valueTable: { ...flags.valueTable },
    policyNet: { ...flags.policyNet },
    twinNet: { ...flags.twinNet },
    bayes: { ...flags.bayes },
    llm: { ...flags.llm },
    dmc: { ...flags.dmc },
  };
  if (next.valueNet.enabled && next.valueTable.enabled) {
    next.valueTable.enabled = false;
  }
  if (!next.search.enabled) {
    next.valueNet.enabled = false;
    next.valueTable.enabled = false;
    next.bayes.enabled = false;
  }
  if (next.valueNet.enabled && !next.valueNet.model) {
    next.valueNet.enabled = false;
  }
  if (next.policyNet.enabled && !next.policyNet.model) {
    next.policyNet.enabled = false;
  }
  // 策略网络与双头网络装着同一个位置，互斥
  if (next.policyNet.enabled && next.twinNet.enabled) {
    next.twinNet.enabled = false;
  }
  if (next.twinNet.enabled && !next.twinNet.model) {
    next.twinNet.enabled = false;
  }
  // DMC 与策略网络占同一位置；没有权重就视为关闭
  if (next.dmc.enabled && next.policyNet.enabled) {
    next.policyNet.enabled = false;
  }
  if (next.dmc.enabled && !next.dmc.model) {
    next.dmc.enabled = false;
  }
  return next;
}

/** 应用预设；custom 保持不变 */
export function applyAiPreset(flags: AiFlags, preset: AiPreset): AiFlags {
  if (preset === "custom") {
    return { ...flags, preset };
  }
  return normalizeAiFlags({ ...flags, ...AI_PRESETS[preset], preset });
}

export function loadAiFlags(): AiFlags {
  try {
    const raw = localStorage.getItem(AI_FLAGS_KEY);
    if (!raw) {
      return migrateLegacyFlags();
    }
    const parsed = JSON.parse(raw) as Partial<AiFlags>;
    return normalizeAiFlags({
      ...DEFAULT_AI_FLAGS,
      ...parsed,
      search: { ...DEFAULT_AI_FLAGS.search, ...parsed.search },
      memory: { ...DEFAULT_AI_FLAGS.memory, ...parsed.memory },
      priors: { ...DEFAULT_AI_FLAGS.priors, ...parsed.priors },
      valueNet: { ...DEFAULT_AI_FLAGS.valueNet, ...parsed.valueNet },
      valueTable: { ...DEFAULT_AI_FLAGS.valueTable, ...parsed.valueTable },
      policyNet: { ...DEFAULT_AI_FLAGS.policyNet, ...parsed.policyNet },
      twinNet: { ...DEFAULT_AI_FLAGS.twinNet, ...parsed.twinNet },
      bayes: { ...DEFAULT_AI_FLAGS.bayes, ...parsed.bayes },
      llm: { ...DEFAULT_AI_FLAGS.llm, ...parsed.llm },
      dmc: { ...DEFAULT_AI_FLAGS.dmc, ...parsed.dmc },
    });
  } catch {
    return { ...DEFAULT_AI_FLAGS };
  }
}

export function saveAiFlags(flags: AiFlags): void {
  try {
    localStorage.setItem(AI_FLAGS_KEY, JSON.stringify(normalizeAiFlags(flags)));
  } catch {
    // localStorage 不可用时静默降级为默认值
  }
}

/**
 * 兼容旧版两个零散 key（gitcg.ai.valueMode / gitcg.ai.nn），
 * 用户第一次打开新设置页时自动迁移。
 */
function migrateLegacyFlags(): AiFlags {
  const legacyMode = localStorage.getItem("gitcg.ai.valueMode");
  const legacyNn = localStorage.getItem("gitcg.ai.nn");
  if (legacyMode === null && legacyNn === null) {
    return { ...DEFAULT_AI_FLAGS };
  }
  const migrated: AiFlags = {
    ...DEFAULT_AI_FLAGS,
    valueNet: {
      enabled: legacyNn === "1",
      model: legacyNn === "1" ? "v0" : null,
    },
  };
  saveAiFlags(migrated);
  localStorage.removeItem("gitcg.ai.valueMode");
  localStorage.removeItem("gitcg.ai.nn");
  return normalizeAiFlags(migrated);
}

/** 给调试日志用的一行摘要 */
export function describeAiFlags(flags: AiFlags): string {
  const parts = [
    flags.search.enabled ? `搜索${flags.search.budgetMs}ms` : "无搜索",
    flags.memory.enabled ? "记忆" : "-",
    flags.priors.enabled ? "先验" : "-",
    flags.valueNet.enabled ? `价值网络(${flags.valueNet.model})` : "-",
    flags.valueTable.enabled ? "查表" : "-",
    flags.policyNet.enabled ? `策略网络(${flags.policyNet.model})` : "-",
    flags.twinNet.enabled ? "双头" : "-",
    flags.bayes.enabled ? "贝叶斯" : "-",
    flags.llm.enabled ? "LLM" : "-",
    flags.dmc.enabled ? `DMC(${flags.dmc.model})` : "-",
  ];
  return parts.join(" / ");
}
