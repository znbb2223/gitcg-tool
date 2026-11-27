<div align="center">

# 七圣召唤 AI · 成果总览（2026-11-28）

[项目总总结](../项目总总结-2026-11-28.md) · [AI 终结报告](./AI-终结报告-2026-11-28.md) · [实现详解](../../docs/AI-实现详解.zh.md) · [实验记录](../../docs/AI-EXPERIMENTS.zh.md) · [文档中心](../../docs/README.md)

</div>

> **状态：已封存。** AI 研究线于 2026-11-28 03:38 停止迭代，App 保留搜索版 AI（默认 2500ms）。
> 最终结论、失败清单与归档数据见 [AI-终结报告-2026-11-28.md](./AI-终结报告-2026-11-28.md)；
> 项目整体收官见 [../项目总总结-2026-11-28.md](../项目总总结-2026-11-28.md)。

> 这份文档是 AI 相关工作的**总入口**：现状、数字、代码位置、复现方法、失败清单和下一步。
> 更细的交接材料在 `AI现状总览-2026-11-27.md`，专项改造记录在 `隐藏信息改造-2026-11-27夜.md`。

## 一、一句话现状

线上 AI = **规则引擎 + 启发式评估 + 推演搜索**，其余组件（价值网 / 策略网 / 查表 / 决策记忆 / 贝叶斯 / LLM）默认全关。
强度几乎全部来自 **rollout 次数**；搜索"偷看对手手牌"的结构性缺陷已在本次改造中修掉。
诚实定位：**比随便打强、不如熟练玩家**（所有胜率都来自 AI 对 AI，不含人类对局）。

## 二、能力与数字

### 线上配置（App 默认）

| 项 | 值 |
|---|---|
| 搜索预算 | `gitcg.ai.flags` → `search.budgetMs = 2500`（`strong` 预设 8000，`saver` 关闭） |
| 推演内预览 | 跳过（`skipRolloutPreview = true`） |
| 隐藏信息 | 不读对手真实手牌/牌堆，按牌组库先验猜牌（`realisticHidden = true`） |
| 其它组件 | 价值网 / 策略网 / 查表 / 记忆 / 贝叶斯全关 |

### 本机实测吞吐

- 2500ms 一次决策 ≈ **124 条 rollout**（深度 10），每条约 **20ms**；分支少时会提前收手。

### A/B 结论（镜像配对，同牌组同 seed 打两局交换先手）

| 实验 | 样本 | 结果 |
|---|---|---|
| 搜索 vs 纯启发式 | 798 局 | **60.7%**（重跑 208 局 60.1%，一致） |
| 跳过 rollout 预览 vs 完整预览 | 416 局 | **63.9%**（重跑 207 局 65.2%） |
| 600ms vs 150ms | 415 局 | **75.7%**（重跑 208 局 75.0%） |
| 搜索 @600ms vs 纯启发式 | 207 局 | **85.5%** |
| 猜牌（A 方案）vs 旧逻辑，App 等价配置 | 224 局 | **48.7%**（打平，可测损失 ≤1.3 点） |
| 大招计划（缺骰调和凑大招） | 606 局 | 53.3%（+3.3 点） |

**核心规律：rollout 数每翻一倍 ≈ +12~13 点胜率。** 所以"加算力"有用，但天花板取决于推演质量与评估函数。

## 三、关键改造：搜索不再偷看对手手牌

改造前 `searchBestAction` 直接吃 `game.state`（核心态），`determinizeState` 只是把对手**真实**的剩余牌在
手牌/牌堆间重洗 → 搜索知道对手那 30 张是什么，属于结构性作弊（对照：启发式 AI 用 `exposeState()`，是受限的）。

改造后（A 方案）：

1. `packages/core/src/utils.ts` 新增 `createCardEntity(state, definitionId)`：按定义初始值造卡牌实体，
   id 从 `state.iterators.id` 递减，不参与现有结算路径。
