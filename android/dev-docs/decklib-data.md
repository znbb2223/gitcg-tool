# 牌组库 · 数据与训练说明（0.11.0）

> 目的：记录牌组库的数据来源、训练流程和页面结构，换版本时照着重跑即可。

## 1. 数据来源（都能公开访问，不需要 cookie）

- **官方卡牌广场**：`POST https://api-takumi.mihoyo.com/event/cardsquare/index`
  - 请求体 `{ page_size: 50, next_page_token }`；带 `label_id` 可按分区（常规/热斗/铸境/赛事）拉，池子更大。
  - 无标签列表 1167 条；10 个分区标签轮询后 **4256 条**，解码校验后 **4251 套合法**。
  - 脚本：`packages/ai/scripts/scrape-cardsquare.mjs`（无标签）、`scrape-cardsquare-labels.mjs`（分区），产物 `/tmp/cardsquare-raw*.json`。
- **米游社帖子**：`searchPosts` + `getPostFull`（搜索正文只有 100 字，必须补全文）
  - 脚本：`packages/ai/scripts/scrape-miyoushe.mjs`；30 个关键词 × 6 页 → 192 帖 → 只有 15 套合法（大部分牌组是截图）。
- **本地已有库**：`packages/ai/src/data/deck-library.ts`（1600 套）。
- 合并去重（按 3 角色 + 30 张行动牌指纹）：`scripts/build-catalog.mjs` → `/tmp/deck-catalog.json`，当前 **4544 套**。

## 2. AI 训练（旧经验库已作废）

- `src/data/experience-seed.ts` 已重置为空种子，`docs/learning.json` 删除；训练统计完全重算。
- 训练集：全库 4544 套（`/tmp/deck-catalog-all.json`），最终 34,800 局。
- 脚本：`packages/ai/scripts/train-decklib.mjs <shard> <shards> <games>`
  - 4 分片并发、`nice 10` + 每局 60ms 限速控温，每 300 局写快照并支持断点续训；最终每片 8000 局。
  - 记录每套牌战绩（games/wins/draws）和流派两两对阵（`aggro>midrange` 这类 key），用于算克制关系。
  - 实测单进程约 0.3 局/秒（6 并发合计约 1.8 局/秒）。

## 3. 牌组库数据生成

- 脚本：`packages/ai/scripts/build-decklib.mjs`（读 `/tmp/train-shards`，可传输出路径）
- 输出：`packages/standalone/public/data/deck-library.json`（约 5MB，4544 套）
- 每套字段：`chars`、`cards`、`tags`、`style`（快攻/中速/控制/组合技）、`winRate`、`games`、`counters`、`counteredBy`、`guide`
- 玩法说明按流派骨架生成，塞入这套牌自己的「地基牌」「终结牌」，整体 **169~198 字**（要求 100-200 字），五段：开局 / 中期 / 注意 / 克制它的办法 / 它克制谁。

## 4. 页面

- `packages/standalone/deck-library.html` + `src/deck-library.ts`（原生 TS，无框架）
- 入口：`hub.html` 第 5 张卡「牌组库」（壹贰叁肆伍）
- 筛选：流派 / 标签 / 来源 / 搜索；排序：推荐、胜率、对局数、热度；首屏 80 张 + 滚动追加；详情为全屏抽屉（角色图、行动牌 ×N、五段说明、克制 chip、复制分享码）。
- 验收脚本：`/tmp/decklib-verify.mjs`（Playwright，412×915 DPR2，截图在 `/tmp/decklib-shots/`）。

## 5. 经验接入对局（0.11.0 追加）

- `scripts/gen-priors.mjs`：从训练快照导出 `src/data/experience-priors.ts`（卡牌 300 张 / 角色 98 个，样本 ≥60 局的才收）。
- `evaluate.ts`：`playCard` 加卡牌先验分（权重 `cardPrior`），`switchActive` 加角色先验分（`charPrior`）；`player.ts` 的 `decideSwitchHands` 用先验保住高胜率起手牌。
- 权重必须小：2.2/1.6 时 40 局镜像 15:25（明显变弱），0.6/0.4 时 24:15 才启用。
