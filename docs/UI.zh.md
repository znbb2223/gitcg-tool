# 界面与布局规范

这套 UI 分两块：**工具页**（首页、牌组库、组牌器、摆盘器、实验室、AI 设置）走深黑棕 + 金色描边的原神风；
**对局界面**直接用游戏素材，按 20:9 设计基准做坐标。本文把两块都写清，改之前先读完。

> 相关：[SETTINGS.zh.md](./SETTINGS.zh.md)（布局/方向/画质设置项）·
> [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md)（牌组图 36:21 卡面比例）·
> [TESTING.zh.md](./TESTING.zh.md)（截图 / DOM / 像素验收）·
> [KNOWN-ISSUES.zh.md](./KNOWN-ISSUES.zh.md)（字体回退等已知问题）

---

## 0. 三条铁律

1. **只有一套强调色**：金 `#d3bc8e`；页面/入口可以有自己的元素色，但只做点缀，不能变成第二套主题。
2. **尺寸不写死**：页面用 `clamp()` + `vh/vw` 自适应，对局用「设计单位 + 统一缩放」；不要写 `px` 硬宽。
3. **对局永远横屏**：设置里的「主体方向」只影响工具页，模拟器/摆盘器强制横屏。

---

## 1. 设计语言

### 1.1 调色板（来源：`packages/standalone/public/genshin-ui.css`）

| 变量 | 值 | 用途 |
|---|---|---|
| `--g-bg` | `#17140f` | 页面底色 |
| `--g-bg-soft` / `--g-panel` | `#1e1a14` / `#241f17` | 次级底 / 面板底 |
| `--g-panel-2` | `#2d261c` | 面板高一级 |
| `--g-gold` | `#d3bc8e` | 描边、分割线、图标 |
| `--g-gold-bright` | `#ecd7a4` | 标题、选中态 |
| `--g-gold-deep` | `#a98d5f` | 阴影金、弱化描边 |
| `--g-line` | `rgba(211,188,142,.26)` | 1px 分隔线 |
| `--g-text` | `#ece5d8` | 正文 |
| `--g-muted` | `#a89a80` | 辅助文字 |
| `--g-blue` / `--g-red` | `#a9c0d0` / `#e0917c` | 信息 / 危险 |

兼容别名：`--gold`、`--gold-soft`、`--gold-dim`、`--ink`、`--cream`、`--muted`、`--indigo`（旧页面在用，别删）。

### 1.2 首页另外几个变量（`hub.html` 内联样式）

| 变量 | 值 | 用途 |
|---|---|---|
| `--gold` | `#e6cb92` | 首页金色（比工具页略亮） |
| `--ink` | `#f4ecd9` | 首页正文 |
| `--cream` | `#f0e6cf` | 首页标题 |
| `--muted` | `#9aa8ba` | 首页次要文字（偏蓝灰） |
| `--indigo` | `#0d1524` | 首页深底 |

每个入口卡另有元素色（只用于左侧竖条/角饰）：

| 入口 | `--accent` |
|---|---|
| 模拟器 | `#ff8a5c`（火） |
| 组牌器 | `#5cc8e8`（水） |
| 摆盘器 | `#b98cff`（雷） |
| 卡组实验室 | `#7fd6a8`（草） |
| 牌组库 | `#e6cb92`（金） |
| 关于 | `#d3bc8e`（金） |

### 1.3 质感

- **底纹**：黑棕多层径向渐变 + `/assets-local/genshin/texture.svg`（56px 平铺）；
- **描边**：1px 金 + 内阴影，圆角 8 / 10 / 12px 三档，弹层 12px；
- **角饰**：入口卡四角用 `::before/::after` 画的角隅花饰，复用即可，不要新画一套。

---

## 2. 字体与排版

| 场景 | 字体栈 | 说明 |
|---|---|---|
| 首页标题/金色字 | `"Source Han Serif SC", "Noto Serif SC", Georgia, serif` | 宋体感，标题用 |
| 工具页正文 | `system-ui/系统默认`（`genshin-ui.css`） | 跟系统走 |
| 对局界面 | `"汉仪文黑-85W", sans-serif` | 游戏内文字，缺失时回退系统字体 |
| 数字/牌组码 | `ui-monospace, Menlo, Consolas, monospace` | 等宽，便于对齐 |

字号层级（首页实测，`clamp` 随视口缩放）：

