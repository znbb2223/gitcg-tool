# 数据与编码格式

## 1. 牌组分享码

牌组码不是自定义格式，而是**卡牌分享序列号**的编码：

- **33 个槽位**：3 角色 + 30 行动牌，每个槽位 12 bit shareId，压成 25 字节；
- **加校验字节**：追加 1 个 `last` 字节（也会参与混淆）；
- **混淆**：按 2 字节一组交错，整体加上 `last`；
- **Base64**：51 字节编码成 68 个字符。

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
  "title": "刻晴·超绽放",         // 牌组标题
  "author": "某某",              // 作者
  "source": "cardsquare",        // cardsquare / miyoushe / local
  "chars": ["1701", "1502", "1307"], // 3 个角色 id
  "cards": ["332001", ...],      // 30 张行动牌 id
  "games": 128,                  // 统计对局数
  "wins": 76,                    // 统计胜场
  "winRate": 0.594,              // 胜率
  "tags": ["超绽放", "刻晴"],     // 流派 / 标签
  "playstyle": ["起手", "前中期", "..."], // 五段打法
  "updatedAt": "2026-10-01T12:00:00Z" // 更新时间
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

`gi-tcg-ai-learning-v1`（localStorage）：合并后的经验，结构同下。
（旧版本用过 `gi-tcg-ai-experience`，读取时会做兼容迁移。）

### 训练器导出包

```jsonc
{
  "format": "gi-tcg-ai-experience-bundle", // 固定格式标识
  "version": 1,                              // 数据版本
  "games": 12345,                            // 总对局数
  "decks": {                                 // 按牌组指纹统计
    "<指纹>": { "games": 30, "wins": 18, "characters": ["1701"], "cards": ["332001"] } // 该牌组战绩
  },
  "characters": { "1701": { "games": 120, "wins": 70 } }, // 角色胜率统计
  "cards": { "332001": { "games": 200, "wins": 110 } }    // 单卡胜率统计
}
```

导入规则：**按对局数合并**（`games` 相加、`wins` 相加），不覆盖本地。

## 4. 存档与设置

| key | 说明 |
|---|---|
| `gitcg.mainOrientation` | `"portrait"` / `"landscape"`（默认竖屏） |
| `gitcg.gameLayout` | `"classic"` / `"stretch"` / `"anchor"`（默认锚点） |
| `gitcg.shareQuality` | `"compact"` / `"lossless"`（牌组图画质） |
| `gi-tcg-user-decks-v1` | 用户牌组（组牌器 / 实验室自建，JSON 数组） |
| `gi-tcg-deckbuilder-legal-check-v1` | 组牌器合法性检查开关 |
| `gi-tcg-deck-train-v1` | 组牌器本地训练样本 |
| `gi-tcg-lab-state-v1` | 实验室参数（对局数、线程、预算）与结果 |
| `gi-tcg-editor-resume` / `gi-tcg-editor-draft-v1` | 摆盘器草稿与续接（含 sessionStorage） |
| `gi-tcg-start-snapshot` / `gi-tcg-board-snapshot` | 开局快照与局面快照 |
| `gi-tcg-counter-overrides-v1` | 克制关系人工覆盖 |
| `gi-tcg-ai-learning-v1` / `gi-tcg-ai-memory-v1` / `gi-tcg-ai-game-log-v1` | AI 经验 / 决策记忆 / 对局日志 |
| `gitcg.ai.flags` | AI 组件开关（DMC、策略网等） |

换机、清缓存前先导出：设置面板 →「AI 数据备份 / 牌组库备份」，见 [SETTINGS.zh.md](./SETTINGS.zh.md)。

## 5. 卡牌数据

`packages/data/src` 由官方数据生成，包含：

- 角色（id、元素、武器、生命、技能）；
- 行动牌（类型、费用、效果描述、可用性条件）；
- 状态与召唤物定义；
- 实体定义与事件。

数据更新走 `packages/data-code-analyzer`（解析官方数据文件后生成 TS）。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
