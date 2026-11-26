<div align="center">

# 七圣召唤工具（离线版）

**对局模拟器 · 牌组库 · 卡组实验室 · 组牌器 · 摆盘器 · AI 训练器**

全部离线运行 · 零权限 · 不联网 · 安卓 10+

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
![platform](https://img.shields.io/badge/platform-Android%2010%2B%20%7C%20Web-green)
![no network](https://img.shields.io/badge/network-none-important)

</div>

> 基于开源项目 [piovium/genius-invokation](https://github.com/piovium/genius-invokation) 二次开发，
> 遵循 **AGPL-3.0**，来源与美术版权声明见 [NOTICE.md](./NOTICE.md)。

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
- 社区牌组 4,543 套，带**胜率、对局数、同风格对比、五段打法说明**；
- 按流派、元素、来源、作者、卡牌筛选；
- 支持本地训练补齐样本、按对手牌组反查克制关系。

### 3. 卡组实验室
- 输入对手牌组码 → 多线程 AI 穷举候选牌组 → 找出克制它的那套；
- 每副候选的对局数可调（2/4/6/10/20/30，默认 6），线程数可调；
- 结果直接落库，一键生成牌组图/克制列表。

### 4. 组牌器
- 三个角色 + 30 张行动牌的正规组牌流程；
- 按费用、元素、卡牌类型筛选，实时合法性检查并写清不合规原因；
- 一键生成牌组码、牌组图，直接分享；
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

## 三、目录结构

```
packages/                  pnpm monorepo
  core/                    对局引擎（规则、状态机、reducer）
  ai/                      AI：搜索、进化、经验库、牌组池
  data/                    卡牌与角色数据
  web-ui-core/             对局界面组件（棋盘、手牌、骰子、技能面板）
  deck-builder/            组牌器组件
  state-editor/            摆盘器组件
  standalone/              独立 Web 应用入口（hub / 模拟器 / 实验室 / 牌组库）
android/                   安卓 WebView 壳
  src/                     MainActivity、资源拦截、设置页
  build.sh                 一键打包脚本
  dev-docs/                开发资料（构建、数据更新、交接）
trainer/                   电脑端 AI 训练器
promo/                     宣传片工程（Motion Canvas）
docs/                      文档
```

## 四、快速开始

### 网页版（开发调试）

```bash
pnpm install --config.package-import-method=copy
pnpm --filter @gi-tcg/assets-manager build
pnpm --filter @gi-tcg/web-ui-core build
pnpm --filter @gi-tcg/deck-builder build
pnpm --filter @gi-tcg/standalone build

# 本地起服务看效果
cd packages/standalone/dist && python3 -m http.server 8899
# 首页    http://127.0.0.1:8899/hub.html
# 模拟器  http://127.0.0.1:8899/app.html
```

### 安卓 APK

```bash
cp -r packages/standalone/dist /path/to/android/dist-lab
cd android && ./build.sh     # 需要 android-sdk、d8、apksigner
```

详细步骤、坑与版本号位置见 [docs/BUILD.zh.md](./docs/BUILD.zh.md)。

### 资源与数据

美术素材与社区牌组数据不入库（版权与体积原因），抓取方式见
[docs/ASSETS.zh.md](./docs/ASSETS.zh.md)。

## 五、文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.zh.md](./docs/ARCHITECTURE.zh.md) | 各包职责、运行时数据流、安卓壳实现、AI 结构 |
| [docs/BUILD.zh.md](./docs/BUILD.zh.md) | 构建、打包、签名、版本号、测试环境 |
| [docs/DEVLOG.zh.md](./docs/DEVLOG.zh.md) | 迭代记录：每个版本改了什么、问题根因 |
| [docs/PITFALLS.zh.md](./docs/PITFALLS.zh.md) | 踩坑清单：现象 / 根因 / 解法 |
| [docs/TRAINER.zh.md](./docs/TRAINER.zh.md) | 训练器设计、参数、经验导出与回灌 |
| [docs/ASSETS.zh.md](./docs/ASSETS.zh.md) | 卡面 / 数据 / 牌组库抓取说明 |

## 六、FAQ

**Q：为什么不直接发完整源码包（含素材）？**
素材版权归米哈游，仓库只放代码与抓取脚本，自己构建时按文档拉取即可。

**Q：为什么 APK 连 INTERNET 权限都没有？**
安卓壳用 `WebViewClient.shouldInterceptRequest` 从 `assets/` 直接出内容，
不需要网络栈；origin 固定 `http://127.0.0.1:8765` 以便 localStorage 有稳定域。

**Q：AI 有多强？**
诚实定位：不比熟练玩家强，靠搜索预算和经验库堆出来的稳定度；
胜率数据来自自我对弈，不含人类对局。

**Q：能在电脑上用吗？**
可以，用网页版（`pnpm --filter @gi-tcg/standalone dev`）或构建后本地起服务。

## 七、致谢

- 规则引擎与卡牌数据：[piovium/genius-invokation](https://github.com/piovium/genius-invokation) 及其贡献者；
- 卡牌美术、图标、界面素材：miHoYo / HoYoverse；
- 社区牌组：牌组广场与米游社的各位作者。

## 八、许可

代码以 **AGPL-3.0** 分发，见 [LICENSE](./LICENSE)。
修改后再分发（包括以服务形式提供）时，请保留同样许可并公开源码。