| 层级 | 大小 | 来源 |
|---|---|---|
| 首页主标题 | `clamp(20px, 4.4vh, 34px)` | `hub.html` |
| 入口标题 | `clamp(13px, 2.2vh, 16px)` | 同上 |
| 入口描述 | `clamp(10px, 1.55vh, 12px)`，最多 2 行 | 同上 |
| 版本/辅助 | 11.5px（`clamp(10, 1.6vh, 12.5)`） | 同上 |
| 页面标题（工具页） | 32–40px / 700 | `genshin-ui.css` 约定 |
| 正文 | 14–16px / 400 | 同上 |

> **字体回退是已知问题**：老 WebView 没有思源宋体/汉仪文黑，会回退系统字体，字宽变化可能让排版轻微走形
> （牌组图上的牌组码最明显）。见 [KNOWN-ISSUES.zh.md](./KNOWN-ISSUES.zh.md)，不要当 bug 修。

---

## 3. 页面骨架

### 3.1 首页（`hub.html`）

- **固定一屏不滚动**：`html,body{height:100%}` + `overflow:hidden`；
- 结构：`hero`（标题 + 分隔线 + 版本）→ 入口网格 → 统计 → 右上角齿轮；
- 入口网格：默认 **1 列**，每卡 `min-height: calc(64px + 2vh)`；窄高屏按 `vh` 收紧；
- 右上角齿轮：`42×42`、圆角 50%、`position:fixed`、`top/right:12px`、金色描边；
- 统计行固定在最下方，含「对局日志 / 缓存日志」，提示“清缓存会一起清掉”；
- 首页不参与「主体方向」以外的布局切换。

### 3.2 设置弹层

- 遮罩：`rgba(4,8,14,.74)` + `backdrop-filter: blur(3px)`；
- 面板：`max-width:420px`、`max-height:82vh`、圆角 12、内边距 16/18、内部可滚；
- 头部 sticky，关闭按钮在右上，热区 ≥36px；
- 内容就是 5 个设置项，逐项说明见 [SETTINGS.zh.md](./SETTINGS.zh.md)。

### 3.3 工具页

- 共用 `public/genshin-ui.css`（配色/面板/按钮/弹窗）与 `public/responsive.css`（比例适配）；
- 竖屏/横屏由「主体方向」决定（`gitcg.mainOrientation`），页面加载时读 `localStorage` 后调
  `AndroidHost.setOrientation`；网页版无宿主，靠浏览器方向；
- 代码块/日志类内容用等宽字体，不要用宋体。

### 3.4 安全区

- 只有 `src/style.css` 用了安全区：`padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`、
  `padding-top` 同理；
- 安卓壳是 edge-to-edge，新增固定底栏/顶栏的页面必须自己加 `env(safe-area-inset-*)`，否则刘海/手势条会盖住。

---

## 4. 屏幕方向与比例

| 场景 | 规则 | 存储/入口 |
|---|---|---|
| 工具页 | 竖屏（默认）/ 横屏，选择即生效 | `gitcg.mainOrientation`，设置第 4 项 |
| 对局（模拟器） | **始终横屏**，不受设置影响 | 进入对局时强制 `landscape` |
| 摆盘器/对局页 | 同上 | — |
| 设计基准 | **2400×1080（20:9）** | 对局坐标系 |
| 其他比例 | 16:9 / 16:10 / 3:2 / 19.5:9 走锚点布局 | `gitcg.gameLayout` |

---

## 5. 对局布局（重点）

### 5.1 单位制

对局里的坐标全部是**设计单位**，不是 px：

```ts
unitInPx() = 根字号 / 4      // 1 单位 = 根字号/4 px
MINIMUM_WIDTH = 220           // 设计画布宽（单位）
MINIMUM_HEIGHT = 99           // 设计画布高（单位）
CARD_WIDTH = 21, CARD_HEIGHT = 36
```

CSS 里 1 单位 = 根字号 / 4（默认 4px）；这 4px 还要再乘 `TransformWrapper` 的 `transform: scale()`，
所以 20:9、2400 宽时屏幕上 1 单位约 **10.9px**（= 2400 / 220）。

### 5.2 三种布局模式

| 模式 | 值 | 行为 |
|---|---|---|
| 20:9 等比 | `classic` | 固定 20:9 等比缩放，多出的边用木纹背景填，不裁切 |
| 20:9 拉伸填充 | `stretch` | 铺满整屏，非 20:9 会被整体拉伸 |
| 锚点偏移 | `anchor` | 以十字中心锚定，按各轴比例偏移；不变形不裁切（推荐） |