2. `packages/ai/src/search.ts` 的 `determinizeState` 增加 `{ realisticHidden }`：
   - 卡池 = 牌组库（4,557 套）中与对手三个角色**同队**的套牌，按出现频次当先验；
   - 再按"已经露面的牌"（场上实体 + 本阶段被移除的牌）扣同名张数；
   - 权重 = 牌组先验 × `handLikelihood`（费用/类别），同名最多 2 张；
   - 产出张数 = `handSize + pileSize`，与真实张数一致，不打乱抽牌节奏；
   - **全程不读 `enemy.hands` / `enemy.pile` / `enemy.initialPile` 的真实内容**。
3. 开关：`--realisticHidden`（A 方）/ `--realisticHiddenB`（B 方），代码默认关；App 的
   `search.worker.ts` 已固定开启（搜索与后台胜率估算都开）。

验证：112 局 A/B（猜牌 vs 真实牌）57–55、0 出错；8 组不同队伍的猜牌不变量全部通过（张数/id/实体类型/续打不崩）；
猜中真实牌库比例 42%~100%。残留问题：`initialPile` 仍是真实牌组，卡牌效果里读 `$inInitialPile` 会看到真值（推演策略不读它）。

## 四、已证伪的方向（别重走）

| 方向 | 样本 | 结果 |
|---|---|---|
| 价值网络（40 维 MLP） | 1,040 局（150ms）+ 208 局（600ms） | 51.1% / 47.6%，离线精度不转化成功力 |
| 策略网络（替代 / 搜索标签 / 去 sc / 引导搜索） | 1,000+ 局 | 35.6% / 44.2% / 36.7% / 46.9% |
| 查表价值 | 59 万条样本 | 落进 55 万个桶，覆盖 3.8% |
| 决策记忆 | 104 局 | 3,592 次查询 **0 命中**（局面指纹从不重复） |
| 静态先验 / 学习先验 | 392 / 794 局 | 51.3% / 52.6%（≈0） |
| rollout 深度 10→30 | 104 局 | 51.9%（无差异） |
| 时间预算 150→80ms | 104 局 | 46.2%（无差异） |
| 进化调权重 | 80 局 | 进化时 87.5%，独立 seed 复验 50%（过拟合） |
| 后台预计算（预测对手动作） | 52 局 / 4,239 手 | 命中率 0.59% |
| 早期样本加权 | 24 万条 | 胶着准确率 68.02 → 68.04 |

离线诊断也指向同一结论：整体准确率 70~72% 被"已定局面"抬高（胶着局面仅 68%、前两回合 63%），
把 68% 推到 73% 的代价是 100 倍数据，而胜率不变 → **精度不是瓶颈**。

## 五、数据与模型资产

| 资产 | 位置 | 规模 | 说明 |
|---|---|---|---|
| v3 样本 | 本机 `collected/traj-v3/` | 2 万局 / 59.3 万条 / 64MB | 40 维；`e` 字段（对手已出牌）99% 为空，不可用于读牌 |
| v6 样本 | `artifacts/ai/data/traj-v6/` | 480 局 / 2.09 万条 / 2.4MB | 44 维 + 牌组索引 + 对手已出牌（已修好） |
| 价值网 | `artifacts/ai/value-40d-{71k,593k,focused}.json`、`value-22d-196k.json` | 各 ~50KB | 22/40 维，均默认关 |
| 策略网 | `artifacts/ai/policy-{40d-41k,search-10k,v3-285k}.json` | 各 ~58KB | 均默认关 |
| 牌组库 | `packages/standalone/public/data/deck-library.json`（不入库，脚本生成） | 4,557 套 / 9.6MB | 猜牌先验、组卡、A/B 选牌都用它 |
| 冻结快照 | `artifacts/ai/snapshots/ai-freeze-2026-11-28/` | 1.4MB | 改造完成时的代码 + 模型 + 文档，可回退 |

v3 的 64MB 原始样本没有入库（体积大且 `e` 字段无效），可用 `scripts/collect-trajectories.mjs` 重新采集。

## 六、怎么复现

