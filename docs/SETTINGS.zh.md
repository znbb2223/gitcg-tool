# 设置面板说明

首页右上角 ⚙ 打开的就是全部设置。**没有隐藏开关**，一共 5 项：两项备份、三项显示/画质。
每一项都写清：选项含义、默认值、存在哪、什么时候生效、影响哪些文档。

> 相关：[USER-GUIDE.zh.md](./USER-GUIDE.zh.md)（操作步骤）·
> [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md)（牌组图规格）·
> [UI.zh.md](./UI.zh.md)（布局与方向）·
> [DATA.zh.md](./DATA.zh.md)（本地数据与牌组码）·
> [AI.zh.md](./AI.zh.md) 与 [TRAINER.zh.md](./TRAINER.zh.md)（AI 数据）

---

## 速查表

| # | 设置项 | 选项 | 默认 | 存储位置 | 生效时机 | 关联文档 |
|---|---|---|---|---|---|---|
| 1 | AI 数据备份 | 导出 / 导入 | — | `localStorage` 多个键 + 下载目录 | 手动 | [AI.zh.md](./AI.zh.md)、[TRAINER.zh.md](./TRAINER.zh.md)、[DATA.zh.md](./DATA.zh.md) |
| 2 | 牌组库备份 | 导出 / 导入 | — | `localStorage` + 下载目录 | 手动 | [DATA.zh.md](./DATA.zh.md)、[USER-GUIDE.zh.md](./USER-GUIDE.zh.md) |
| 3 | 对局界面布局 | 20:9 等比 / 20:9 拉伸 / 锚点偏移 | **锚点偏移** | `gitcg.gameLayout` | 下一局 | [UI.zh.md](./UI.zh.md) |
| 4 | 主体方向 | 竖屏 / 横屏 | **竖屏** | `gitcg.mainOrientation` | 立即 | [UI.zh.md](./UI.zh.md) |
| 5 | 牌组图高画质渲染 | 关（JPG）/ 开（PNG） | **关** | `gitcg.shareQuality` | 立即 | **[DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md)** |

---

## 1. AI 数据备份 / 导入

- **打包了什么**
  - AI 对局经验 `gi-tcg-ai-learning-v1`（胜率、偏好、局数）
  - 决策记忆 `gi-tcg-ai-memory-v1`
  - 对局日志 `gi-tcg-ai-game-log-v1`
  - 三处 AI 设置 `gi-tcg-ai-settings-v2:sim` / `:lab` / `:train`
- **文件名**：`gitcg-ai-backup-YYYY-MM-DD-HH-MM.json`
- **导出位置（安卓）**：`下载/七圣召唤工具/AI数据备份/`
- **导入**：选择备份文件，合并本机；内置的 69,515 局社区种子随应用走，不需要备份
- **什么时候用**：换机、重装、清缓存前。清应用缓存会把 `localStorage` 一起清掉，AI 记忆和牌组都会没
- **注意**：AI 研究线已封存，备份只影响手机端搜索 AI 的经验，不改变 AI 强度上限（见 [AI.zh.md](./AI.zh.md)）

## 2. 牌组库备份 / 导入

- **打包了什么**：`localStorage` 里的用户牌组（组牌器自建、实验室 AI 组牌、手动添加）
- **文件名**：`deck-library-YYYY-MM-DD.json`
- **导出位置（安卓）**：`下载/七圣召唤工具/牌组库备份/`
- **导入**：按牌组指纹合并，重复的不会叠加；上限约 400 套（超出按导入顺序截断）
- **注意**：社区 4,557 套牌组是内置数据，不在备份范围里，删了不会丢

## 3. 对局界面布局

三种模式影响**模拟器对局画面**在小屏上的排布：

| 模式 | 值 | 效果 |
|---|---|---|
| 20:9 等比 | `classic` | 画面按 20:9 等比缩放，多出来的边用木纹填充，不裁切 |
| 20:9 拉伸填充 | `stretch` | 铺满整屏，非 20:9 屏幕整体拉伸变形 |
| 锚点偏移 | `anchor` | 角色、手牌、牌堆按十字中心锚定偏移，任意比例不变形不裁切（默认、推荐） |

- 存储键 `gitcg.gameLayout`，默认 `anchor`
- **切换后要重新开一局才生效**（当前对局不变）
- 各比例的约束与像素规则见 [UI.zh.md](./UI.zh.md)

## 4. 主体方向

- `portrait`（默认）：工具页（首页、牌组库、组牌器、实验室、AI 设置）竖屏，单手操作
- `landscape`：工具页跟随手机横屏
- 存储键 `gitcg.mainOrientation`，点选立即生效并持久化
- **模拟器对局界面永远横屏**，不受这一项影响；摆盘器/对局页同理
- 页面实现：各页加载时读 `localStorage` 后调 `AndroidHost.setOrientation`；网页版无此宿主方法，靠浏览器方向

## 5. 牌组图高画质渲染

这是唯一直接影响「生图」的设置，三个入口（组牌器 / 牌组库 / 卡组实验室）共用：

| 档位 | 值 | 输出 | 体积 | 适用 |
|---|---|---|---|---|
| 关（默认） | `compact` | 2160×5716 缩到 65% → **1404×3715 JPEG q0.82** | 约 **0.85 MB** | 发群、发动态 |
| 开 | `lossless` | 原尺寸 **2160×5716 PNG** | 约 **10.5 MB** | 放大看细节、存档 |

- 存储键 `gitcg.shareQuality`，切换后**下一次生成立即按新档位**，不用重启
- 导出的图统一存到 `下载/七圣召唤工具/牌组图/`
- 渲染参数（留白、卡宽比、牌组码字号）与改法见 **[DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md)**

---

## 存储键总表（排查用）

| 键 | 内容 | 谁写 |
|---|---|---|
| `gitcg.gameLayout` | 对局布局 `classic/stretch/anchor` | 设置面板 |
| `gitcg.mainOrientation` | 主体方向 `portrait/landscape` | 设置面板 |
| `gitcg.shareQuality` | 牌组图画质 `compact/lossless` | 设置面板 |
| `gi-tcg-ai-learning-v1` | AI 经验（胜率/偏好/局数） | 对局结束 |
| `gi-tcg-ai-memory-v1` | 决策记忆 | 对局结束 |
| `gi-tcg-ai-game-log-v1` | 对局日志 | 对局结束 |
| `gi-tcg-ai-settings-v2:sim/lab/train` | 三处 AI 参数 | AI 设置页 |
| 用户牌组键 | 自建/AI 组牌 | 组牌器、实验室 |

> **清应用缓存的后果**：上表全部清空，且本地记忆一起没了；换机/重装前先在设置里导出备份。
> 内置的社区牌组库与卡图素材随 APK 走，不受影响。

---

## 加新设置项的约定

1. 新键统一用 `gitcg.` 前缀，默认值写在读取处（不要依赖 JSON 文件）；
2. 只做本地 `localStorage`，不要新增联网请求（APK 零权限、无 INTERNET）；
3. 选项即时生效的，在 UI 上说明生效时机（像「切换后重新开始一局生效」）；
4. 同步更新：本文速查表、README 文档表、[USER-GUIDE.zh.md](./USER-GUIDE.zh.md) 的对应章节；
5. 如果影响输出文件（像牌组图），在 [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md) 补一行档位与体积。
