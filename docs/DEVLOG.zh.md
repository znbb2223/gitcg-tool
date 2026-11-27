# 开发日志（迭代记录）

记录每个版本「改了什么 / 为什么 / 根因是什么」。
版本从 0.11.121 起（此前为上游原版 + 早期整合）。

---

## 0.11.157 — 推演跳过动作预览 / 策略网络 / 牌组库更新

**目标**：在不动模型的前提下，让同样思考时间跑出更多 rollout。

**根因定位**（用 `--searchStats` 实测）：150ms 预算下每手只跑出 **1.3 个 rollout**，
倒推单次 rollout 约 112ms，其中状态序列化只占 1.6ms，其余全是引擎「每次动作都要枚举全部
合法动作并计算结算预览」。深度 10→30 时单次 rollout 只从 112ms 涨到 175ms，说明 rollout
大多没走到深度上限就结束了——**深度参数本身没意义**。

**修法**：

- `core`：`GameOption.skipPreview` + `ActionPreviewer` 支持只跑 modify、跳过沙盒模拟。
  费用/骰子/合法性仍然准确，`preview` 返回空数组。
- `ai/search.ts`：新增 `skipRolloutPreview`；rollout 建局时开启。因为 `rolloutPriority`
  依赖 `preview` 里的伤害值，无预览时退回**静态排序**（技能 > 出牌 > 换人 > 结束，按费用微调）。
- `ai/ponder.ts`：后台思考同样跳过。
- `standalone/search.worker.ts`：正式搜索开启该选项。**根节点候选仍是完整预览**。

**效果**：单次 rollout 112ms → 34ms，同预算 rollout 数 ×2.2~3；镜像对照 416 局
胜率 **63.9%（+13.9 点）**。

**同批其他改动**：策略网络推理（`policy.ts`）与训练脚本、采集 v5（记录牌组索引 + 修复
对手出牌字段）、A/B 六个新开关。

**踩坑**：

- 小批量 MLP 用多线程 BLAS 反而慢一个数量级（线程调度开销 > 计算量），
  必须在 `import numpy` 之前设 `OPENBLAS_NUM_THREADS=1`；42k 样本 3 epoch 从 >5 分钟降到 3.9 秒。
- `train_value.py` / `diagnose-samples.py` 只认 `f` 数组，v3/v4 的向量在 `x` 里，
  而 `f` 是命名字典，直接 `np.asarray` 报 `float() argument must be ... not 'dict'`。

**数据**：牌组库 4,543 → 4,557 套。

## 0.11.121 — 20:9 布局基线

- 确立手机 20:9 横屏的经典布局（等比 contain + 背景图填充留边）。
- 这个版本后来成为 20:9 屏幕的**强制回落目标**（见 0.11.144）。

## 0.11.122 ~ 0.11.139 — 稳定期

- 修训练按钮点不动、日志不实时；组牌器合法性提示；摆盘器入口层级等。

## 0.11.140 — 锚点偏移布局机制

**目标**：非 20:9 屏幕（16:9 / 16:10 / 3:2 / 19.5:9）也要四边木框完整、元素按十字中心偏移。

- 新增 `board-layout.ts`：`AnchorSpec`、`place()`、`placeChild()`、`stageRect()`；
- `TransformWrapper` 新增 `spread` 模式，写入 `setBoardSpread(kx, ky, unitPx)`；
- `layout.ts` 按单位做 X 方向 spread；
- 用 `dumpAllAnchors()` 在 20:9 下录了 **86 个绝对定位元素**的锚点。

**坑**：上下牌堆不镜像——渲染链有 0.8 投影系数，直接镜像不成立，
按「视觉块 = 0.8 × 扁平块」反解出上牌堆锚点公式。

## 0.11.141 — 四比例校准

- 16:9 / 16:10 / 3:2 / 19.5:9 逐个实测：
  牌堆右缘偏差 ≤0.6px、行间距恒定 48 单位、手牌条 35.9~46.6px；
- 手牌与牌堆改成**固定像素约束**（不随比例缩放），角色行只做 X spread。

## 0.11.142 — 原神 UI 改版 + 竖屏

- 全面换成原神风（暗底 + 金色描边 + 卡片化），补竖屏适配。