```bash
# 1) 构建（引擎 + AI 包）
pnpm --filter @gi-tcg/core build && pnpm --filter @gi-tcg/ai build

# 2) 打包服务器用的单文件实验程序（服务器零依赖）
node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/bin/esbuild \
  packages/ai/scripts/ab-value.mjs --bundle --platform=node --format=esm \
  --target=node20 --outfile=dist-collect/ab-value.bundle.mjs

# 3) A/B：搜索 vs 纯启发式（镜像配对，104 对 = 208 局）
node dist-collect/ab-value.bundle.mjs --a=v1 --b=heur --pairs=104 --offset=0 \
  --budget=150 --depth=10 --lib=packages/standalone/public/data/deck-library.json

# 4) A/B：猜牌 vs 旧隐藏信息逻辑
node dist-collect/ab-value.bundle.mjs --a=v1 --b=v1 --realisticHidden=true \
  --pairs=52 --offset=0 --budget=150 --depth=10 \
  --lib=packages/standalone/public/data/deck-library.json

# 5) 猜牌不变量自检（中局快照 → 猜牌 → 续打）
node packages/ai/scripts/_check-hidden.mjs 0

# 6) 采集 v6 样本 / 训练价值网
node dist-collect/collect.bundle.mjs --games 5000 --shard 0 --shards 4 --out traj-v6 \
  --lib packages/standalone/public/data/deck-library.json \
  --mix mixed --sample 3 --budget 100 --depth 10 --searchShare 0.12 --blunderShare 0.13
OPENBLAS_NUM_THREADS=1 python3 packages/ai/tools/train_value.py \
  --data 'collected/traj/*.jsonl' --out model.json --epochs 30
```

> 一切实验都走**镜像配对**（同牌组同 seed 打两局交换先手）+ `--offset` 分片并行；
> 100 局误差 ±5%，检测 53% 需要约 2,000 局。先跑 `--a=v1 --b=v1` sanity（期望 ≈50%）。

## 七、DMC 自对弈（已尝试，已封存）

> 这一节原本是"下一步"，现已执行完毕并按结论封存：DMC 用 0.1ms/手 换到 150ms 搜索强度，
> 但对 App 的 2500ms 搜索只有 28.7%；按曲线外推 1,000 万局也仅约 37%。详见
> [DMC 结果](./DMC-结果-2026-11-28.md) 与 [终结报告](./AI-终结报告-2026-11-28.md)。

### 原计划（留档）

现有路线的天花板很低：推演策略是贪心近似、评估是手工材料分、深度只有 10 个动作、没有对手建模。
而实验已经证明"精度不是瓶颈、训练信号才是"。因此下一步建议走 **DouZero 式深度蒙特卡洛（DMC）**：

- 用 **整局胜负** 当标签学 Q(s,a)，ε-greedy 自对弈，**推理不需要搜索**（一次前向）；
- 不需要人类棋谱，不需要手工评估，正好绕开当前最弱的两块；
- 算力可行：引擎单核 1.25 局/秒，16 vCPU ≈ **170 万局/天**；
- 动作空间小（每步 5~20 候选），网络可以很小，手机端推理无压力；
- 底座现成：`candidateFeatures()`、动作编码、镜像配对 A/B（拿当前冻结线当 B 侧基线）。

里程碑结果：v0 完成（35,000 局 / 312 万样本，Q0~Q3），对启发式 67.6%、对 150ms 搜索 50.2%、
对 App 2500ms 28.7%——未过 55% 门槛，按计划封存，不再扩样。

## 八、目录索引

| 路径 | 内容 |
|---|---|
| `packages/ai/src/` | 启发式评估（`evaluate.ts`）、推演搜索（`search.ts`）、价值网（`value.ts`）、策略网（`policy.ts`）、记忆、后台思考（`ponder.ts`） |
| `packages/ai/scripts/` | A/B（`ab-value.mjs`）、采集（`collect-trajectories.mjs`）、进化（`evolve-weights*.mjs`）、诊断与临时实验脚本 |
| `packages/ai/tools/` | `train_value.py`（numpy 训练）、`merge-experience.mjs`、样本诊断 |
| `packages/standalone/src/search.worker.ts` | App 内搜索 worker（预算、跳过预览、真实隐藏信息都在这里接线） |
| `packages/standalone/src/ai-flags.ts` | 9 组组件开关与三档预设（真正接到决策链的只有 search / valueNet / valueTable） |
| `artifacts/ai/*.md` | 今日结论、实验队列、整合配置、隐藏信息改造、现状总览等 |
| `artifacts/ai/snapshots/` | 冻结快照（代码 + 模型 + 文档，可回退） |
