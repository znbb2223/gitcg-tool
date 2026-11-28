<div align="center">

# 七圣召唤工具（离线版）

**对局模拟器 · 牌组库 · 卡组实验室 · 组牌器 · 摆盘器 · AI 训练器**

全部离线运行 · 零权限 · 不联网 · 安卓 10+

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
![platform](https://img.shields.io/badge/platform-Android%2010%2B%20%7C%20Web-green)
![no network](https://img.shields.io/badge/network-none-important)

**快速导航**：
[用户指南](./docs/USER-GUIDE.zh.md) ·
[文档索引](./docs/README.md) ·
[AI 实现详解](./docs/AI-实现详解.zh.md) ·
[架构](./docs/ARCHITECTURE.zh.md) ·
[构建](./docs/BUILD.zh.md) ·
[维护与数据更新](./docs/MAINTENANCE.zh.md) ·
[已知问题](./docs/KNOWN-ISSUES.zh.md) ·
[牌组码工具](./tools/deckcode/README.md) ·
[安卓壳](./android/README.md)

</div>

> 基于开源项目 [piovium/genius-invokation](https://github.com/piovium/genius-invokation) 二次开发，
> 遵循 **AGPL-3.0**，来源与美术版权声明见 [NOTICE.md](./NOTICE.md)。

> **项目状态（2026-11-28）**：工具功能已完成，**AI 研究线已封存**（不再迭代，仅保留搜索版 AI）。
> 总总结见 [artifacts/项目总总结-2026-11-28.md](./artifacts/项目总总结-2026-11-28.md)。

## 下载

**内置素材 APK**（150MB，Android 10+，零权限、不联网）：

- Release：**[v0.11.158](https://github.com/znbb2223/gitcg-tool/releases/tag/v0.11.158)**
- 文件：[`gitcg-tool-0.11.158-7.2.0.apk`](https://github.com/znbb2223/gitcg-tool/releases/download/v0.11.158/gitcg-tool-0.11.158-7.2.0.apk)（同页附 `SHA256SUMS.txt`）
- SHA256：`8c1adcbcfbff94f88ef6dc8ba4a7d7a14969a7ac426d72a8b22ecfaed8b5d160`
- 签名与原版一致（`63DB:7B0C…:90:83`），可覆盖安装旧版

> 非官方作品，与米哈游 / 原神官方无关，仅供学习交流，禁止商用。
> 游戏内卡图、立绘、UI 与商标版权归米哈游所有；请勿二次分发或售卖。

> **⚠️ 短期不再更新 / 只有 7.2.0 数据**
> 本仓库当前只含 **7.2.0** 卡牌数据，作者短期内不打算继续跟进版本。
> 原神官方或上游「雨酱牌」更新到 7.3.0 后，需要使用者自己合并数据；
> 完整步骤（含“上游没更新时怎么按机制自己补”）见 **[维护与数据更新](./docs/MAINTENANCE.zh.md)**。
> 已知 BUG（模拟器牌组输入框实际控制人机/AI、组牌器竖屏放大镜失效）见 **[KNOWN-ISSUES](./docs/KNOWN-ISSUES.zh.md)**。

> **🧩 非常规牌组码**：首页那张“3 个相同角色 + 30 张相同卡”的牌组图，是用
> **[牌组码工具](./tools/deckcode/README.md)** 生成的**非常手段**牌组，不是正常可对战牌组；
> 想自己生成/解码，见工具目录里的 4 个版本（sh / cmd / Windows / HTML）；
> 牌组图本身的规格与生成方式见 **[DECK-IMAGE.zh.md](./docs/DECK-IMAGE.zh.md)**。

---

## 一、这是什么

把七圣召唤（Genshin TCG）的**离线打牌环境**做成一个能装进口袋的小工具：
想练牌随时开一局，想研究环境有 AI 帮你跑克制推演，想分享牌组一键出图。

和原版网页工具的区别：

| | 原版 gi-tcg | 本项目 |
|---|---|---|
| 运行方式 | 需要联网加载资源 | 资源全部内置，飞行模式可用 |
| 应用形态 | 浏览器网页 | 安卓 APK（WebView 壳，可离线装） |
| 权限 | — | **零权限**（连 INTERNET 都没有） |
| 界面 | 桌面网页布局 | 按手机 20:9 重做的手游布局 + 原神风皮肤 |
| AI | 网页端对弈 | 本地多线程搜索 + 可自我迭代的训练器 |

## 二、功能

### 1. 对局模拟器
- 完整规则引擎：事件、技能、元素反应、召唤物、状态、骰子，全部按规则结算；
- **人机对战**（和内置 AI 打）/ **机机观战**（AI 自对弈，适合看套路）；
- 对局日志逐帧回放，可导出复盘；
- 三种横屏布局：20:9 等比 / 20:9 拉伸 / 锚点偏移（16:9、16:10、3:2、19.5:9 自适应）。

### 2. 牌组库
- 社区牌组 4,557 套，带**胜率、对局数、同风格对比、五段打法说明**；
- 按流派、元素、来源、作者、卡牌筛选；
- 支持本地训练补齐样本、按对手牌组反查克制关系。

### 3. 卡组实验室
- 输入对手牌组码 → 多线程 AI 穷举候选牌组 → 找出克制它的那套；
- 每副候选的对局数可调（2/4/6/10/20/30，默认 6），线程数可调；
- 结果直接落库，一键生成牌组图/克制列表。

### 4. 组牌器
- 三个角色 + 30 张行动牌的正规组牌流程；
- 按费用、元素、卡牌类型筛选，实时合法性检查并写清不合规原因；
- 一键生成牌组码、牌组图，直接分享（规格与改法见 [docs/DECK-IMAGE.zh.md](./docs/DECK-IMAGE.zh.md)）；
- 支持「合法性检查」开关（练手时可以关掉规则限制）。

### 5. 摆盘器
- 自由编辑局面：手牌、牌库、骰子、角色位置、召唤物状态；
- 摆好一键开局，或导出局面快照；
- 打完回到编辑器继续改，不用从头摆。

### 6. AI 训练器（电脑端）
- Node 写的多线程自我对弈训练器，和手机端同一套 AI；
- 每批打完把经验合并进 `learning.json`，牌组胜率、角色/卡牌偏好同步变准；
- 导出的 `gitcg-trained-ai-*.json` 可在工具里「设置 → 导入 AI 数据」回灌手机；
- 详见 [docs/TRAINER.zh.md](./docs/TRAINER.zh.md)。

## 三、界面预览

> 工具首页 / 组牌器 / 摆盘器 / 实验室 / 牌组库等为**竖屏实拍**；对局配置与对局界面为**横屏实拍**。

<table>
<tr>
<td align="center" width="33%"><img src="./docs/screenshots/01-hub.png" width="210"><br/><sub>工具首页</sub></td>
<td align="center" width="33%"><img src="./docs/screenshots/04-deck-builder.png" width="210"><br/><sub>组牌器</sub></td>
<td align="center" width="33%"><img src="./docs/screenshots/05-state-editor.png" width="210"><br/><sub>摆盘器</sub></td>
</tr>
<tr>
<td align="center"><img src="./docs/screenshots/06-lab.png" width="210"><br/><sub>卡组实验室</sub></td>
<td align="center"><img src="./docs/screenshots/07-lab-deck-image.png" width="210"><br/><sub>实验室 · 生成牌组图</sub></td>
<td align="center"><img src="./docs/screenshots/08-deck-library.png" width="210"><br/><sub>牌组库</sub></td>
</tr>
</table>

<table>
<tr>
<td width="50%"><img src="./docs/screenshots/02-sim-config.png"><br/><sub>模拟器 · 对局配置（横屏）</sub></td>
<td width="50%"><img src="./docs/screenshots/03-sim-game.png"><br/><sub>模拟器 · 对局界面（横屏）</sub></td>
</tr>
</table>

<p align="center"><img src="./docs/screenshots/09-deck-image.png" width="280"><br/><sub>牌组图（由牌组码工具生成的非常规整活牌组）· <a href="./docs/DECK-IMAGE.zh.md">怎么生成 / 规格与改法</a></sub></p>

## 四、整体结构

- 手机端 APK：`WebView` → `hub 首页` → 模拟器 / 牌组库 / 组牌器 / 摆盘器 / 关于；
- 模拟器依赖 `core 引擎` 与 `ai 搜索`；牌组库依赖 `deck-library.json`；
- AI 搜索读取 `经验库`；摆盘器复用 `core` 引擎；
- 电脑训练器通过「导入经验包」把结果写回 `经验库`。


## 五、目录结构

**仓库根目录**

| 目录 | 作用 |
|---|---|
| `packages/` | pnpm monorepo（下面单独列） |
| `android/` | 安卓 WebView 壳（MainActivity、资源拦截、设置页、`build.sh`） |
| `trainer/` | 电脑端 AI 训练器（Node 多线程自对弈 + 经验导出） |
| `tools/deckcode/` | 牌组码工具（sh / bat / Windows / HTML 四版） |
| `promo/` | 宣传片工程（Motion Canvas） |
| `docs/` | 文档中心，入口是 [docs/README.md](./docs/README.md) |
| `artifacts/` | AI 实验归档、总总结、数据快照 |
| `deploy/` | 部署脚本（服务器侧，非手机运行必需） |
| `patches/` `/proto/` `/scripts/` | 补丁、protobuf 定义、辅助脚本 |

**`packages/` 下**

| 包 | 作用 |
|---|---|
| `core/` | 对局引擎（规则、状态机、reducer） |
| `ai/` | AI：搜索、经验库、牌组池 |
| `data/` | 卡牌与角色数据 |
| `web-ui-core/` | 对局界面组件（棋盘、手牌、骰子、技能面板） |
| `deck-builder/` | 组牌器组件 |
| `state-editor/` | 摆盘器组件 |
| `standalone/` | 独立 Web 应用入口（hub / 模拟器 / 实验室 / 牌组库） |
| `assets-manager/` | 素材路径与清单 |
| `card-data-viewer/`、`detail-log-viewer/` | 卡牌/日志查看器（开发辅助） |
| `server/`、`web-client/`、`web-ui/` | 上游对战平台相关 |
| `typings/`、`utils/`、`config/`、`test/` | 类型、工具、配置、测试 |

## 六、快速开始

> ⚠️ 仓库**不含**卡面素材与牌组库（版权 + 体积），不先抓会构建出一个“空壳页面”。
> 抓取命令见 [docs/ASSETS.zh.md](./docs/ASSETS.zh.md)，落地目录见 [docs/BUILD.zh.md](./docs/BUILD.zh.md) 第 2 节。

### 一键构建（开发者）

```bash
# 全流程：抓素材 → 装依赖 → 构建 → 打 APK → 校验（手机上先看脚本体检输出）
sh build-oneclick.sh
# 不联网：用旧 APK 里的素材重建
sh build-oneclick.sh --from-apk 旧包.apk
# 只构建 Web
sh build-oneclick.sh --web-only
```

### 手动构建（开发调试）

```bash
# 安装依赖（copy 模式，避免硬链接失败；手机/arm64 先设 PUPPETEER_SKIP_DOWNLOAD=1）
pnpm install --config.package-import-method=copy
# 按依赖拓扑构建（typings/data/core/ui/standalone 一次到位）
pnpm --filter "@gi-tcg/standalone..." build

# 本地起服务看效果
cd packages/standalone/dist && python3 -m http.server 8899
# 首页    http://127.0.0.1:8899/hub.html
# 模拟器  http://127.0.0.1:8899/app.html
```


### 安卓 APK

```bash
# 把 Web 产物复制到安卓壳工程（目录名必须是 dist-lab）
cp -r packages/standalone/dist /path/to/android/dist-lab
# 进入安卓目录并打包（需要 android-sdk、d8、apksigner）
cd android && ./build.sh
```


详细步骤、坑与版本号位置见 [docs/BUILD.zh.md](./docs/BUILD.zh.md)。

### 资源与数据

美术素材与社区牌组数据不入库（版权与体积原因），抓取方式见
[docs/ASSETS.zh.md](./docs/ASSETS.zh.md)。

## 七、文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.zh.md](./docs/ARCHITECTURE.zh.md) | 各包职责、运行时数据流、安卓壳实现、AI 结构 |
| [docs/BUILD.zh.md](./docs/BUILD.zh.md) | **从零构建与打包**：环境版本、素材、构建顺序、APK、常见失败、牌组构筑规则 |
| [android/README.md](./android/README.md) | 安卓包从零构建：工具链、入口对调、签名与校验 |
| [docs/DEVLOG.zh.md](./docs/DEVLOG.zh.md) | 迭代记录：每个版本改了什么、问题根因 |
| [docs/PITFALLS.zh.md](./docs/PITFALLS.zh.md) | 踩坑清单：现象 / 根因 / 解法 |
| [docs/TRAINER.zh.md](./docs/TRAINER.zh.md) | 训练器设计、参数、经验导出与回灌 |
| [docs/ASSETS.zh.md](./docs/ASSETS.zh.md) | 卡面 / 数据 / 牌组库抓取说明 |
| [docs/DOC-STANDARD.md](./docs/DOC-STANDARD.md) | **文档规范**：必备结构、事实核对、自检脚本 |
| [docs/FACTS.md](./docs/FACTS.md) | **数字核对表**：4,557 套 / 70,102 局 / 149MB 等关键数字的出处与校验命令 |
| [docs/SETTINGS.zh.md](./docs/SETTINGS.zh.md) | **设置面板**：5 个设置项、默认值、存储键、与生图/布局/备份的关系 |
| [docs/DECK-IMAGE.zh.md](./docs/DECK-IMAGE.zh.md) | **牌组图**：入口、输出规格（尺寸/体积）、实现位置与改法 |
| [docs/DATA.zh.md](./docs/DATA.zh.md) | 牌组码编码、牌组库条目、AI 经验包、缓存键 |
| [docs/UI.zh.md](./docs/UI.zh.md) | **界面规范**：色板/字体/组件、对局三态布局与锚点数学、素材、断点、验收 |
| [docs/TESTING.zh.md](./docs/TESTING.zh.md) | 截图 / DOM 尺寸 / 像素采样 / AI 自对弈验收法 |
| [docs/ROADMAP.zh.md](./docs/ROADMAP.zh.md) | 路线图 |
| [docs/USER-GUIDE.zh.md](./docs/USER-GUIDE.zh.md) | 带图新手指南：从首页到打一局 |
| [docs/INSTALL.zh.md](./docs/INSTALL.zh.md) | 安装、系统要求、卸载与重置 |
| [docs/GLOSSARY.zh.md](./docs/GLOSSARY.zh.md) | 术语表（对局 / 工具 / AI） |
| [docs/AI.zh.md](./docs/AI.zh.md) | **AI 原理、强度定位、强度旋钮、局限** |
| [docs/AI-实现详解.zh.md](./docs/AI-实现详解.zh.md) | **AI 全景实现详解**：代码走读、搜索/价值/策略/DMC、术语表、44 维特征 |
| [docs/AI-ROADMAP.zh.md](./docs/AI-ROADMAP.zh.md) | **14 个 AI 组件路线图、阶段门槛、成本** |
| [docs/KNOWN-ISSUES.zh.md](./docs/KNOWN-ISSUES.zh.md) | **已知问题与限制、规避方式** |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日志 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |
| [SECURITY.md](./SECURITY.md) | 隐私与权限声明 |

> **APK 内也带一份开发资料**：解包 APK（改后缀为 zip）后看 `assets/dev-docs/`，
> 里面有当前状态、已知 BUG、牌组码工具、7.3.0 数据合并与免责声明。

## 八、FAQ

### Q：这个工具还会更新吗？后续版本怎么办？
**A：** 短期不再更新。当前只含 **7.2.0** 数据；原神官方或上游「雨酱牌」更新到 7.3.0 后，
需要使用者自己按 [维护与数据更新](./docs/MAINTENANCE.zh.md) 合并——里面分别写了
“上游已更新”和“上游没更新、自己按机制补”两条路线。已知 BUG 见 [KNOWN-ISSUES](./docs/KNOWN-ISSUES.zh.md)。

### Q：为什么不直接发完整源码包（含素材）？
**A：** 素材版权归米哈游，仓库只放代码与抓取脚本，自己构建时按文档拉取即可。

### Q：为什么 APK 连 INTERNET 权限都没有？
**A：** 安卓壳用 `WebViewClient.shouldInterceptRequest` 从 `assets/` 直接出内容，
不需要网络栈；origin 固定 `http://127.0.0.1:8765` 以便 localStorage 有稳定域。

### Q：AI 有多强？
**A：** 诚实定位：不比熟练玩家强，靠搜索预算和经验库堆出来的稳定度；
胜率数据来自自我对弈，不含人类对局。**AI 研究线已于 2026-11-28 封存**，
最终结论见 [AI 终结报告](./artifacts/ai/AI-终结报告-2026-11-28.md)。
搜索版对启发式约 60%，DMC 尝试（0.1ms/手）只到 150ms 搜索水平，未达上线门槛。

### Q：能在电脑上用吗？
**A：** 可以，用网页版（`pnpm --filter @gi-tcg/standalone dev`）或构建后本地起服务。

## 九、致谢

- **主要编程与代码工作：DSH（DeepSeek Harness）**——开发、实验编排、训练、文档与工具链均由 DSH 完成，特此致谢；
- 规则引擎与卡牌数据：[piovium/genius-invokation](https://github.com/piovium/genius-invokation) 及其贡献者；
- 卡牌美术、图标、界面素材：miHoYo / HoYoverse；
- 社区牌组：牌组广场与米游社的各位作者。

## 十、许可与免责声明

代码以 **AGPL-3.0** 分发，见 [LICENSE](./LICENSE)。
修改后再分发（包括以服务形式提供）时，请保留同样许可并公开源码。

### 免责声明

- 本工具是**非官方**的玩家作品，与 **miHoYo / HoYoverse**、**雨酱牌作者**均无隶属、合作或授权关系；
- 游戏卡面、角色立绘、元素图标、界面底图与 BGM 版权归 **miHoYo / HoYoverse** 所有；
- 本项目仅用于**个人学习、研究与交流**，不得用于商业售卖、付费服务或冒充官方；
- 仓库不包含受版权保护的美术资源与牌组库数据，需自行按脚本获取或使用合法持有的资源；
- 若权利人认为内容侵权，请联系删除，会立即处理。

### 特别感谢

- **piovium/genius-invokation** 及贡献者：提供引擎、卡牌数据与规则；
- **DSH（DeepSeek Harness）**：主要开发、实验编排、训练、文档与工具链；
- 牌组广场与米游社的牌组作者，以及所有提 Issue / 反馈的玩家。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](docs/AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](docs/AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](docs/AI-实现详解.zh.md) · [AI.zh.md](docs/AI.zh.md)
- [AI实验交接-2026-11-27.md](docs/AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](docs/ARCHITECTURE.zh.md) · [ASSETS.zh.md](docs/ASSETS.zh.md) · [BUILD.zh.md](docs/BUILD.zh.md)
- [DATA.zh.md](docs/DATA.zh.md) · [DEVLOG.zh.md](docs/DEVLOG.zh.md) · [GLOSSARY.zh.md](docs/GLOSSARY.zh.md) · [INSTALL.zh.md](docs/INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](docs/KNOWN-ISSUES.zh.md) · [PITFALLS.zh.md](docs/PITFALLS.zh.md) · [README.md](docs/README.md) · [ROADMAP.zh.md](docs/ROADMAP.zh.md)
- [TESTING.zh.md](docs/TESTING.zh.md) · [TRAINER.zh.md](docs/TRAINER.zh.md) · [UI.zh.md](docs/UI.zh.md) · [USER-GUIDE.zh.md](docs/USER-GUIDE.zh.md)
