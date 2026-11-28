> 目录总览与最新状态见同目录 `README.md`；数据合并见 `MAINTENANCE.md`。

---
name: genius-invokation
description: 七圣召唤（Genius Invokation）项目的接手与迭代：离线资源镜像、20:9 手游化布局、原版皮肤、安卓 WebView 壳打包、AI 搜索/训练/经验库版本化、以及根据用户提供的真实卡组做克制推演与打法分析。用户说「七圣召唤」「雨酱牌」「打不过这个卡组」「重构打包新版本」时加载。
whenToUse: The user asks about the Genshin TCG (Genius Invokation / 雨酱牌) project — rebuilding the offline APK for a new game version, analyzing a deck from the real game, or continuing AI training/experience work.
---

# 七圣召唤 Agent · 项目攻略

## 0. 项目坐标

| 项 | 位置 |
|---|---|
| 上游仓库 | `/root/workspace/gi-tcg`（piovium/genius-invokation，pnpm monorepo） |
| AI 包 | `packages/ai`（搜索、评估、组卡、经验、自对弈脚本） |
| 独立网页版 | `packages/standalone`（配置页 + 对局 + 训练面板 + 导出） |
| 棋盘 UI | `packages/web-ui-core` |
| 资源管理 | `packages/assets-manager` |
| 安卓壳 | `/root/workspace/gitcg-apk`（WebView + 内嵌 HTTP 资源服务器） |
| 备份 | `/sdcard/Download/DSH-Go/backup-7.2.0/` |
| 交付 APK | `/sdcard/Download/七圣召唤-<版本>-<游戏版本>.apk` |

环境要点：Node 24 + `engine-strict=false`（仓库要求 ^26）；
`pnpm install --config.package-import-method=copy`、`PUPPETEER_SKIP_DOWNLOAD=1`。
安卓工具链：`/usr/lib/android-sdk`（platforms/android-23/android.jar）+ `/opt/android/bt/android-14/d8` + `aapt`/`zipalign`/`apksigner`。

## 1. 版本体系（最重要）

- 游戏数据版本常量：`packages/ai/src/learner.ts` 的 `GAME_VERSION`（当前 `"7.2.0"`）。
- 经验库结构：`LearningData.gameVersion` + `versions[版本] = {games,wins,draws}` 分桶；
  `recordGame()` 自动累加当前版本；`loadLearning()` 会为旧存档补 `gameVersion`。
- 导出文件名：`ai-experience-<GAME_VERSION>-<日期>.json`。
- 换 7.3.0 时：
  1. 改 `GAME_VERSION`；
  2. 旧经验保留（`versions["7.2.0"]` 不动），新对局进 `versions["7.3.0"]`；
  3. 需要对比环境：按版本分别跑 `packages/ai/scripts/tournament.mjs`，比较同一批牌组在新旧版本行为（数据要同步换新 `getData(version)`）；
  4. 需要重新训练：删/改名 `packages/ai/docs/learning.json` 与 `experience-seed.ts`，重跑自对弈生成新种子；
  5. 卡池变化时重跑 `gen-library.mjs` 重建牌组库。

## 2. 从 GitHub 新版本重构打包 SOP

```bash
cd /root/workspace/gi-tcg && git pull
pnpm install --config.package-import-method=copy
# 1) 资源镜像（若数据版本变化）
node packages/standalone/scripts/download-assets.mjs
node packages/standalone/scripts/download-datum.mjs
node packages/standalone/scripts/download-full.mjs
node packages/standalone/scripts/download-cardface.mjs
# 2) 应用皮肤/布局改动（见第 3 节；改动清单在备份 source-ui-7.2.0.zip）
pnpm --filter @gi-tcg/assets-manager build
pnpm --filter @gi-tcg/web-ui-core build
pnpm --filter @gi-tcg/standalone build
# 3) 安卓壳
rm -rf /root/workspace/gitcg-apk/build/assets/web
cp -r packages/standalone/dist /root/workspace/gitcg-apk/build/assets/web
cd /root/workspace/gitcg-apk && ./build.sh
# 4) 交付
cp build/gitcg.apk "/sdcard/Download/七圣召唤-<新版本>.apk"
```

注意构建顺序：**先 assets-manager、再 web-ui-core、最后 standalone**；每次 `git pull` 后旧 dist 会失效，必须全量重建。

## 3. 手游化布局与皮肤（已定稿参数）

- 设计空间：`packages/web-ui-core/src/layout.ts`
  `MINIMUM_WIDTH = 220`、`MINIMUM_HEIGHT = 99`（20:9，卡牌约 229px 宽）。
- 行间距：`gapAroundCharacterArea = Math.max(-6, ...)`，出战偏移 0，避免上下两排重叠。
- 棋盘底图：`ChessboardBackground-20x9.webp`（从多张真实截图拼接：81849 主体 + 81856 上下边框 + 81862 右下角；左右镜像、OpenCV inpaint 修残留）。
- 卡框：`CardFrameNormal.svg.webp` 为程序化绘制的多层金色渐变 + 角饰（420×720，矢量超采样），替换截图放大版。
- 状态条：`PlayerInfoBox` 天然支持 `name` + `avatarUrl`；
  standalone 传 `myPlayerInfo={{name:"旅行者", avatarUrl}}`、`oppPlayerInfo={{name:"AI", avatarUrl}}`。
