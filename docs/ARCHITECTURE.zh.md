# 架构说明

## 1. 包结构与职责

| 目录 | 作用 |
|---|---|
| `packages/core/` | 对局引擎（纯逻辑，无 DOM） |
| `core/src/game.ts` | `Game` 类：状态机、阶段推进、行动执行 |
| `core/src/async_context` | 异步上下文 / 事件流 |
| `packages/data/` | 卡牌、角色、技能、状态静态数据（由官方数据生成） |
| `packages/ai/` | AI 主体（搜索、策略、价值、进化、经验库） |
| `packages/web-ui-core/` | 对局界面组件（棋盘、手牌、骰子、技能面板） |
| `packages/deck-builder/` | 组牌器组件（筛选、牌组码、合法性检查） |
| `packages/state-editor/` | 摆盘器组件 |
| `packages/standalone/` | 独立 Web 应用（页面入口、布局、方向同步） |

## 2. 运行时数据流

### 对局

- `StandaloneParent.tsx` 读取布局模式（classic / stretch / anchor）与主体方向；
- 创建 `Game`（core）实例，按需挂上 AI agent；
- 渲染 `<Chessboard>`（web-ui-core）：
  - `Background`：背景图（20:9 webp）；
  - `TransformWrapper`：缩放 / 居中 / spread，写入 `setBoardSpread(kx, ky, unitPx)`；
  - `layout.ts`：按 spread 计算角色区 / 实体 / 手牌坐标；
  - `HandArea / CharacterArea / EntityArea`：各区域组件。

### 布局三态

| 模式 | 触发 | 行为 |
|---|---|---|
| `classic` | 20:9 屏幕（或用户选 20:9 等比） | 0.11.121 的等比布局，`__GI_CLASSIC_20X9__` |
| `stretch` | 用户选 20:9 拉伸 | 先按 20:9 渲染，再仅拉伸 Y |
| `anchor` | 其他比例 | 以 916×412 为设计基准，按锚点排布；`__WIDE_BOARD__=true` |

关键常量（`board-layout.ts`）：

- 设计基准 `916×412` px，十字中心 `(458, 206)`；
- 棋盘内部最小单位 `220×99`，`unitInPx() = 根字号 / 4`；
- 20:9 背景图 `assets-local/ui/ChessboardBackground-20x9.webp`（2400×1080）。

### AI

| 路径 | 作用 |
|---|---|
| `ai/src/agents` | 给定局面 → 枚举行动 → 评估 → 选最优 |
| `ai/src/evolution` | 自对弈 N 局 → 统计角色 / 卡牌 / 牌组胜率 → 更新经验 |
| `ai/src/data/experience-seed.ts` | 编译进包的经验种子（手机端首启可用） |

手机端 AI 强度来源：搜索预算（`searchBudgetMs`，默认 300ms）+ 经验库；
电脑训练器用同一套 AI，跑更多对局后把经验导回手机。

## 3. 安卓壳

- `android/src/MainActivity.java` 设置 WebView：启用 JS、DOM Storage，禁用网络；
- `WebViewClient.shouldInterceptRequest` 把 `http://127.0.0.1:8765/xxx` 映射到
  `assets/xxx`（含 MIME、404 处理）；
- 单入口：`index.html` = 首页（hub）；`app.html` = 模拟器。

设计要点：

- **不用本地 socket 服务器**：早期版本用 `ServerSocket` 起 HTTP 服务，需要 INTERNET 权限；
  现在直接拦截请求，`AndroidManifest.xml` 里没有 `<uses-permission>`；
- **origin 固定为 `http://127.0.0.1:8765`**：WebView 对 `file://` 的 localStorage 行为不稳定，
  用稳定 origin 让设置、进度、牌组缓存都能持久化；
- `usesCleartextTraffic="true"` 保留（否则拦截的 http origin 会被拦）；
- `minSdk 29`（安卓 10+）、`targetSdk 34`；
- 开发资料打进 `assets/dev-docs/`，用户可在工具内查看构建 / 使用文档。

## 4. 数据与缓存（浏览器侧）

| key | 内容 |
|---|---|
| `gitcg.mainOrientation` | 主体横竖屏设置 |
| `gitcg.layoutMode` | 布局模式 |
| `gitcg.deckLibrary.*` | 牌组库缓存、收藏、本地训练样本 |
| `gitcg.deckbuilder.legalCheck` | 组牌器合法性检查开关 |
| `gitcg.lab.*` | 实验室参数与结果 |
| `gitcg-ai-experience` | 训练器导入的 AI 经验 |

## 5. 构建产物

| 路径 | 内容 |
|---|---|
| `packages/standalone/dist/` | Vite 构建产物；`index.html` → `app.html`（模拟器） |
| 同上 | `hub.html` → `index.html`（首页） |
| 同上 | `editor.html / about.html / responsive.css` 从 `public/` 拷入 |
| `android/dist-lab/` | 安卓 assets 源目录 |
| `android/build/gitcg.apk` | 打包产物（d8 + aapt + apksigner） |

---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md) · [DATA.zh.md](DATA.zh.md)
- [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
