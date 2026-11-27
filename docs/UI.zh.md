# 界面与布局规范

## 1. 设计语言（原神风）

| token | 值 | 用途 |
|---|---|---|
| 底色 | `#14100b` / `#1b1710` | 页面背景、卡片底 |
| 金强调 | `#d3bc8e` | 描边、分割线、图标 |
| 高亮金 | `#ecd7a4` | 标题、选中态 |
| 米白 | `#ece5d8` | 正文 |
| 次要灰 | `#a89a80` | 辅助说明 |
| 圆角 | 8px / 12px | 卡片 / 弹层 |
| 描边 | 1px 金 + 内阴影 | 卡片质感 |

圆角+金色描边+暗底是整套 UI 的骨架；新组件请沿用，不要引入第三种强调色。

## 2. 屏幕比例

- **20:9 是基准**（2400×1080，横屏）；
- 其他比例走锚点布局（16:9 / 16:10 / 3:2 / 19.5:9）；
- 竖屏只在工具页（首页、牌组库、组牌器、实验室）：单列 + 底部导航；
- 对局永远横屏。

### 布局模式判定

```js
// 是否使用加宽布局：锚点模式，或 classic 模式且屏幕为 20:9
const wide = mode === "anchor" || (mode === "classic" && is20x9);
// 20:9 → classic（0.11.121 布局），其他 → anchor
```

## 3. 对局界面

| 区域 | 位置约束 |
|---|---|
| 角色区 | 以十字中心水平对称，行间距固定 48 单位 |
| 手牌（己方） | 顶边到屏幕下边固定 37.2px |
| 手牌（敌方） | 底边到屏幕上边固定 44.8px |
| 牌堆 | 右缘到界面左边固定 102.9px，上下镜像 |
| 骰子/回合提示 | 居中，全方向 spread |

单位制：`unitInPx() = 根字号 / 4`，最小棋盘 `220×99`。

## 4. 排版

| 层级 | 字号 | 字重 | 颜色 |
|---|---|---|---|
| 页面标题 | 32-40px | 700 | 高亮金 |
| 卡片标题 | 18-22px | 600 | 米白 |
| 正文 | 14-16px | 400 | 米白 |
| 辅助 | 12-13px | 400 | 次要灰 |

中文正文行高 1.5；按钮文案尽量 4 字以内（窄屏不换行）。

## 5. 交互约定

- 危险操作（清空、删除）用红金色，且二次确认；
- 悬浮提示 2.6 秒自动消失，不占布局；
- 弹层关闭按钮固定在右上，热区 ≥36px；
- 深链接统一用 `?id=`（牌组库条目），不要用牌组码。

## 6. 响应式断点

| 宽度 | 处理 |
|---|---|
| < 600px | 单列，卡片 2 列 |
| 600-900px | 卡片 3 列 |
| > 900px | 卡片 4 列 + 侧栏 |

`public/responsive.css` 集中管理；页面内不要再写死宽度。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md)
- [TESTING.zh.md](TESTING.zh.md) · [TRAINER.zh.md](TRAINER.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