- 头像：`avatar-lumine.webp` / `avatar-aether.webp` / `avatar-paimon.webp` 放 `public/assets-local/ui/`；
  每局随机荧/空，AI 固定派蒙（aiai 模式双方派蒙）。
- 先手：配置页「先手」下拉 → `aiGoesFirst`；`createGame` 后若为 false，把 `state.currentTurn` 置为 `PARENT_WHO`。
- 全屏：`body.game-active` 时 shell 固定 100vw×100dvh；标题/牌组码隐藏；`返回首页` 浮层在右上。

## 4. 离线资源（资源全清单）

镜像根：`packages/standalone/public/assets-local/`（打包进 APK 的 `assets/web/`）。
- `api/v5/image/{id}/{unspecified,icon,cardFace}/{thumb,full}.webp`
- `api/v5/image/raw/{UI_Gcg_*.webp}`（768 个：buff/技能/头像图标）
- `api/v5/datum/latest/{CHS,EN}/{id}.json`（卡片详情，4372 个；历史记录空白就是缺它）
- `api/v5/data/latest/{CHS,EN}/{characters,entities}.json`
- `ui/*.webp`（棋盘、按钮、骰子、卡框、头像）
- 安卓壳服务器兜底：`full→thumb`、`cardFace→unspecified`（`AssetServer.readAssetWithFallback`）。

## 5. AI 系统现状

- 搜索：`packages/ai/src/search.ts`（rollout + determinization + 斩杀快通道 + 记忆快路径，启发式先验融合）。
- Player：`player.ts`（reroll/换牌/选人/行动/选项、blunderRate、风格）。
- 经验：`learner.ts`（牌/角色/整副牌组战绩、`deckKey`、`summarizeDecks`、`mergeLearning`）。
- 组卡：`deck.ts`（`buildDeck` 按经验胜率加权 + 25% 变异，支持强度 strong/weak/random）。
- 自对弈：`selfplay.ts` + `scripts/{selfplay,bench,decktest,evolve,tournament,swarm-tournament,elite-tournament,best-deck}.mjs`。
- 数据：`packages/standalone/src/data/deck-library.ts`（1104 套）、`experience-seed.ts`（2306 局/1617 副）。
- 已知成绩：1.5s/步搜索 3:0 胜启发式；明牌 2:0；真实模式 1:1；精英赛 Top20 中 `1418/1417/1217` 71%、`1707/1310/1710` 68%。

## 6. 卡组推演（用户拿真实卡组来问）

用户会贴分享码/卡组截图（可能来自真实游戏），要求"怎么打、怕什么、用什么克制"。

流程：
1. **解码**：分享码可用 `DEFAULT_ASSETS_MANAGER.decode(code)` 或 `share_id` 规则；截图则识别角色/关键牌。
2. **确认版本**：问清或按当前 `GAME_VERSION`；若数据未同步，先跑资源镜像。
3. **建立对手牌组模型**：角色组合、费用曲线、核心 combo、致胜回合。
4. **跑推演**（工作区）：
   ```bash
   cd /root/workspace/gi-tcg/packages/ai
   node scripts/decktest.mjs --deck <code> --budget 1500     # 快速对强度
   node scripts/tournament.mjs --deck <code> --pool library  # 在牌组库找克制
   node scripts/best-deck.mjs --against <code>               # 反制牌组推荐
   ```
   无脚本时可直接用 `searchBestAction` 写一次性 node 脚本，或让 AI 用 `packages/ai/dist` 跑 50-100 局。
5. **输出**：
   - 对手节奏（快攻/中速/控制）与关键回合；
   - 我方留牌/换牌建议（起手找什么、弃什么）；
   - 元素反应与骰子规划；
   - 2-3 套克制牌组（含分享码）与每套的胜率估计（基于牌组库经验 `deckWinRate`）；
   - 一句"最推荐"和理由。

## 7. 已知坑

- **安卓壳资源服务器**：必须每连接一线程 + SO_TIMEOUT，否则 WebView 预连接会卡死整页（表现为永远 "App loading..."）。
- **端口**：固定 8765（localStorage 按 origin 存经验）；失败顺延，但顺延会丢档。
- **缓存**：升级后必须 `clearCache(true)` + `Cache-Control: no-store`，否则旧 HTML 引用旧 JS 白屏。
- **布局**：`MINIMUM_HEIGHT` 太小时行间距公式变负 → 上下两排角色重叠；用 `Math.max(-6, ...)` 兜底。
- **资源**：`datum` 缺失 → 卡片说明"加载失败"；`cardFace` 缺失 → 历史记录空白；`full` 缺失 → 详情/状态图空白。
- **Android 编译**：只有 android-23 jar，无法直接引用 API 29+ 常量（MediaStore.Downloads、layoutInDisplayCutoutMode），用字符串字段/反射。
- **构建顺序**：web-ui-core 改完必须重建，standalone 才会带上；APK 壳不参与 pnpm 构建。

## 8. 验收清单

- [ ] 首页可开局（人机/机机）、横屏、全屏、返回首页
- [ ] 卡牌大小 ~229px、上下两排不重叠、手牌可覆盖
- [ ] 历史记录/卡牌说明无空白图
- [ ] 导出经验写出 `/sdcard/Download/ai-experience-7.2.0-日期.json`
- [ ] `aapt dump badging` 版本号正确、`apksigner verify` 通过
- [ ] 备份目录完整（apk/web/source/source-ui/apk-project/README）