## 0.11.143 — 主体方向设置

- 新增「主体横竖屏」设置；对局始终横屏，工具页跟随设置；
- 组牌器窄屏压缩、摆盘器返回层级修复。

## 0.11.144 — 20:9 强制回滚

- 20:9 屏幕强制 `classic` + `__GI_CLASSIC_20X9__`（0.11.121 布局），
  设置里的三选项在 20:9 下不生效。

## 0.11.146 — 摆盘器直达对局

- 首页进摆盘器不再先落到「摆盘完成」页；
- 工具页方向自应用（进入前先按设置转屏，避免闪一下）。

## 0.11.147 — 卡死与筛选弹层

- 快照局 `showLogIndex(0)` 导致切片为 0 卡死 → 恢复；
- 横屏筛选弹层选择器修正（`grid-area` vs `FM:grid-area`）、层级 999。

## 0.11.148 — 摆盘器布局统一

- 摆盘器开局与日志回放统一为配置页布局（宽屏标记覆盖 20:9 回滚）。

## 0.11.149 — 闪屏根治

**现象**：进实验室/牌组库时先竖屏再横屏，闪两下。

**根因**：这两个页面的脚本里还写死 `setOrientation("portrait")`。

**修法**：改为跟随「主体方向」设置；首页入口在跳转前先按设置转屏。

## 0.11.150 — 实验室与快照

- 实验室新增「每副候选对局数」（2~30，默认 6），worker 支持 `games` 参数；
- 搜索结果牌组码规范化（角色/卡牌按 id 排序），与牌组库规范码一致；
- 摆盘器快照局写缓存：从 `onCleanup` 移到 `pagehide`
  （历史后退走 bfcache 不卸载组件，`onCleanup` 不触发），门槛降到 >1 帧，
  结束帧立即记录。

## 0.11.151 — 跨页传参统一 id

**现象**：实验室点进牌组库，明明是同一套牌却显示成「实验室新发现」。

**根因**：牌组码对卡牌顺序敏感，实验室排序后的规范码与库里原始码不一致；
两边用不同的键查指纹表。

**修法**：跨页传参改用牌组库条目 `id`；`deepLinkDeck` 支持 `?id=`。

## 0.11.152 — 新发现污染

**现象**：从实验室返回后，社区牌组被标成「实验室新发现」。

**根因**：搜索结果首轮渲染时索引还没加载完（指纹表为空），社区牌组被误判为新发现写入本地；
本地条目又反过来覆盖社区条目。

**修法**：索引加载完成前一律不写新发现；本地条目不覆盖同指纹的社区条目（社区优先）。

## 0.11.153 — 无网络权限

- 去掉唯一的 `INTERNET` 权限：安卓壳从本地 socket 服务器改为
  `shouldInterceptRequest` 直接从 assets 出内容，origin 仍用 `http://127.0.0.1:8765`；
- `minSdk` 提到 29，`targetSdk` 34，删除 `AssetServer.java`；
- 开发资料打进 `assets/dev-docs/`；关于页补支持范围与资料说明。

## 0.11.154 — 无害化确认

- 确认零权限、离线可用；修复关于页构建号与版本日志。

## 0.11.155 — 实验室结果不入库

- 「实验室新发现」只作临时牌组（点开跳牌组库按临时详情渲染，带 `chars/cards` 参数）；
- 牌组库本地 lab 来源条目一律忽略；
- 修复对局详情 `seed` 未定义报错。

## 0.11.156 — 搜索停更修复

**现象**：实验室搜索日志与结果卡都停更（只有转圈）。

**根因**：`known` 变量被多余的大括号挤出了循环作用域，渲染期抛错，整段更新中断。

**修法**：删掉多余 `}`；同时从牌组库「来源」筛选里移除「实验室新发现」。

---

## 附：宣传片（2026-11）

- 先用 manim 做了一版（`Euler` 风格，左文右图），节奏偏平；
- 重做为 Motion Canvas：全幅界面 + 电影感暗角 + 章节号 + 镜头推近，
  配原神《海祇岛》BGM（淡入淡出 + -16 LUFS 标准化）。
- 工程在 `promo/`，渲染管线：vite + Playwright 逐帧驱动 → ffmpeg 合成。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
