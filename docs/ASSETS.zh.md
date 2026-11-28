# 素材与数据抓取说明

> 本仓库**不包含**游戏美术素材与社区牌组数据（涉及版权与体积），
> 只保留抓取/生成脚本。本文说明每一步怎么跑、产物落在哪。

## 0. 牌组库数据（构建必需）

牌组库/筛选数据打包放在公开 Release，CI 与手动构建都用它：

```bash
curl -fL -o /tmp/data.tar.gz \
  https://github.com/znbb2223/gitcg-tool/releases/download/data-7.2.0/data-7.2.0.tar.gz
mkdir -p packages/standalone/public/data
tar -xzf /tmp/data.tar.gz -C packages/standalone/public
```

解压后 `public/data/` 有 5 个 JSON（约 12.9MB）：`deck-library.json`、`filter-meta.json`、
`deck-index.json`、`random-decks.json`、`ai-deck-pool.json`。

## 1. 卡面 / 图标 / 界面图

上游脚本位置：`packages/standalone/scripts/`

```bash
# 下载卡牌素材（卡面、图标、UI 等）到 public/assets-local
node packages/standalone/scripts/download-assets.mjs
# 下载数据文件（卡牌定义、技能、标签等）
node packages/standalone/scripts/download-datum.mjs
# 下载完整素材包（批量拉取）
node packages/standalone/scripts/download-full.mjs
# 单独下载卡面图
node packages/standalone/scripts/download-cardface.mjs
```

产物目录：`packages/standalone/public/assets-local/`

| 子目录 | 内容 | 说明 |
|---|---|---|
| `api/v5/image/<id>/{unspecified,icon,cardFace}/{thumb,full}.webp` | 角色/卡牌立绘与图标 | 按卡牌 ID 落盘 |
| `api/v5/datum/latest/{CHS,EN}/<id>.json` | 卡牌详情（技能描述等） | 缺它 → 卡牌说明空白 |
| `api/v5/data/latest/{CHS,EN}/` | 角色/实体数据 | |
| `ui/` | 棋盘底图、骰子、卡框、按钮等 | |

说明：这些资源版权归米哈游 / HoYoverse 所有，脚本仅做本地镜像用于离线运行，
请自行遵守相关使用条款，不要二次分发。

## 2. 社区牌组库

脚本位置：`packages/ai/scripts/`

```bash
# 抓牌组广场：先抓分区/标签列表
node packages/ai/scripts/scrape-cardsquare-labels.mjs
# 再按标签抓牌组
node packages/ai/scripts/scrape-cardsquare.mjs
# 抓米游社：按关键词搜索
node packages/ai/scripts/scrape-miyoushe.mjs
# 补全牌组说明与作者信息（广场）
node packages/ai/scripts/enrich-cardsquare-details.mjs
# 补全米游社帖子详情
node packages/ai/scripts/enrich-miyoushe-posts.mjs
# 生成成品：牌组库 + 索引 + 筛选元数据
node packages/ai/scripts/build-decklib.mjs
# 从牌组库生成 AI 用的牌库先验
node packages/ai/scripts/gen-library-from-decklib.mjs
```

产物：
- `packages/standalone/public/data/deck-library.json`（成品，工具内置牌组库）
- `packages/standalone/public/data/deck-index.json`（牌组码 → 条目索引）
- `packages/standalone/public/data/filter-meta.json`（角色/卡牌筛选元数据）

增量更新流程见仓库内 `docs/decklib-update`（若有）或 `packages/ai/scripts/scrape-today.mjs`。

## 3. 随机牌组池

摆盘器用的随机开局牌组：

```bash
# 生成 AI 牌库先验（从牌组库统计）
node packages/ai/scripts/gen-library.mjs
```

产物：`packages/standalone/public/data/random-decks.json`

## 4. 训练经验种子

```bash
# 先跑 20 局自对弈，更新经验库
node packages/ai/scripts/selfplay.mjs 20
# 进化训练 200 轮，读 learned 数据
node packages/ai/scripts/evolve.mjs 200 learned
# 导出经验种子（可打进 App）
node packages/ai/scripts/gen-experience-seed.mjs
```

产物：`packages/ai/docs/learning.json` → 编译进 `packages/ai/src/data/experience-seed.ts`。

## 5. 版权与使用

- 游戏素材版权归 **miHoYo / HoYoverse**；
- 社区牌组数据版权归**各发布作者**；
- 本仓库不分发上述内容，仅保留获取脚本；使用者需自行承担合规责任；
- 工具本体（代码）按 **AGPL-3.0** 分发。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [BUILD.zh.md](BUILD.zh.md) · [DATA.zh.md](DATA.zh.md)
- [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
