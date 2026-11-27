# 术语表

## 对局

| 术语 | 含义 |
|---|---|
| 行动牌 | 手牌中的卡（事件牌、装备、支援等），一副 30 张 |
| 角色牌 | 出战角色，一副 3 个 |
| 元素骰 | 每回合的行动资源，8 个起，分元素色 |
| 调谐 | 把不需要的骰子换成万能骰 |
| 元素反应 | 两种元素叠加触发的效果（蒸发、超载、冻结等） |
| 召唤物 / 支援 | 场上的持续效果单位 |
| 回合 | 双方各行动若干次为一轮，一轮结束后进入下一回合 |

## 工具里的名词

| 术语 | 含义 |
|---|---|
| 牌组码 / 分享码 | 官方的牌组分享字符串（51 字节 Base64） |
| 指纹 | 角色与卡牌按 id 排序后的规范码，用来判断「是不是同一套牌」 |
| 摆盘器 | 自由编辑对局初始局面的工具（手牌、骰子、位置） |
| 摆盘完成页 | 摆盘器里摆好局面后进入对局前的确认页 |
| 克制推演 / 实验室 | 用 AI 跑候选牌组，找出能打赢目标牌组的那套 |
| 胜率 | 自我对弈统计的胜率，不代表人类环境 |
| 经验种子 | 编译进包里的初始 AI 经验（默认 69,515 局） |
| 经验包 | 训练器导出的 `gitcg-trained-ai-*.json` |
| 决策记忆 | AI 记住「这个局面上次选了哪手」，复用省时间 |
| 信息优势（fair / advantage） | AI 是否能看到非公开信息；默认 fair |
| 搜索预算 | 每步最多思考多少毫秒，直接决定强度与耗时 |
| 锚点布局 | 非 20:9 屏幕下的元素定位方案 |
| 20:9 经典布局 | 0.11.121 的等比布局，20:9 屏幕固定使用 |


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [INSTALL.zh.md](INSTALL.zh.md) · [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md)
- [PITFALLS.zh.md](PITFALLS.zh.md) · [README.md](README.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
- [MAINTENANCE.zh.md](../docs/MAINTENANCE.zh.md) · [牌组码工具](../tools/deckcode/README.md) · [文档中心](../docs/README.md)
