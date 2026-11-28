<div align="center">

# 文档中心

**使用 · 开发 · AI · 数据 · 上游资料**

[首页](../README.md) · [用户指南](./USER-GUIDE.zh.md) · [安装](./INSTALL.zh.md) · [术语表](./GLOSSARY.zh.md) · [AI 详解](./AI-实现详解.zh.md) · [项目总总结](../artifacts/项目总总结-2026-11-28.md)

</div>

> 状态：2026-11-28 收尾。**当前只含 7.2.0 数据，短期不再更新**；版本合并见 [MAINTENANCE.zh.md](./MAINTENANCE.zh.md)。

> **致谢**：规则引擎与卡牌数据来自
> [piovium/genius-invokation](https://github.com/piovium/genius-invokation)（AGPL-3.0，即「雨酱牌」）；
> 主要开发、实验编排、训练、文档与工具链由 **DSH（DeepSeek Harness）** 完成。

## 一、给使用者

| 文档 | 内容 |
|---|---|
| [../README.md](../README.md) | 项目介绍、功能、快速开始、FAQ |
| [../CHANGELOG.md](../CHANGELOG.md) | 版本更新日志 |
| [../SECURITY.md](../SECURITY.md) | 零权限 / 不联网 / 数据存哪 |
| [USER-GUIDE.zh.md](./USER-GUIDE.zh.md) | 带图新手指南 |
| [INSTALL.zh.md](./INSTALL.zh.md) | 安装与系统要求 |
| [GLOSSARY.zh.md](./GLOSSARY.zh.md) | 术语表 |
| [SETTINGS.zh.md](./SETTINGS.zh.md) | **设置面板**：5 个设置项的选项、默认值、存储键与生效时机 |
| [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md) | **牌组图**：从哪生成、输出规格、实现位置、怎么改 |

## 二、给开发者

| 文档 | 内容 |
|---|---|
| [DOC-STANDARD.md](./DOC-STANDARD.md) | **文档规范与自检**：必备结构、事实核对、`scripts/check-docs.py` |
| [FACTS.md](./FACTS.md) | **关键数字核对表**：牌组数/体积/种子/战绩/代码常量 + 校验命令 |
| [ARCHITECTURE.zh.md](./ARCHITECTURE.zh.md) | 包结构、对局数据流、布局三态、安卓壳、AI 结构 |
| [BUILD.zh.md](./BUILD.zh.md) | 构建顺序、产物整理、APK 打包、版本号、失败对照 |
| [MAINTENANCE.zh.md](./MAINTENANCE.zh.md) | **7.2.0 → 7.3.0 数据合并**、上游没更新时怎么自己补、已知 BUG、牌组码工具 |
| [BACKUP-SERVER-2026-11.md](./BACKUP-SERVER-2026-11.md) | 云服务器释放前的完整 DMC 样本与实验日志备份 |
| [DEVLOG.zh.md](./DEVLOG.zh.md) | 逐版本迭代记录（现象 → 根因 → 修法） |
| [PITFALLS.zh.md](./PITFALLS.zh.md) | 24 条踩坑清单 |
| [TESTING.zh.md](./TESTING.zh.md) | 截图 / DOM 尺寸 / 像素采样 / AI 自对弈验收 |
| [DATA.zh.md](./DATA.zh.md) | 牌组码编码、牌组库条目、经验包、缓存键 |
| [UI.zh.md](./UI.zh.md) | **界面规范**：色板/字体/组件、对局三态布局与锚点数学、素材、断点、验收 |
| [TRAINER.zh.md](./TRAINER.zh.md) | 训练器设计、菜单、经验导出与回灌 |
| [ASSETS.zh.md](./ASSETS.zh.md) | 卡面 / 数据 / 牌组库抓取 |
| [AI.zh.md](./AI.zh.md) | AI 原理 / 强度 / 旋钮 / 局限 |
| [AI-ROADMAP.zh.md](./AI-ROADMAP.zh.md) | 14 个 AI 组件路线图与门槛 |
| [AI-EXPERIMENTS.zh.md](./AI-EXPERIMENTS.zh.md) | A/B 实验记录、统计门槛、v3 数据格式 |
| [KNOWN-ISSUES.zh.md](./KNOWN-ISSUES.zh.md) | 已知问题与限制 |
| [ROADMAP.zh.md](./ROADMAP.zh.md) | 路线图 |
| [development/](./development/README.md) | 上游维护者的数据与查询引擎文档 |

## 三、上游文档

`docs/development/` 下是 gi-tcg 上游的引擎开发文档（数据生成、Event/Query API、
状态机设计等），改动引擎层前建议先读。


---

## 相关文档

- [DOC-STANDARD.md](DOC-STANDARD.md) · [SETTINGS.zh.md](SETTINGS.zh.md) · [DECK-IMAGE.zh.md](DECK-IMAGE.zh.md) · [AI-EXPERIMENTS.zh.md](AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](AI-实现详解.zh.md) · [AI.zh.md](AI.zh.md)
- [AI实验交接-2026-11-27.md](AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [ASSETS.zh.md](ASSETS.zh.md) · [BUILD.zh.md](BUILD.zh.md)
- [DATA.zh.md](DATA.zh.md) · [DEVLOG.zh.md](DEVLOG.zh.md) · [GLOSSARY.zh.md](GLOSSARY.zh.md) · [INSTALL.zh.md](INSTALL.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [PITFALLS.zh.md](PITFALLS.zh.md) · [ROADMAP.zh.md](ROADMAP.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [TRAINER.zh.md](TRAINER.zh.md) · [UI.zh.md](UI.zh.md) · [USER-GUIDE.zh.md](USER-GUIDE.zh.md) · [README.md](../README.md)
