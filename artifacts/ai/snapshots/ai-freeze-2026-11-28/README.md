# AI 成果冷冻快照 · 2026-11-28 00:25

> 目的：在换新路线之前，把当前"规则引擎 + 启发式 + 推演搜索"这条线的代码、模型、结论完整冻住，
> 随时可回退，也作为新路线的对照基线。

## 包含什么

| 文件 | 内容 | 大小 |
|---|---|---|
| `ai-stack.tar.xz` | `packages/ai/{src,scripts,tools,docs}`、`packages/core/src`、`packages/data/src`、6 个模型 JSON、7 份结论文档 | 1.4MB / 420 文件 |
| `gi-tcg-tracked-changes.patch` | 当天对 gi-tcg 仓库**已跟踪文件**的全部改动（`git diff`） | 267KB |
| `git-info.txt` | gi-tcg / gitcg-publish 的 HEAD 与工作区状态 | — |
| `sha256.txt` | 快照、6 个模型、交付 APK 的校验和 | — |

## 当前这条线的能力（冻结值）

- 线上配置：`规则引擎 + 启发式 + 推演搜索`；搜索 `budgetMs=2500`（`balanced` 预设）、`skipRolloutPreview=true`、
  `realisticHidden=true`（不再读对手真实手牌）；价值网 / 策略网 / 查表 / 记忆 / 贝叶斯全关。
- 本机实测：2500ms 一次决策 ≈ **124 条 rollout**，每条约 20ms（深度 10）。
- A/B（镜像配对，208 局起步）：搜索 vs 纯启发式 **60.1~60.7%**；跳过预览 **63.9~65.2%**；
  600ms vs 150ms **75~75.7%**；猜牌 vs 旧逻辑（App 等价配置）**48.7%**。
- 已知短板：rollout 策略是贪心近似、评估是手工材料分、无对手建模、深度只有 10 个动作 → 对真人很弱。

## 怎么恢复

```bash
cd /root/workspace/gi-tcg
tar -xJf artifacts/ai/snapshots/ai-freeze-2026-11-28/ai-stack.tar.xz
# 解压出来就是 core/data/ai 的当前状态；patch 只用于对照其它包的改动，不要重复套在 core/data 上
cd packages/core && npx tsdown
cd ../ai && npx tsdown
# 重新打包实验程序（服务器用）
node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/bin/esbuild \
  packages/ai/scripts/ab-value.mjs --bundle --platform=node --format=esm \
  --target=node20 --outfile=dist-collect/ab-value.bundle.mjs
```

## 不在快照里（另有存放）

| 资产 | 位置 |
|---|---|
| v3 样本 2 万局 / 59.3 万条（64MB） | `gi-tcg/collected/traj-v3/` |
| v6 样本 480 局 / 2.09 万条（44 维） | `gi-tcg/collected/traj-v6/`、服务器 `/data/gitcg/traj-v6` |
| 牌组库 4,557 套 | `packages/standalone/public/data/deck-library.json`（9.6MB） |
| 现有 APK（含隐藏信息修复） | `/sdcard/Download/DSH-Go/七圣召唤工具-0.11.157-隐藏信息修复.apk` |
| 旧 Web 产物 + 旧 APK | `gitcg-lab/backup-1127-2345/` |
| 服务器实验包（ab-value / collect / check-hidden） | 服务器 `/data/gitcg/bin2/` |
| 源码级备份（不含模型/文档） | `artifacts/ai/backup-src-1127/` |

## 基线怎么用

新路线要和这条线打，直接用服务器上的 `ab-value.bundle.mjs`：A 侧跑新 AI，B 侧用
`--b=v1`（搜索基线）或 `--b=heur`（纯启发式），`--pairs` 镜像配对、`--offset` 分片并行。