**判定逻辑**（`StandaloneParent.tsx`）：

```ts
// 视口比例在 20:9 ±0.03 内：强制 classic，设置里的选项不生效
if (Math.abs(vw / vh - 20 / 9) < 0.03) return "classic";
// 其他比例：stretch/anchor 按设置；没设置过默认 anchor；classic/未知值回落 classic
const stored = localStorage.getItem("gitcg.gameLayout");
return stored === "stretch" || stored === "anchor" ? stored : stored === null ? "anchor" : "classic";
```

副作用标记：

- `document.body.dataset.gameLayout = mode`（CSS 可挂钩）；
- `__WIDE_BOARD__ = anchor || (classic && 20:9)`：宽屏棋盘，用 `ChessboardBackground-20x9.webp` 全幅；
- `__GI_CLASSIC_20X9__ = classic && 20:9`：`layout.ts` 退回 0.11.121 的原始坐标。

### 5.3 锚点偏移的数学

```ts
scaleX = 容器宽 / (UNIT * 220)
scaleY = 容器高 / (UNIT * 99)
uniform = min(scaleX, scaleY)
kx = scaleX / uniform, ky = scaleY / uniform   // 各轴相对设计基准的拉伸倍率
setBoardSpread(kx, ky, unitPx)
```

各区域规则（内存不浪费的细节，改之前必须理解）：

| 区域 | 规则 | 代码 |
|---|---|---|
| 角色行 / 实体区 | 上下以中心线对称、行距固定 → **只做 X 方向 spread** | `applySpreadX` |
| 己方手牌 | 顶边到下边固定 **37.2px**（20:9 实测值），锚点 = `h − 2 − 37.2/unitPx` | `getHandCardBlurredPos` |
| 对方手牌 | 底边到上边固定 **44.8px**，锚点 = `44.8/unitPx − 34` | 同上 |
| 牌堆 | 右缘到界面左边固定 **102.9px**，`x = 130.8/unitPx`；上下镜像 | `getPilePos` |
| 换牌展示 / 调谐区 | **全方向 spread** | `getShowingCardPos`、`getTuningAreaPos` |
| HUD | 锚定 20:9 舞台右上角，距边 12px/8px，按舞台缩放同比放大 | `StandaloneParent` |

### 5.4 设计常量表

| 常量 | 值（单位） |
|---|---|
| 棋盘最小尺寸 | 220 × 99 |
| 卡牌 | 21 × 36 |
| 角色区 | 21 宽 × 54 高（=36 + 3×6 饰品） |
| 角色区间距 | 6（最多 4 个角色位） |
| 实体（召唤/支援） | 16 × 19，间距 4.5，两列两行 |
| 模糊手牌 | 10 × 15 |
| 对手手牌右边距 | 24 |
| 技能按钮宽 | 15 |
| 聚焦手牌 | 高 36，最小宽 15，间距 2 |
| 展示卡左右留白 | 60 |
| 透视 | 200 |

### 5.5 背景与 HUD

- `classic`（非 20:9 回退）用 `ChessboardBackground.webp`，容器 240×135 等比、`scale-107.2`；
- `wide` 用 `ChessboardBackground-20x9.webp` 全幅；
- HUD 用 CSS 变量定位：`--gi-hud-top` / `--gi-hud-right`，由舞台矩形 × 缩放算出来，别写死 px。

---

## 6. 组件规范

| 组件 | 规范 |
|---|---|
| 入口卡 | 圆角 10、1px 金边 `.26`、左侧元素色竖条、`min-height: calc(64px + 2vh)`、hover 金色外发光 |
| 主按钮 | 金边 + 暗底；`min-height: 34px`（矮屏断点）；文案 ≤4 字 |
| 设置开关 | 圆角 999 的 switch，必须有 `role="switch"` + `aria-checked`；点击立即生效 |
| 弹层 | 圆角 12、`max-width:420px`、`max-height:82vh`、关闭按钮右上、点击遮罩关闭 |
| Toast | 2.6 秒自动消失，不占布局，不叠多个 |
| 危险操作 | 红金 `#e0917c`，二次确认 |
| 列表/网格 | 列数交给 `responsive.css`，不要页面内写死 |

---

## 7. 素材

