# 牌组图（分享长图）

把一套牌组渲染成一张竖版长图：标题 + 版本 + 牌组码 + 3 张角色牌 + 30 张行动牌，
用来发群、发动态、存档。本文写清入口、规格、实现位置和怎么改。

> 相关：[SETTINGS.zh.md](./SETTINGS.zh.md)（设置面板逐项说明）·
> [USER-GUIDE.zh.md](./USER-GUIDE.zh.md)（用户视角的操作步骤）·
> [DATA.zh.md](./DATA.zh.md)（牌组码编码）· [TESTING.zh.md](./TESTING.zh.md)（验收方法）

---

## 1. 从哪生成

| 入口 | 按钮 | 说明 |
|---|---|---|
| 组牌器 | **「牌组图」** | 角色 3 张 + 行动牌 30 张后才可点；生成后弹窗预览 |
| 牌组库 | **「生成牌组图」** | 任意已收录牌组，详情里直接出图 |
| 卡组实验室 | **「生成牌组图」** | 克制结果里的候选牌组；另有「仅解析牌组码并生成牌组图」 |
| 首页 ⚙ 设置 → 第 5 项 | **「牌组图高画质渲染」** | 关 = JPG / 开 = PNG；键 `gitcg.shareQuality`，逐项说明见 [SETTINGS.zh.md](./SETTINGS.zh.md#5-牌组图高画质渲染) |

生成完成后：

- 安卓壳内：调用 `AndroidHost.saveImageFileIn("牌组图", name, base64)`，
  落到 **`下载/七圣召唤工具/牌组图/`**，同时弹 toast；
- 浏览器：走 `<a download>` 直接下载。

文件名形如 `deck-share-<时间戳>.jpg`（实验室）或由调用方传入的名字（组牌器/牌组库）。

---

## 2. 输出规格

| 项 | 值 |
|---|---|
| 逻辑宽度 | `1080`，超采样 `S = 2` → 画布实际宽 **2160** |
| 高度 | 按内容计算（头部 + 角色区 + 5 列行动牌行数 + 页脚），约 **5716** |
| 默认输出 | 缩到 65% → **1404×3715**，JPEG `q0.82`，约 **0.85 MB** |
| 无损输出 | 原尺寸 **2160×5716 PNG**，约 **10.5 MB**（设置里开「高画质」） |
| 卡图 | `assets-local` 里的 `cardFace`（原图，非缩略图） |
| 字体 | `system-ui`（标题/正文）、`ui-monospace, Menlo, Consolas`（牌组码） |

### 画质设置如何影响输出

设置面板第 5 项「牌组图高画质渲染」，是唯一会改变成图尺寸与体积的开关，三处入口共用：

| 档位 | 值 | 出口步骤 | 输出 | 体积 |
|---|---|---|---|---|
| 关（默认） | `compact` | 画布先缩到 65%，再 JPEG `q0.82` | **1404×3715** | 约 **0.85 MB** |
| 开 | `lossless` | 原尺寸 `canvas.toDataURL("image/png")` | **2160×5716** | 约 **10.5 MB** |

- 切换后**下一次生成立即按新档位**，无缓存、无需重启；
- 版式、字号、卡宽比都不随档位变化，只有分辨率与压缩方式变；
- 想让「放大看也清楚」就开无损；发群优先体积就别开（10MB 的图微信会压）。

版式从上到下：

```
七圣召唤 · 牌组图          ← 54px 粗体
版本 7.2.0                ← 30px，下面可带一行 note（如「胜率 53.9% · 15 局」）
<牌组码>                   ← 单行，字号按长度自适应（14–26px）
──────────────
出战角色牌                 ← 3 张，280px 宽，36:21
出战行动牌                 ← 每行 5 张，列/行间距 22px
由七圣召唤工具生成 · DSH-Go ← 页脚
```

文字是按**视觉边缘**排的（用 `measureText` 的 `actualBoundingBoxAscent/Descent`），
不是按基线拍脑袋，所以换字号也不会互相压住。

---

## 3. 实现位置

| 文件 | 作用 |
|---|---|
| `packages/standalone/src/share-image.ts` | **主渲染器**：`renderDeckShareImage()`、`encodeShareImage()`、`saveShareImage()` |
| `packages/standalone/src/deckbuilder.tsx` | 组牌器入口：`renderDeckShareImage()` → 弹窗预览 |
| `packages/standalone/src/deck-library.ts` | 牌组库入口：同一个渲染器 |
| `packages/standalone/src/lab.ts` | 卡组实验室：同款版式的独立渲染器（与上面统一视觉） |
| `packages/standalone/src/native.ts` | `saveImageFile()`：优先安卓壳，其次浏览器下载 |
| `packages/standalone/hub.html` | 设置面板里的「牌组图高画质渲染」开关 |

关键函数：

```ts
// 渲染：返回一个 2160 宽的 canvas（逻辑 1080 × S=2）
renderDeckShareImage(deck: { characters: number[]; cards: number[] }, options?: {
  note?: string;   // 版本号下面的副标题
  code?: string;   // 牌组码，整串压成一行、字号自适应
}): Promise<HTMLCanvasElement>

// 编码：默认缩 65% + JPEG 0.82；开了高画质则原尺寸 PNG
encodeShareImage(canvas): string   // dataURL

// 保存：安卓壳走 saveImageFileIn("牌组图", ...)，否则触发下载
saveShareImage(canvas, fileName): "saved" | "downloaded"
```

牌组码不会折行：宽 1080、左右各留 60，字号按 `(W - 2M) / (长度 × 0.6)` 反推，
夹在 14–26px 之间。33 个槽位的常规码在 20–26px 左右；如果拿牌组码工具生成了
更长的异常码，会自动缩小而不是溢出。

---

## 4. 想改版式改哪里

- **画布宽度 / 左右留白**：`share-image.ts` 里 `const M = 60`、`const W = 1080`；
  改了 `W` 记得同步 5 列牌的 `cardW` 计算。
- **角色牌 / 行动牌比例**：`charCardW = 280`、`charCardH = charCardW * 36 / 21`，
  行动牌同理是 36:21（与游戏卡面一致），改比例会拉伸卡图。
- **牌组码位置与字号**：`codeFontSize` 那段；`codeStartY` 是按「码底边 245」反推的。
- **页脚文案**：搜索 `由七圣召唤工具生成`。
- **画质/体积**：`encodeShareImage()` 里的 `0.65` 缩放与 `0.82` 质量。
- **实验室版式**：`lab.ts` 里有一份同款渲染（约 1000 行附近），两边要一起改，否则视觉不一致。

> 想做多套分享图模板是 [ROADMAP.zh.md](./ROADMAP.zh.md) 里的待办，目前只有这一套。

---

## 5. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 图里卡面是白块 | `assets-local` 素材没抓全；见 [ASSETS.zh.md](./ASSETS.zh.md)，不是渲染 bug |
| 老 WebView 上字体变样 | 系统字体回退，字宽变化会导致牌组码换行位置变；不影响牌组码本身 |
| 30 张同卡也能出图 | 正常：渲染只按 `cards` 数组画，不校验合法性；整活牌组就是这样来的 |
| 牌组码很长但没折行 | 设计如此：只缩字号，不折行 |
| 图很大发不出去 | 默认已是 0.85MB JPEG；别开「高画质」（那是 10.5MB PNG） |
| 点了没反应 | 组牌器要求 3 角色 + 30 行动牌；不足时按钮是禁用的 |
| 换了设置但图没变 | 画质开关只看 `gitcg.shareQuality`，清应用缓存会重置回默认（compact） |

---

## 6. 验收（改完怎么测）

按 [TESTING.zh.md](./TESTING.zh.md) 的原则，至少留一种证据：

1. **尺寸**：`canvas.width === 2160`，`canvas.height === footerY + 44`（组牌器里直接打印）；
2. **像素**：导出后检查四角/边距没被裁、卡图不是纯白；
3. **三种形态**：横屏 20:9、其他横屏比例、竖屏各出一张，确认 5 列不挤压；
4. **非常规牌组**：用 `tools/deckcode` 生成「30 张同卡」，确认图能出、卡面重复排列；
5. **保存路径**：安卓壳内导出后，`下载/七圣召唤工具/牌组图/` 下能看到文件。
