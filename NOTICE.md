# 来源与许可说明

## 上游项目

本项目基于开源项目 **gi-tcg / genius-invokation**（作者 piovium 及贡献者）二次开发：

- 源码：https://github.com/piovium/genius-invokation
- 许可：**AGPL-3.0**（见 LICENSE）

我们在此基础上做了离线化改造、20:9 手游布局适配、安卓壳封装、中文工具页面、
牌组库与实验室功能、AI 训练器等改动，同样以 **AGPL-3.0** 分发。

## 美术素材

游戏内卡面、角色立绘、元素骰图标、界面底图等美术资源版权归 **miHoYo / HoYoverse** 所有。
为保证合规，本仓库**不包含**这些素材（`packages/standalone/public/assets-local/` 已忽略），
仅用于本地学习与交流；自行构建时请按上游脚本获取，或使用自己合法持有的资源。

## 第三方数据

牌组库中的社区牌组数据整理自公开牌组广场与米游社，版权归原作者所有，本仓库不包含
（`packages/standalone/public/data/` 已忽略），可用仓库内 `packages/ai/scripts/` 下脚本重新抓取。