| 素材 | 路径 | 用途 |
|---|---|---|
| 棋盘背景 | `/assets-local/ui/ChessboardBackground(.20x9).webp` | 对局底 |
| 卡框 | `CardFrameNormal` / `CardFrameSummon` / `CardFrameReal.png` | 卡牌/召唤物 |
| 卡背 | `CardbackNormal.svg.webp` | 牌堆 |
| 元素骰 | `Dice{ Pyro, Hydro, Anemo, Electro, Dendro, Cryo, Geo, Omni }S.svg.webp` | 骰子/图标 |
| 元素图标 | `/assets-local/ui/mys/{fire,water,wind,elect,grass,frost,rock,...}.png` + `num/*.png` | 首页入口角标 |
| 纹理 | `/assets-local/genshin/texture.svg` | 页面底纹 |
| 卡面 | `/assets-local/.../cardFace/full.webp` | 对局/牌组图，比例 36:21 |

- 新增素材用 webp（透明背景），文件名与上游一致，别改大小写；
- 牌组图直接复用卡面（36:21），比例改动会同时影响对局与分享图，见 [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md)。

---

## 8. 响应式断点（`public/responsive.css`）

| 条件 | 处理 |
|---|---|
| `max-height:780px` 且 `max-width:560px` | 收紧留白；`h1` 18px；按钮 `min-height:34px` |
| `min-height:800px` | 底部留白 24px |
| `min-height:930px`（21:9 / 折叠外屏） | `h1` 17px，底部留白 30px，允许滚动 |
| `min-width:700px` 且竖屏（平板/折叠内屏） | 限宽 920px 居中，`.grid` 三列 |
| `min-width:520px` 且竖屏 | `.row` 两列 |

首页还有一层自己的 `vh/vw` 自适应（`clamp`），两者叠加时以更小值为准。

---

## 9. 验收（改 UI 必做）

按 [TESTING.zh.md](./TESTING.zh.md)，至少给一种证据：

1. **三种形态截图**：横屏 20:9、其他横屏比例（16:9）、竖屏；
2. **DOM 尺寸**：`getBoundingClientRect()` 验证手牌贴边距离（37.2 / 44.8px）、棋盘宽高比、HUD 位置；
3. **像素采样**：背景木纹是否被裁、卡框金边是否完整、按钮在深色底上的对比度；
4. **字体回退**：在缺字体的 WebView 里再看一遍标题与牌组码；
5. **设置联动**：切「对局界面布局」「主体方向」后各回一局/各进一页，确认生效且不串页。

---

## 10. 改 UI 的流程与禁止事项

**流程**：先量（截图 + DOM）→ 改 CSS/常量 → 再量 → 三种形态过一遍 → 更新本文与相关文档。

**禁止**：

- 引入第二强调色或第三种圆角体系；
- 在页面里写死 `width: 1200px` 这类值，破坏 clamp/vh 体系；
- 改对局坐标却不跑 20:9 与锚点两种模式；
- 只在 20:9 上验收（手机实际可能 19.5:9 / 16:9）；
- 新增固定栏不加 `env(safe-area-inset-*)`。

---

## 11. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [SETTINGS.zh.md](./SETTINGS.zh.md) | 「对局界面布局」「主体方向」的选项含义与存储键 |
| [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md) | 牌组图版式；36:21 卡面比例与本文共用 |
| [TESTING.zh.md](./TESTING.zh.md) | 截图 / DOM / 像素验收的具体做法 |
| [KNOWN-ISSUES.zh.md](./KNOWN-ISSUES.zh.md) | 字体回退、老 WebView 等已知限制 |
| [ASSETS.zh.md](./ASSETS.zh.md) | 素材从哪抓、抓到哪 |
| [INSTALL.zh.md](./INSTALL.zh.md) | 支持的系统/WebView 版本范围 |

---

## 附录：常用 px ↔ 单位换算

- `unitPx = 根字号 / 4`：默认根字号 16px → 1 单位 = 4 CSS px；
- 屏幕实际大小 = 4px × 统一缩放（20:9 2400 宽时约放 2.7 倍 → 约 10.9px/单位）；
- 牌堆右缘 102.9px → 锚点 `130.8 / unitPx`；
- 己方手牌 37.2px、对方 44.8px → 直接用 `px / unitPx` 反算；
- 视觉边缘与锚点差：己方 +2 单位、对方 +34 单位（手牌卡高一半 + 焦点偏移）。
