# 开发资料包（打进 APK 的 assets/dev-docs/）

本目录面向想接手开发的人或 AI：

| 文件 | 内容 |
|---|---|
| handoff.md | 完整交接：版本体系、机制说明、历史修复、已知坑 |
| guide.md | 项目攻略：目录坐标、打包 SOP、布局参数、AI 系统、验收清单 |
| build.md | 构建速查：命令、顺序、环境、关键坑 |
| changelog.txt | 各版本改动一览（0.11.139 起） |
| decklib-update.md | 牌组库抓取/更新全流程：每日增量、断点、跑局、入库、AI 经验 |
| decklib-data.md | 牌组库数据结构与训练说明 |

## 快速开始
1. 源码见 https://github.com/gi-tcg/genius-invokation （AGPL-3.0）
2. 本工具是在其上做的离线资源镜像 + 20:9 手游化布局 + 安卓壳 + 多线程 AI + 中文工具链
3. 从 handoff.md 的「版本体系」和 build.md 开始读
4. 修改后按 AGPL-3.0 分发：改动的源码必须同样开源
