# 数据与编码格式

## 1. 牌组分享码

牌组码不是自定义格式，而是**卡牌分享序列号**的编码：

```
33 个 shareId（每个 12 bit，压成 25 字节）
  → 加 1 个校验字节（last）
  → 按 2 字节一组交错、整体 + last 混淆
  → 51 字节 → Base64
```

- 33 个槽位 = 3 个角色 + 30 张行动牌（顺序有意义，先角色后行动牌）；
- `shareId ↔ 卡牌 id` 通过 `shareIdMap` 映射；
- 编码时会尝试 `last` 值，避开 `BLOCK_WORDS` 黑名单（避免出现敏感词片段）。

实现：`packages/assets-manager/src/sharing.ts`（`encodeRaw` / `decodeRaw`）。

> ⚠️ **踩坑**：牌组码对卡牌顺序敏感。同一套牌如果角色/行动牌排序不同，
> 编码结果不同（但解码后是同一套牌）。所以跨页传参、做索引时**不要用牌组码当键**，
> 用牌组库条目 `id` 或「指纹」（排序后的规范码）。

## 2. 牌组库条目

`packages/standalone/public/data/deck-library.json`（不入库，自行生成）：

```jsonc
{
  "id": "cs-12345",              // 稳定 id，跨页传参用这个
  "code": "AXBQ...",             // 原始分享码（顺序可能与规范码不同）
  "title": "刻晴·超绽放",
  "author": "某某",
  "source": "cardsquare",        // cardsquare / miyoushe / local
  "chars": ["1701", "1502", "1307"],
  "cards": ["332001", ...],
  "games": 128,
  "wins": 76,
  "winRate": 0.594,
  "tags": ["超绽放", "刻晴"],
  "playstyle": ["起手", "前中期", "..."], // 五段打法
  "updatedAt": "2026-10-01T12:00:00Z"
}
```

配套文件：

| 文件 | 作用 |
|---|---|
| `deck-index.json` | `id → 条目` 索引，深链接用 |
| `filter-meta.json` | 角色/卡牌筛选元数据（哪些角色配哪些牌） |
| `random-decks.json` | 摆盘器随机开局牌组池 |

「指纹」= 角色与行动牌按 id 排序后重新编码的规范码，用于判定「是不是同一套牌」。

## 3. AI 经验

### 种子（编译进包）

`packages/ai/src/data/experience-seed.ts` —— 手机端首次启动即可用的经验。

### 运行时

`gi-tcg-ai-experience`（localStorage）：合并后的经验，结构同下。

### 训练器导出包

```jsonc
{
  "format": "gi-tcg-ai-experience-bundle",
  "version": 1,
  "games": 12345,
  "decks": {
    "<指纹>": { "games": 30, "wins": 18, "characters": ["1701"], "cards": ["332001"] }
  },
  "characters": { "1701": { "games": 120, "wins": 70 } },
  "cards": { "332001": { "games": 200, "wins": 110 } }
}
```

导入规则：**按对局数合并**（`games` 相加、`wins` 相加），不覆盖本地。

## 4. 存档与设置

| key | 说明 |
|---|---|
| `gitcg.mainOrientation` | `"portrait"` / `"landscape"` / `"auto"` |
| `gitcg.layoutMode` | `"classic"` / `"stretch"` / `"anchor"` |
| `gitcg.deckLibrary.favorites` | 收藏的牌组 id 列表 |
| `gitcg.deckLibrary.local` | 本地训练样本 |
| `gitcg.lab.settings` | 实验室参数（对局数、线程、预算） |
| `gitcg-editor-resume` | 从对局返回摆盘器时用（sessionStorage） |

## 5. 卡牌数据

`packages/data/src` 由官方数据生成，包含：

- 角色（id、元素、武器、生命、技能）；
- 行动牌（类型、费用、效果描述、可用性条件）；
- 状态与召唤物定义；
- 实体定义与事件。

数据更新走 `packages/data-code-analyzer`（解析官方数据文件后生成 TS）。
