# 七圣召唤 AI · 全景实现详解

> 面向"想知道它到底怎么下棋"的读者：从引擎接口、启发式、搜索、价值/策略网络到 DMC，
> 每一节都对应仓库里的真实代码，并解释项目自创的术语。
>
> 配套阅读：[AI 现状总览](../artifacts/ai/README.md)、[AI 终结报告](../artifacts/ai/AI-终结报告-2026-11-28.md)、
> [AI 实验记录](./AI-EXPERIMENTS.zh.md)、[AI 路线图](./AI-ROADMAP.zh.md)。
>
> 当前状态：**AI 研究线已封存**。App 默认使用「搜索版」（2500ms）；DMC 代码保留但默认关闭。

## 目录

1. [问题定义：这个 AI 在解什么](#一问题定义这个-ai-在解什么)
2. [总体架构](#二总体架构)
3. [引擎与 AI 的接口（代码级）](#三引擎与-ai-的接口代码级)
4. [启发式评估 v1 / v2](#四启发式评估-v1--v2)
5. [候选动作编码与策略网络](#五候选动作编码与策略网络)
6. [搜索：PIMC + 扁平 rollout](#六搜索pimc--扁平-rollout)
7. [隐藏信息与"猜牌"](#七隐藏信息与猜牌)
8. [价值网络与查表价值](#八价值网络与查表价值)
9. [策略网络的四种用法](#九策略网络的四种用法)
10. [DMC：深度蒙特卡洛自对弈](#十dmc深度蒙特卡洛自对弈)
11. [经验库、学习器与训练器](#十一经验库学习器与训练器)
12. [后台预计算与沉思](#十二后台预计算与沉思)
13. [失败组件档案](#十三失败组件档案)
14. [评估方法论：镜像配对 A/B](#十四评估方法论镜像配对-ab)
15. [自创术语表](#十五自创术语表)
16. [代码地图](#十六代码地图)
17. [参数速查与 FAQ](#十七参数速查与-faq)
18. [附录：44 维特征逐维说明](#十八附录44-维特征逐维说明)

---

## 一、问题定义：这个 AI 在解什么

七圣召唤是一个**不完全信息、随机性、回合制**的卡牌游戏。AI 在每个决策点要做的，本质上是一个
**部分可观测马尔可夫决策过程（POMDP）**：

- **状态** `s`：双方角色血量/充能、骰子、手牌、牌堆、召唤物、支援、装备、状态、回合数……
- **动作** `a`：出技能、打牌、切人、元素调和、宣布结束；外加"重投骰子、换留牌、选出战、选牌、选选项"。
- **隐藏信息**：对手手牌与牌堆顺序不可见（这是搜索必须处理的核心问题）。
- **随机性**：骰子、抽牌、随机效果。
- **收益**：赢 = +1，输 = −1，平 = 0。

代码里 AI 不需要理解规则细节——**规则全部由 `@gi-tcg/core` 引擎负责**，AI 只通过
`notify` / `rpc` 两个回调与引擎交互。这是整个实现的第一条设计原则：

> **AI 只做决策，不做结算。** 任何"这手牌打出去会怎样"都问引擎（`action.preview`）或复制局面推演。

### 决策点类型

引擎会在不同阶段向 AI 发 RPC，`player.ts` 里对应六个入口：

| 引擎请求 | AI 处理函数 | 说明 |
|---|---|---|
| `action` | `decideAction` | 主决策：出技能/打牌/切人/调和/结束 |
| `rerollDice` | `decideReroll` | 重投阶段保留哪些骰子 |
| `switchHands` | `decideSwitchHands` | 起手换牌 |
| `chooseActive` | `decideActive` | 选谁出战（角色倒下后） |
| `selectCard` | `decideSelectCard` | 某些卡要求选一张牌 |
| `selectOption` | `decideSelectOption` | 通用选项（如"是否发动"） |

> 后三类在缺少信息时取"第一项"，属于工程兜底，不是 AI 强度来源。

---

## 二、总体架构

- **引擎（core）**：规则、结算、结算预览 `preview`、状态序列化；
- **AiPlayer（player.ts）**：收集合法/可支付动作 → 启发式打分 → 可选交给 `selectAction`（搜索/DMC）→ 难度噪声；
- **启发式（evaluate.ts）**：`scoreAction` 14 项权重 + `pickAction`；
- **搜索（search.ts）**：确定性化 + rollout + 预算分配，可接价值网/查表/记忆；
- **评估层**：`value.ts`（44 维 → 线性/MLP/查表）、`policy.ts`（state-action 打分）、`dmc.ts`（Q(s,a) 推理）。

三条"策略层"可替换：**启发式**（永远兜底）、**搜索**（App 默认）、**策略网 / DMC**（实验，默认关）。
评估层可插拔：手工 v1/v2、价值网络、查表、终局胜负。

---

## 三、引擎与 AI 的接口（代码级）

### 3.1 `AiPlayer` 实现 `AiPlayerIO`

```ts
// AI 与引擎之间的两个回调
export interface AiPlayerIO {
  // 引擎 → AI 的通知：状态更新、阶段变化
  notify: (notification: Notification) => void;
  // 引擎 → AI 的请求：需要 AI 做决定
  rpc: (request: RpcRequest) => Promise<RpcResponse>;
}

// 启发式 AI 的默认实现
export class AiPlayer implements AiPlayerIO {
  // 只保存该玩家可见的局面快照，不存隐藏信息
  private state: PbGameState | null = null;
  ...
  // 统一入口：按请求类型分派
  rpc = async (request: RpcRequest) => {
    // 按请求类型分支
    switch (request.request?.$case) {
      // 主决策：出技能 / 打牌 / 切人 / 调和 / 结束
      case "action":
        return createRpcResponse("action", await this.decideAction(request.request.value.action));
      // 重投骰子：决定保留哪些骰子
      case "rerollDice":
        return createRpcResponse("rerollDice", this.decideReroll(request.request.value));
      // 其余请求省略（换留牌、选出战、选牌、选项）
      ...
    }
  };
}```

关键点：`state` 是引擎通过 `notify` 推送的**该玩家视角**快照（`exposeState(who, gameState)`），
所以启发式**天然看不到对手手牌**；只有搜索为了推演，才需要"补全"隐藏信息（见第七节）。

### 3.2 出招主流程 `decideAction`

```ts
// 主决策：从合法动作里选一手
private async decideAction(actions: readonly Action[]) {
  // 先筛出引擎标记为合法的动作下标
  const validIndexes = actions.flatMap((a, i) => a.validity === ActionValidity.VALID ? [i] : []);
  ...
  // 再筛出"付得起"的动作
  const usable = validIndexes.filter((i) => isPayable(actions[i]));
  // 全付不起时退回全部合法动作
  const pool = usable.length > 0 ? usable : validIndexes;

  // 启发式打分，取最高分
  const best = pickAction(actions, pool, { who, state, noise, rng, style, weights, data, ... });

  // 难度：按失误率随机出一手（故意变弱）
  if (this.blunderRate > 0 && this.rng() < this.blunderRate) { ... }

  // 关键扩展点：搜索 / 策略网 / DMC 通过 selectAction 注入
  if (this.selectAction) {
    // 把合法动作、启发式首选与全部启发式分传给搜索
    const custom = await this.selectAction({ action: [...actions] }, {
      who, state, heuristicIndex: best.index,
      heuristicScores: scoreActions(actions, pool, { who, state, style, weights, data }),
    });
    // 搜索返回 null 时回退启发式
    if (custom) return custom;
  }
  // 默认：启发式首选 + 引擎自动选的骰子
  return { chosenActionIndex: best.index, usedDice: [...chosen.autoSelectedDice] };
}```

这就是整个项目的"插件架构"：

- **启发式**永远先算一遍，既当兜底，又把分数传给搜索当**先验**；
- **搜索**拿到引擎内部状态（调用方持有 `Game`），自己跑推演；
- **策略网/DMC** 也实现成 `selectAction`，返回 `null` 就自动回退。

### 3.3 难度与噪声

```ts
// 难度噪声：easy 加 ±6 扰动，normal 只有 ±0.8
const DIFFICULTY_NOISE = { easy: 6, normal: 0.8 };```

`easy` 给评分加 ±6 的随机噪声（经常乱打），`normal` 只有 ±0.8（平手时扰动）。
另有 `blunderRate`（按概率随机出一手），是"降强度"最直接的手段。

---

## 四、启发式评估 v1 / v2

### 4.1 v1：6 项线性公式

最早的一版，只看"打出去这一下的即时收益"：伤害、击杀、反应、召物、治疗、费用，线性加权。
代码在 `value.ts#handcraftedValueV1`。它的问题很明显：**看不到场面、卡差、节奏**。

### 4.2 v2：22 维手工特征 + 线性权重

把局面压成 22 个手工特征（血量、骰子、手牌、召唤物、支援、充能、回合……），再线性加权。
实测 **43.0%（100 局）**——比 v1 还差，所以没上线。

### 4.3 真正的兜底：`scoreAction`（evaluate.ts）

这是 App 里始终在跑的评估器。它把引擎给的 `action.preview`（结算预览）归纳成
`PreviewSummary`，再按动作类型分派打分。

**默认权重（`DEFAULT_AI_WEIGHTS`）**：

| 项 | 默认值 | 含义 |
|---|---|---|
| `damage` | 1.1 | 每点伤害 |
| `kills` | 12 | 每次击杀 |
| `debuffs` | 0.4 | 每层负面状态 |
| `created` | 0.45 | 每生成一个实体（召唤物/支援） |
| `healed` | 0.5 | 每点治疗 |
| `cardValue` | 0.7 | 每张手牌价值 |
| `shieldChip` | 0.6 | 每点削敌方护盾 |
| `shieldBreak` | 1 | 每打破一个护盾 |
| `shieldGain` | 0.3 | 每点自己获得护盾 |
| `piercing` | 0.3 | 每点穿透（对方有盾时） |
| `cardPrior` | 0.6 | 卡牌胜率先验 |
| `charPrior` | 0.4 | 角色胜率先验 |
| `diceEcon` | 0.05 | 骰差每 1 点的进攻系数 |
| `boardPressure` | 0.12 | 场面差每 1 单位 |

**四个局面系数**（代码里逐项计算）：

```ts
// 对面越残，伤害越值钱
const raceFactor = enemyHp <= 15 ? 1.35 : enemyHp <= 22 ? 1.18 : 1.0;
// 自己残血时更谨慎
const caution = myHp <= 12 ? 0.9 : 1.0;
// 手牌少时别乱甩牌
const cardPressure = (me?.handCard.length ?? 0) <= 2 ? -0.35 : 0;
// 快速行动不交节奏，给一点加成
const speedBonus = action.isFast ? 0.25 : 0;
// 骰子领先时更激进，落后时保守
const diceEcon = 1 + clamp(diceGap * weights.diceEcon, -0.15, 0.25);
// 场面落后时铺场更值钱
const boardPressure = 1 + clamp(boardGap * weights.boardPressure, -0.2, 0.45);```

再叠加**风格**（aggro/control/midrange）与**斩杀线**：

```ts
// 牌组风格：快攻加伤害、控制加治疗
const styleDamage = style === "aggro" ? 1.15 : style === "control" ? 0.9 : 1;
// 斩杀线：把敌方出战压到 3 血以内，额外加分
const pressureBonus = enemyActive && summary.damage > 0 && enemyActive.health - summary.damage <= 3 ? 0.8 : 0;```

### 4.4 大招经济（充能逻辑）

`useSkill` 分支里有一条"充能来之不易"的硬规则：

```ts
// 需要充能的大招单独处理
if (needsEnergy) {
  // 能击杀才值得放，否则先攒着
  return summary.kills > 0
    // 能击杀：高基础分 + 伤害加成 - 费用惩罚
    ? 6 + summary.damage * 1.2 - cost * 0.05
    // 不能击杀：低分，只保留少量伤害价值
    : -0.6 + summary.damage * 0.2 - cost * 0.05;
}```

普通技能则是"伤害 × 各项系数 + 击杀 + 反应 + 拆盾/治疗 + 场面"的加权和。
这套公式是**拍脑袋定的**，但每一项都有明确理由，方便后续调参（实测调参空间已经很小）。

### 4.5 搜素里的"大招计划"

搜索额外加了一层：`burstPlanOf(state, who)` 检查出战角色的大招还差几颗元素骰、能量是否满。

- 能量满、**缺骰** → 给 `elementalTuning`（元素调和）加 3.2 分，优先凑骰；
- 能量满、**骰够** → 给大招加 3.5 分，直接顶上去。

实测大招计划 **+3.3 点**（606 局 53.3%），是搜索里少数"非 rollout"的收益来源。

---

## 五、候选动作编码与策略网络

### 5.1 动作类别

```ts
// 六类动作，顺序是模型的一部分，改动后必须重训
export const ACTION_KINDS = [
  "useSkill", "playCard", "switchActive", "elementalTuning", "declareEnd", "none",
] as const;```

### 5.2 每个候选的 7 个数值特征

```ts
// 一个候选动作的 7 个数值特征
export interface CandidateFeatures {
  // 类别（用于 6 维 one-hot）
  k: string;
  // 总费用（骰子数）
  cost: number;
  // 对敌方伤害 / 10（截断到 1）
  dmg: number;
  // 能否击杀 0/1
  kill: number;
  // 是否快速行动 0/1
  fast: number;
  // 敌方出战血量 / 10
  tgtHp: number;
  // 是否"宣布结束" 0/1
  end: number;
}```

### 5.3 拼成网络输入

```ts
// 把候选动作拼成网络输入
function encodeCandidate(c, withScore) {
  return [
    // 6 维 one-hot（动作类别）
    ...ACTION_KINDS.map((kind) => (c.k === kind ? 1 : 0)),
    // 6 维数值：费用、伤害、击杀、快攻、目标血、结束
    c.cost, c.dmg, c.kill, c.fast, c.tgtHp, c.end,
    // 可选：把启发式分也喂进去（模型输入变 14 维）
    ...(withScore ? [c.sc] : []),
  ];
}```

所以策略网输入 = **44 维局面 + 13 维动作**（`usesScore` 时 14 维）。
这个编码必须与 `tools/train_policy.py#encode_action` **逐位一致**，否则训出来的权重对不上。

### 5.4 前向（与 DMC 共用同一个格式）

```ts
// 给每个候选打分：44 维局面 + 13 维动作 → 前向
export function policyScores(weights, stateVector, candidates) {
  return candidates.map((candidate) => {
    // 拼输入并按训练时的 mean/std 归一化
    let current = [...stateVector, ...encodeCandidate(candidate, withScore)]
      .map((value, i) => (value - weights.mean[i]) / (weights.std[i] || 1));
    // 逐层前向
    for (const layer of weights.layers) {
      // 线性层：权重矩阵 × 输入
      current = layer.w.map((row) => row.reduce((s, w, i) => s + w * (current[i] ?? 0), 0));
      // 激活函数：relu 或 tanh
      current = current.map((v) => activate(v, layer.act));
    }
    // 输出层只有一个分数
    return current[0] ?? 0;
  });
}```

`PolicyWeights` 就是一个纯 JSON：`stateDim / actionDim / mean / std / layers`，
手机端一次前向是几微秒量级，不需要 WebGL。

### 5.5 训练目标与结果

训练脚本 `tools/train_policy.py` 把「搜索选出的那一手」当正样本，做 state-action 打分
（softmax/BCE 类损失）。离线准确率可以很高，但**上线后四种用法全部失败**（见第九节）。

---

## 六、搜索：PIMC + 扁平 rollout

这是 App 默认 AI，也是整个项目唯一"确实变强"的路线。

### 6.1 为什么不是 MCTS

标准 MCTS 需要在一个**确定**的状态上反复模拟、扩展树；但这个游戏：

- 隐藏信息（对手手牌/牌堆）必须先"猜"；
- 分支因子大（每步 5~20 个候选），树很快爆炸；
- 引擎单步开销 ~15-20ms（即使跳过预览），建树不划算。

所以选的是 **PIMC（Perfect Information Monte Carlo）**：每个 rollout 先随机补全一个
"自洽的世界"（确定化），然后在**完整信息**下用廉价策略打到底，统计胜负。
每条 rollout 独立、可并行、实现简单——代价是有"确定性化偏差"，但实测够用。

### 6.2 主循环骨架

```ts
// 所有候选共用同一批随机世界（降方差）
const baseSeed = Math.floor(rng() * 0x7fffffff);
// 最多试 8 个候选
const candidates = heuristicOrder.slice(0, maxCandidates);

// 阶段 1：每个候选先跑 1 条线（粗筛）
for (const index of stats.keys()) {
  // 预算用完就停
  if (Date.now() >= deadline) break;
  // 跑一条影子对局
  await playout(index, rollouts++);
}
// 阶段 2：剩余时间全砸给当前前三名
while (Date.now() < deadline) {
  // 取当前排名前三
  const pool = ranked.slice(0, 3);
  // 选其中线数最少的补一条
  const target = 池子里线数最少的那个;
  await playout(target, rollouts++);
}```

**公共随机数**是关键工程细节：同一个 `rolloutIndex` 在所有候选上使用同一个种子，
比较候选时面对的是同一批世界，方差显著变小。

### 6.3 一条 rollout 里发生了什么

```ts
// 从序列化快照恢复一个可推演的局面
const restored = deserializeGameStateLog(data, JSON.parse(serialized))[0].state;
// 1) 补全隐藏信息（真实模式 / A 方案）
if (!options.perfectInformation) determinizeState(restored, who, policyRng, { realisticHidden });

// 2) 复制局面，静默跑一局（可跳过预览提速）
const game = new Game(restored, { silent: true, skipPreview: options.skipRolloutPreview ?? false });

// 3) 双方都用"廉价策略"出招；第一条线强制选当前候选动作
game.players[who].io = { notify: () => {}, rpc: responder(who, true) };
game.players[1 - who].io = { notify: () => {}, rpc: responder(1 - who, false) };

// 打到底，拿胜负
const winner = await game.start();
// 截断时用局面估值；否则赢=1 平=0 输=-1
const score = cutShort ? valueOf(game.state, who) : winner === who ? 1 : winner === null ? 0 : -1;```

- `fastReply`：推演专用廉价策略，**不读局面**，只看动作本身（伤害/击杀/反应/生成物/费用）；
- `maxActions` 截断时（`RolloutCutoff`）用 `valueOf` 估分，避免"跑不完就丢弃"；
- `skipPreview`：推演里不生成结算预览，单动作从 ~20ms 降到 ~7ms，是 **+13.9 点**的来源。

### 6.4 候选排序与"必杀直出"

启发式先给每个合法动作排个序（`rawPriority`），再叠加：

```ts
// 后台预计算命中：把这一手顶到最前
if (index === cachedIndex) bonus += 4;
// 大招缺骰：优先元素调和凑骰
if (tuningBoost > 0 && kind === "elementalTuning") bonus = tuningBoost;
// 大招就绪：优先放大招
if (burstBoost > 0 && isBurst) bonus = burstBoost;```

另外：如果预览里已经能**直接打死一个角色**，且只有唯一一手能做到，就不再搜索，直接出。

### 6.5 预算怎么花

```ts
// 分支越少，越不需要想那么久
const branchingScale = candidates.length <= 2 ? 0.25 : candidates.length <= 4 ? 0.6 : 1;
// 后台算过的局面只花 35% 预算复核
const cachedBudget = cachedIndex >= 0 ? Math.min(budgetMs, cachedBudgetMs ?? budgetMs * 0.35) : budgetMs;
// 见过的局面按访问次数打折，再乘分支系数
const effectiveBudget = cachedBudget * (visits === 0 ? 1 : visits === 1 ? 0.6 : 0.4) * branchingScale;```

- 分支少 → 少想；
- 见过的局面（`visits`）→ 少想；
- 后台算过的局面 → 只花 35% 时间复核。

### 6.6 结果融合

```ts
// 推演结果与启发式先验融合
const blended = stats.map((stat) => {
  // 优先用外部传入的启发式分，否则用初始分
  const prior = options.heuristicScores?.get(stat.index) ?? stat.heuristic;
  // 75% 推演胜率 + 25% 先验（tanh 压到 -1..1）
  return stat.average * 0.75 + Math.tanh(prior / 4) * 0.25;
});```

**75% 推演胜率 + 25% 启发式先验**：低预算时防止被一两条噪声线带偏。

### 6.7 实测

| 配置 | 对纯启发式 |
|---|---|
| 搜索 150ms | 60.7%（798 局） |
| 搜索 600ms | 85.5%（207 局） |
| 600ms vs 150ms | 75.7%（415 局） |
| 跳过 rollout 预览 | 63.9%（416 局，+13.9 点） |

核心规律：**强度几乎全部来自 rollout 次数，翻倍约 +12~13 点。**
2500ms 预算下约 124 条 rollout/决策（约 20ms/条）。

---

## 七、隐藏信息与"猜牌"

### 7.1 老逻辑的问题

`determinizeState` 原本会：

1. 把对手**真实**的 `hands + pile` 合在一起；
2. 按 `handLikelihood` 加权，随机挑 `handSize` 张当手牌；
3. 剩下的洗回牌堆。

它没有读牌堆**顺序**，但读了"对手这 30 张到底是什么"——这是**隐藏信息**。
更糟的是特征里的 `deckPriorDiff` 曾经直接读对手 `initialPile`。

### 7.2 A 方案：只用公开信息猜一副牌

```ts
// A 方案：只用公开信息猜对手的牌
if (realisticHidden) {
  // 按牌组库先验猜出对手整副牌
  const guessed = guessEnemyCards(state, enemyWho, rng);
  if (guessed !== null) {
    // 前 handSize 张当手牌
    enemy.hands = guessed.slice(0, handSize);
    // 剩下的当牌堆
    enemy.pile = guessed.slice(handSize);
    // 自己的牌堆也洗一下
    shuffleInPlace(players[who].pile, rng);
    // 不再读真实手牌/牌堆
    return;
  }
}```

`guessEnemyCards` 的流程：

1. `deckCardPrior(state, who)`：按对手**已公开的角色**，从 `DECK_LIBRARY`（4,557 套）里
   找同队/同风格牌组，统计每张牌的出现频率，得到"这副牌可能长什么样"的先验；
2. 减去**已经露过面**的牌（场上实体 + removedEntities），每张最多 2 张（`MAX_CARD_COPIES`）；
3. 手牌按 `handLikelihood` 加权（低费、事件牌更可能留在手里），牌堆只按牌组先验；
4. 凑够真实张数（手牌 + 牌堆）。

```ts
// 一张牌"还在对手手里"的先验权重
function handLikelihood(definition) {
  // 技能费用总和（费用越高越可能被留在手里）
  const cost = ...;
  // 低费牌更容易被留在手里
  const costBonus = total <= 1 ? 1.45 : total <= 2 ? 1.15 : 0.85;
  // 事件牌 > 装备牌 > 其它
  const typeBonus = type === "eventCard" ? 1.1 : type === "equipment" ? 1.0 : 0.95;
  // 两个系数相乘
  return costBonus * typeBonus;
}```

### 7.3 实测与结论

- App 等价配置下，A 方案 vs 旧逻辑：**48.7%（224 局）**——打平；
- 说明"偷看牌库内容"带来的虚高很小，搜索的强度主要来自 rollout 数量；
- 附带修复了 `deckPriorDiff` 泄漏：现在只用"场上角色的公开信息"估计对手牌组强度；
- 审计测试：篡改对手 `initialPile` 不应改变任何一维特征。

---

## 八、价值网络与查表价值

### 8.1 44 维特征

`value.ts#FEATURE_NAMES` 定义了全部 44 维（逐维说明见附录）：

| 组 | 维度 |
|---|---|
| 血量/存活（6） | `myHp, enemyHp, myAlive, enemyAlive, myActiveHp, enemyActiveHp` |
| 资源（8） | `myEnergy, enemyEnergy, myDice, enemyDice, myHands, enemyHands, myPile, enemyPile` |
| 场面（10） | `mySummons, enemySummons, mySupports, enemySupports, myEquip, enemyEquip, myStatus, enemyStatus, myShield, enemyShield` |
| 逐角色（12） | 双方 3 个角色的 HP 与充能 |
| 节奏（3） | `round, iAmFirstSeat, isMyTurn` |
| 先验（1） | `deckPriorDiff`（我 vs 对手牌组强度，公开信息估计） |
| 大招（4，v6） | `myBurstDiceGap, myBurstEnergyGap, myBurstReady, myTunable` |

### 8.2 网络与推理

```ts
// 价值网前向：44 维 → MLP → [-1,1]
export function nnValue(weights, features) {
  // 没有权重直接返回 null（回退其它评估）
  if (!weights || weights.layers.length === 0) return null;
  // 维度对不上说明权重过期，放弃
  if (weights.mean.length !== features.length) return null;
  // 按训练时的 mean/std 归一化
  let current = features.map((v, i) => (v - weights.mean[i]) / (weights.std[i] || 1));
  // 逐层前向
  for (const layer of weights.layers) {
    // 线性层
    current = layer.w.map((row) => row.reduce((s, w, i) => s + w * (current[i] ?? 0), 0));
    // 激活
    current = current.map((v) => activate(v, layer.act));
  }
  // 输出压到 -1..1
  return clamp(current[0] ?? 0, -1, 1);
}```

训练脚本 `tools/train_value.py`：numpy MLP（64→32→1，tanh），标签是**终局胜负**，
输出 [-1, 1] 当作"我方优势"。

### 8.3 为什么失败了

| 实验 | 结果 |
|---|---|
| 价值网 vs 无价值网（1,040 局） | +1.1 点（p≈0.25） |
| 价值网 @600ms（208 局） | 47.6% |
| 离线 val_sign | 70%+ |

**离线精度不转化为胜率**：价值网学的是"终局谁赢"，但搜索需要的是"当前这手棋的相对好坏"，
两者有系统性偏差；再加上 44 维特征对局面压缩太狠。

### 8.4 查表价值

`featureKey(features)` 把 44 维量化成字符串当 key，`tableValue` 查表，59 万条样本只覆盖
**3.8%** 的桶——局面指纹几乎不重复，查表路线直接判死。

---

## 九、策略网络的四种用法

| 实验 | 局数 | 胜率 | 判定 |
|---|---|---|---|
| 独立出招（启发式标签训练） | 396 | 35.6% | ❌ 远弱于启发式 |
| 独立出招（v3 子集 28.5 万条） | 400 | 1.0% | ❌ 候选语义不匹配 |
| 策略网 vs 搜索 | 208 | 38.5% | ❌ |
| 策略头引导搜索 | 207 | 46.9% | ❌ 稀释了 rollout 权重 |

补充：离线（下一步预测）准确率可以做到 44.2%（含启发式分输入）/ 36.7%（不含），
但**离线准不准和上线强不强没有关系**——上面的胜率才是结论。

原因：**每步独立打分 ≠ 多步规划**。策略网只见过"老师在这一步选什么"，
没有 rollout 的长期收益信号；而搜索强就强在多步展开。

---

## 十、DMC：深度蒙特卡洛自对弈

### 10.1 原理

DouZero 式：学 `Q(s, a)`，用**整局最终胜负**当标签，ε-greedy 自对弈产生数据，
推理时**不搜索**，一次前向取 argmax。

与策略网的区别：
- 策略网：模仿"老师这一步选什么"（监督学习）；
- DMC：回归"走这一步最后赢没赢"（价值学习）。

### 10.2 推理代码（dmc.ts）

```ts
// 候选池：合法且付得起；退化为合法；再退化为全部
function candidatePool(actions) {
  // 合法动作下标
  const valid = actions.flatMap((a, i) => a.validity === ActionValidity.VALID ? [i] : []);
  // 其中付得起的
  const payable = valid.filter((i) => isPayable(actions[i]));
  // 优先可支付，其次合法，最后全部
  return payable.length > 0 ? payable : valid.length > 0 ? valid : actions.map((_, i) => i);
}

// DMC 出招：Q 最大，ε 概率随机
export function pickDmcAction(weights, actions, state, options) {
  // 给候选算 Q(s,a)
  const candidates = dmcScoreCandidates(weights, actions, state, options);
  // ε-greedy：随机探索 or 取 Q 最大
  const picked = epsilon > 0 && rng() < epsilon
    // 探索：随机一个候选
    ? candidates[Math.floor(rng() * candidates.length)]
    // 利用：取 Q 分数最高的候选
    : candidates[policyScores(weights, stateFeatures(state, who), candidates)
        .reduce((best, score, i, scores) => score > scores[best] ? i : best, 0)];
  // 返回动作下标与骰子
  return { chosenActionIndex: picked.index, usedDice: actions[picked.index].autoSelectedDice ?? [] };
}```

权重格式与策略网**完全一致**（同一个 `PolicyWeights` JSON），所以手机端加载逻辑复用。

### 10.3 训练链

- 采样：`scripts/dmc-selfplay.mjs`，自对弈，ε 从 0.25 降到 0.06；
- 样本：`{"x":[44 维],"c":{13 维动作},"r":±1 整局回报}`，gzip 追加；
- 训练：`tools/train_dmc.py`，两遍扫描 + float32 预分配（千万样本省内存）；
- 结果：R0 5k 局 → R3 35k 局，共 312 万样本；Q0~Q4 权重。

### 10.4 实测

| 对比 | 局数 | 结果 |
|---|---|---|
| DMC vs 纯启发式 | 224 | 67.6% |
| DMC vs 搜索 150ms | 224 | 50.2% |
| DMC vs App 2500ms | 224 | 28.7% |

推理成本约 **0.1ms/手**，强度约等于 150ms 搜索。曲线外推 1,000 万局对 App AI 仍只有 ~37%，
未过 55% 门槛，按计划封存。

---

## 十一、经验库、学习器与训练器

### 11.1 决策记忆（memory.ts）

```ts
// 一条决策记忆
export interface MemoryEntry {
  // 动作指纹
  actionKey: string;
  // 置信度
  confidence: number;
  // 访问次数
  visits: number;
  // 同一结论出现次数
  sameCount: number;
}```

`memoryKey(serializedState, request)` 用"局面序列化 + 候选动作指纹"做 key。
命中且满足 `visits >= 2 && (sameCount >= 2 || confidence >= 0.7)` 时，**0ms 复用**。

实测命中率很低（局面指纹几乎不重复），但作为纯性能优化无害。

### 11.2 学习器（learner.ts）

```ts
// 经验库结构
export interface LearningData {
  // 数据版本
  version: string;
  // 对局日志
  games: GameLogEntry[];
  // 单卡胜率
  cards: Record<number, LearningEntry>;
  // 角色胜率
  characters: Record<number, LearningEntry>;
  // 牌组胜率
  decks: Record<string, DeckRecord>;
}```

- `recordGame` 每局结束更新；
- `cardWeights` / `characterWeights` 把胜率转成 [-0.3, 0.3] 的先验，喂给 `scoreAction`；
- `mergeLearning` 支持手机端导入训练器的 `gitcg-trained-ai-*.json`。

### 11.3 训练器（selfplay.ts + trainer/）

多线程自对弈：

1. 每线程复制一份 `Game`，双方都挂 `AiPlayer`；
2. 打完整局 → `recordGame`；
3. 定期 `mergeLearning` 写 `learning.json`；
4. 导出 `gitcg-trained-ai-*.json`，在 App「设置 → 导入 AI 数据」回灌。

它优化的是**经验先验**（开局留牌、单卡偏好），不是搜索强度。

---

## 十二、后台预计算与沉思

`precomputeLine` 在对手思考时后台跑一条"下一手可能是啥"，存 5 分钟（TTL），
前台命中时只花 35% 预算复核。

实测命中率 **0.59%**（4,239 手）——基本没用，已默认关闭。

`ponder.ts` 是它的策略版：后台对当前局面做浅搜索，把候选分传给前台。

---

## 十三、失败组件档案

| 组件 | 原理 | 代码 | 实测 | 结论 |
|---|---|---|---|---|
| 价值网 | 44 维 → MLP → 胜负 | `value.ts#nnValue` | +1.1 点 | 离线精度不转化 |
| 查表价值 | 特征桶 → 胜率 | `tableValue` | 覆盖 3.8% | 太稀疏 |
| 决策记忆 | 局面 key → 动作 | `memory.ts` | 0/3,592 | 指纹不重复 |
| 静态先验 | 卡牌固定权重 | `AUTHOR_HINTS` | 51.3% | ≈0 |
| 学习先验 | 经验胜率 → 评分 | `cardWeights` | 52.6% | ≈0 |
| 策略网 ×4 | 见第九节 | `policy.ts` | 1.0~46.9% | 全面失败 |
| 权重进化 | 随机扰动 + 淘汰 | `evolve-weights.mjs` | 87.5% → 复验 50% | 学的是噪声 |
| 加深推演 | maxActions 10→30 | `search.ts` | 51.9% | 预算不变时无用 |
| 降预算 | 150→80ms | `search.ts` | 46.2% | 无差异 |
| 后台预计算 | 缓存下一手 | `precomputeLine` | 0.59% 命中 | 无效 |
| DMC 扩样 | 更多自对弈 | `dmc-selfplay.mjs` | 28.7% vs App | 封存 |

**共同教训**：能稳定提升的只有"更多 rollout"和"更快的 rollout"（跳过预览）。

---

## 十四、评估方法论：镜像配对 A/B

### 14.1 为什么必须镜像

同一牌组、同一随机种子，打两局并**交换先手**，抵消先手优势与随机性：

- 对局 i：A 先手，B 后手（seed = i）；
- 对局 i+1：B 先手，A 后手（同一 seed）；
- 两局结果合并成一条样本，抵消先手与随机性。

### 14.2 工具

`scripts/ab-value.mjs`：

- 参数：`--a/--b`（模式）、`--pairs`、`--offset`（分片）、`--budget`、`--dmc`、`--realisticHidden`；
- 输出：每局一行 `RESULT {...}`，最后一行 `SUMMARY {...}`；
- 聚合：`tools/aggregate_ab.py`。

### 14.3 必须跑的对照

| 对照 | 作用 |
|---|---|
| 同配置 vs 同配置（sanity） | 应得 50%；实测 52.5% → **A 侧 +2.5% 偏差** |
| v1 vs v1 | 复核框架偏差（52.7%） |
| 不同 seed 区间 | 防止单区间偶然 |

### 14.4 样本量

| 局数 | 95% 误差 |
|---|---|
| 100 | ±9.8% |
| 380 | ±5% |
| 2,000 | ±2.2% |

**100 局的结论不能当决策依据**（曾出现 41.4% 的假信号，224 局复测回到 52.2%）。

---

## 十五、自创术语表

| 术语 | 英文/代码 | 含义 |
|---|---|---|
| 确定性化 | determinize | 把隐藏信息随机补全成一个"确定的世界"，供 rollout 使用 |
| 真实模式 | realisticHidden=false | 沿用真实牌的多重集重新分配手牌/牌堆（仍不读顺序） |
| A 方案 | realisticHidden=true | 连"对手 30 张是什么"都不读，按牌组库先验猜 |
| 猜牌 | guessEnemyCards | A 方案的具体实现 |
| 牌组先验 | deckCardPrior | 按角色从 DECK_LIBRARY 统计牌组构成 |
| 手牌似然 | handLikelihood | 一张牌"还在手里"的权重（低费/事件牌更高） |
| 扁平 rollout | flat rollout | 不建树，每条线独立打到底 |
| 公共随机数 | baseSeed + rolloutIndex | 所有候选共用同一批随机世界，降方差 |
| 预算 | budgetMs | 一次决策允许思考的毫秒数（App 默认 2500） |
| 跳过预览 | skipRolloutPreview | 推演内不生成结算预览，速度快 2~3 倍（+13.9 点） |
| 大招计划 | burstPlan | 缺骰时调和凑大招、骰够时优先大招 |
| 快速行动 | isFast | 不交节奏的动作，评分 +0.25 |
| 斩杀线 | pressureBonus | 把对方出战压到 ≤3 血时的额外加分 |
| 拆分/破盾 | shieldChip / shieldBreak | 削护盾与打破护盾的收益（永久盾更值钱） |
| 骰子经济 | diceEcon | 骰差带来的进攻/保守系数 |
| 场面差 | boardPressure | 召唤物/支援数量差带来的铺场系数 |
| 失误率 | blunderRate | 按概率随机出招，用于降难度 |
| 难度噪声 | DIFFICULTY_NOISE | easy=6 / normal=0.8 的评分扰动 |
| 镜像配对 | mirror pairing | 同牌组同种子打两局交换先手 |
| sanity 对照 | sanity check | 同配置对打，验证框架是否 50% |
| A 侧偏差 | A-side bias | 框架自带的先手/顺序偏差（实测 +2.5%） |
| 特征桶 | featureKey | 44 维量化后的查表 key |
| 命中率 | cache hit rate | 记忆/预计算/查表的复用比例 |
| 行动指纹 | actionKey | 动作的稳定字符串标识（恢复局面后找回同一手） |
| 候选池 | candidatePool | 合法且付得起的动作集合 |
| ε-greedy | epsilon | 以 ε 概率随机探索，否则取 Q 最大 |
| 整局回报 | r ∈ {-1,0,1} | DMC 的训练标签 |
| 双头网络 | twinNet | 同时输出价值与策略的实验结构（未落地） |
| 贝叶斯读牌 | bayes | 按公开信息更新对手手牌分布的实验开关 |
| 后台沉思 | ponder | 对手回合时后台预搜索 |

---

## 十六、代码地图

| 文件 | 职责 | 关键函数 |
|---|---|---|
| `src/player.ts` | AI 生命周期、六类决策入口、难度 | `AiPlayer`、`decideAction`、`isPayable` |
| `src/evaluate.ts` | 启发式评分、预览归纳 | `scoreAction`、`pickAction`、`summarizePreview` |
| `src/search.ts` | PIMC 搜索、确定性化、猜牌、记忆/预计算 | `searchBestAction`、`determinizeState`、`guessEnemyCards` |
| `src/value.ts` | 44 维特征、线性/MLP/查表 | `stateFeatures`、`nnValue`、`handcraftedValueV2` |
| `src/policy.ts` | 动作编码、state-action 打分 | `candidateFeatures`、`policyScores` |
| `src/dmc.ts` | Q(s,a) 推理 | `pickDmcAction`、`dmcScoreCandidates` |
| `src/memory.ts` | 决策记忆 | `memoryKey`、`createMemoryAdapter` |
| `src/learner.ts` | 经验库 | `recordGame`、`cardWeights`、`mergeLearning` |
| `src/selfplay.ts` | 自对弈/进化 | `EvolutionOptions`、`FastGameResult` |
| `src/ponder.ts` | 后台沉思 | `ponder` |
| `src/deck.ts` | 牌组合法性 | 3 角色/30 牌/同名 2 张/秘传 1 张 |

实验与工具：

| 文件 | 用途 |
|---|---|
| `scripts/ab-value.mjs` | 镜像配对 A/B 主程序 |
| `scripts/collect-trajectories.mjs` | 样本采集（v3/v6） |
| `scripts/dmc-selfplay.mjs` | DMC 自对弈采样 |
| `scripts/dmc-diagnostics.mjs` | DMC 行为诊断 |
| `scripts/dmc-report.mjs` | 实验链报告 |
| `tools/train_value.py` | 价值网训练 |
| `tools/train_policy.py` | 策略网训练 |
| `tools/train_dmc.py` | DMC 训练（千万样本内存优化） |

App 接线：`packages/standalone/src/ai-flags.ts`（开关与预设）、`search.worker.ts`（搜索线程）、
`StandaloneParent.tsx`（按开关创建 AI，DMC > 搜索 > 启发式，失败自动回退）。

---

## 十七、参数速查与 FAQ

### 搜索默认参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `budgetMs` | 2500（balanced） | 思考预算 |
| `maxCandidates` | 8 | 最多尝试的候选数 |
| `maxActions` | 0（打到底） | rollout 深度上限 |
| `realisticHidden` | true（App） | A 方案猜牌 |
| `skipRolloutPreview` | true（App） | 推演跳过预览 |
| 融合权重 | 0.75 / 0.25 | 推演胜率 / 启发式先验 |
| 第二阶段 | 前三名 | 剩余时间分配 |

### FAQ

**Q：AI 能看到我的牌吗？**
A：启发式永远只吃该玩家可见信息；搜索默认走 A 方案，按公开信息猜牌，不读真实手牌/牌堆。

**Q：为什么 2500ms 比 150ms 强那么多？**
A：rollout 数翻倍约 +12~13 点；2500ms 约 124 条 rollout/决策。

**Q：DMC 为什么不用在 App？**
A：0.1ms/手 很快，但只到 150ms 搜索强度；对 2500ms 搜索仅 28.7%，未过门槛。

**Q：价值网为什么没用？**
A：离线 val_sign 70%+，但 +1.1 点（p≈0.25）；"整局胜负"标签与"单步好坏"目标不一致。

**Q：为什么同一套牌重新编码会得到不同牌组码？**
A：编码会挑选校验字节避开敏感词黑名单，`last` 不同、内容相同。

---

## 十八、附录：44 维特征逐维说明

| # | 名称 | 含义 | 归一化 |
|---|---|---|---|
| 0 | `myHp` | 我方三角色总血量 | /30 |
| 1 | `enemyHp` | 敌方总血量 | /30 |
| 2 | `myAlive` | 我方存活角色数 | /3 |
| 3 | `enemyAlive` | 敌方存活角色数 | /3 |
| 4 | `myActiveHp` | 我方出战血量 | /10 |
| 5 | `enemyActiveHp` | 敌方出战血量 | /10 |
| 6 | `myEnergy` | 我方总充能 | /9 |
| 7 | `enemyEnergy` | 敌方总充能 | /9 |
| 8 | `myDice` | 我方骰子数 | /10 |
| 9 | `enemyDice` | 敌方骰子数 | /10 |
| 10 | `myHands` | 我方手牌数 | /10 |
| 11 | `enemyHands` | 敌方手牌数 | /10 |
| 12 | `myPile` | 我方牌堆数 | /30 |
| 13 | `enemyPile` | 敌方牌堆数 | /30 |
| 14 | `mySummons` | 我方召唤物数 | /4 |
| 15 | `enemySummons` | 敌方召唤物数 | /4 |
| 16 | `mySupports` | 我方支援数 | /4 |
| 17 | `enemySupports` | 敌方支援数 | /4 |
| 18 | `myEquip` | 我方装备数 | /6 |
| 19 | `enemyEquip` | 敌方装备数 | /6 |
| 20 | `myStatus` | 我方状态数 | /10 |
| 21 | `enemyStatus` | 敌方状态数 | /10 |
| 22 | `myShield` | 我方护盾总量 | /10 |
| 23 | `enemyShield` | 敌方护盾总量 | /10 |
| 24-29 | `myChar1Hp` … | 双方 3 角色血量 | /10 |
| 30-35 | `myChar1Energy` … | 双方 3 角色充能 | /3 |
| 36 | `round` | 回合数 | /15 |
| 37 | `iAmFirstSeat` | 我是否先手 | 0/1 |
| 38 | `isMyTurn` | 是否我的回合 | 0/1 |
| 39 | `deckPriorDiff` | 牌组强度差（公开信息估计） | tanh |
| 40 | `myBurstDiceGap` | 大招还差几个骰 | /3 |
| 41 | `myBurstEnergyGap` | 大招还差几点能量 | /3 |
| 42 | `myBurstReady` | 骰与能量都够 | 0/1 |
| 43 | `myTunable` | 可用于调和的牌数 | /10 |

> 具体归一化常数以 `value.ts#stateFeatureMap` 为准；本表给出量级，便于理解。

---

_文档版本：2026-11-28 · 对应仓库 `docs/AI-实现详解.zh.md`。_


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI.zh.md](AI.zh.md) · [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md)
- [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md) · [DATA.zh.md](DATA.zh.md)
- [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
