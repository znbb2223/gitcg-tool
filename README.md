# 七圣召唤工具（离线版）

七圣召唤（Genshin TCG）的离线辅助工具：对局模拟器、牌组库、卡组实验室、组牌器、
摆盘器，外加一个可自我迭代的 AI 训练器。全部离线运行、零权限、不联网。

> 本项目基于 [piovium/genius-invokation](https://github.com/piovium/genius-invokation)
> 二次开发，遵循 **AGPL-3.0** 许可，详见 [NOTICE.md](./NOTICE.md) 与 [LICENSE](./LICENSE)。

## 功能

| 模块 | 说明 |
|---|---|
| 模拟器 | 完整对局规则，人机对战 / 机机观战，对局日志逐帧回放 |
| 牌组库 | 社区牌组 + 胜率、同风格对比、五段打法说明 |
| 卡组实验室 | 多线程 AI 穷举候选牌组，找对目标牌组的克制牌组 |
| 组牌器 | 筛选、合法性检查、一键牌组码与牌组图 |
| 摆盘器 | 自由编辑局面，一键开局，支持快照导出 |
| AI 训练器 | 电脑端多线程自我对弈，每批吃掉经验，越练越强 |

## 目录结构

```
packages/            上游 monorepo（core 引擎 / ai / data / web-ui-core / standalone 等）
android/             安卓 WebView 壳（内置资源、无网络权限）
trainer/             电脑端 AI 训练器（Node，多线程）
promo/               宣传片工程（Motion Canvas）
docs/                上游文档
```

## 构建

```bash
pnpm install --config.package-import-method=copy
pnpm --filter @gi-tcg/assets-manager build
pnpm --filter @gi-tcg/web-ui-core build
pnpm --filter @gi-tcg/deck-builder build
pnpm --filter @gi-tcg/standalone build
```

资源镜像（卡面、图标、牌组数据，体积大且版权归米哈游，需自行获取）：

```bash
node packages/standalone/scripts/download-assets.mjs
node packages/standalone/scripts/download-datum.mjs
node packages/standalone/scripts/download-full.mjs
```

安卓壳打包见 `android/build.sh`（需要 android-sdk + d8 + apksigner）。

## 训练器

```bash
cd trainer
node trainer.mjs        # 交互式设置批次/线程数后开跑
```

每批打完合并经验到 `learning.json`，导出 `gitcg-trained-ai-*.json` 可在工具内
「设置 → 导入 AI 数据」回灌手机端。

## 说明

- 本工具不含任何联网功能，资源全部内置；
- 游戏规则与卡牌数据来自上游开源项目，美术素材版权归 miHoYo；
- 仅供学习交流，请勿用于商业用途。
