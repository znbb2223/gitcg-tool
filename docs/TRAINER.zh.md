# AI 训练器

电脑端（Node 20+）多线程自我对弈，跑出来的经验可以导回手机。

## 1. 为什么单独做

手机上的 AI 受 CPU 与散热限制，搜索预算和进化轮数都小。训练器把同样一套
AI 放到电脑上跑几千局，再把「经验」这个轻量结果带回手机。

## 2. 设计

```
trainer.mjs              交互式主程序（菜单 1-9）
  ├─ loadLearning()      种子 → learning.json 合并
  ├─ runBatch()          worker_threads 并行跑 N 局
  ├─ saveLearning()      原子写盘 + 校验
  └─ exportBundle()      导出手机可导入的 JSON
worker.mjs               单个 worker：跑局、回报进度、算增量
  ├─ playAi()            AI 自对弈（学习模式）
  ├─ playLibrary()       打牌组库里的真实牌组（随机对手）
  └─ deltaOf()           每局统计的角色/卡牌/牌组胜率增量
```

关键点：

- **worker_threads 而不是 spawn**：早期用子进程，Windows 下退出事件不触发，
  日志停在第一批；线程版能可靠上报进度。
- **增量而不是重算**：worker 只回传本批的 delta，主进程合并进总经验；
  避免每批重算全量。
- **原子落盘**：写 `learning.json.tmp` → rename → 读回校验，程序崩了也不会写坏。
- **模式**（`mode`）：`both` / `learned` / `random`；`both` 时按 `half` 分配
  AI 对局与牌库对局。

## 3. 使用

```bash
cd trainer
node trainer.mjs
```

菜单（输入数字）：

| 序号 | 功能 |
|---|---|
| 1 | 开始训练（按当前配置跑） |
| 2 | 设置每批局数 |
| 3 | 设置总批数（0 = 无限） |
| 4 | 切换模式（both / learned / random） |
| 5 | 设置线程数 |
| 6 | 设置搜索预算（ms） |
| 7 | 导出经验包（`gitcg-trained-ai-*.json`） |
| 8 | 查看当前经验统计 |
| 9 | 退出 |

训练中按 **S** 软停止（跑完当前批再停）。

配置文件 `config.json`：

```json
{
  "batch": 100,
  "total": 0,
  "mode": "both",
  "information": "fair",
  "useSearch": true,
  "searchBudgetMs": 300,
  "seed": 20260101,
  "seedFile": "",
  "deckPool": "both",
  "workers": 12
}
```

## 4. 经验包与回灌

导出的结构（手机端「设置 → 导入 AI 数据」可识别）：

```json
{
  "format": "gi-tcg-ai-experience-bundle",
  "version": 1,
  "games": 12345,
  "decks": { "<deckcode>": { "games": 30, "wins": 18, "characters": [...], "cards": [...] } },
  "characters": { "<id>": { "games": 120, "wins": 70 } },
  "cards": { "<id>": { "games": 200, "wins": 110 } }
}
```

导入时**按对局数合并**（`games` 相加、胜场相加），不会覆盖手机已有经验。

## 5. 数据规模参考

- 牌组池：4,557 套（`app/data/deck-library.json`，需自行生成）；
- 初始种子：69,515 局（与手机同源）；
- 12 线程 / 300ms 搜索：约 100 局/批，几分钟一批（视机器而定）。


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md)
- [TESTING.zh.md](TESTING.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
