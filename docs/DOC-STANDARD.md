# 文档规范与自检

这页是给写文档的人（和 AI）看的硬规则。起因：牌组图、设置面板曾经只有零散一句话，
UI 规范只有 82 行，读者要翻半天还不确定是否最新。**宁可多写一步怎么验证，也不要只给结论。**

> 相关：[README.md](./README.md)（文档索引）· [TESTING.zh.md](./TESTING.zh.md)（验收方法）·
> [BUILD.zh.md](./BUILD.zh.md)（构建/环境）

---

## 1. 每篇文档必须具备的 6 块

| 块 | 要求 |
|---|---|
| 定位 | 开头一句话说清“解决什么问题、写给谁” |
| 前置 | 需要什么环境/版本/文件；没有就写“无” |
| 步骤 | 可复现的命令、路径、入口按钮名（不要写“点一下那里”） |
| 事实 | 版本号、存储键、文件路径、数字，全部与代码/实际数据一致 |
| 验收 | 怎么确认做对了（命令输出、尺寸、截图、文件位置） |
| 关联 | 文末“相关文档”，至少 2 条互链 |

记录类文档（`artifacts/`、`docs/BACKUP-SERVER-*.md`、`docs/AI实验交接-*.md`）可以不带“验收”，
但必须在标题下注明**日期与版本**，并说明“这是历史记录，不代表当前行为”。

## 2. 事实怎么写

- **路径要能 `ls` 到**：写 `packages/standalone/src/share-image.ts` 之前先确认存在；
- **命令要能跑**：`pnpm --filter @gi-tcg/xxx build` 的包名必须在 `package.json` 里；
- **键名照抄代码**：`localStorage` 键从源码 `grep` 出来，不要凭记忆（曾经把 `gitcg.gameLayout` 写成 `gitcg.layoutMode`）；
- **数字要有出处**：局数、牌组数、体积写成“来自 `xxx` 的实测值”，不要写“大概”；
- **版本写全**：`0.11.158 / versionCode 279 / 数据 7.2.0`，只写一半会误导。

## 3. 禁止事项

1. 只写结论、不写做法（“支持导出牌组图”而没有入口/规格/成图位置）；
2. 复制旧文档的片段不核对（死链、旧键名、旧路径大多是这样来的）；
3. 代码块不闭合、行内代码当标题用；
4. 链接指向不存在的文件（本仓库有自检脚本，见第 5 节）；
5. 用“最新 / 目前大概 / 应该”这类无法核对的措辞；
6. 把设置项、输出格式、命令改了却不更新文档。

## 4. 改动触发文档更新

| 改了什么 | 必须同步 |
|---|---|
| 设置项 / 默认值 / 存储键 | [SETTINGS.zh.md](./SETTINGS.zh.md)、[SECURITY.md](../SECURITY.md)、[DATA.zh.md](./DATA.zh.md) |
| 牌组图版式 / 体积 | [DECK-IMAGE.zh.md](./DECK-IMAGE.zh.md) |
| 对局布局 / 方向 | [UI.zh.md](./UI.zh.md) |
| 构建顺序 / 依赖版本 | [BUILD.zh.md](./BUILD.zh.md)、[AGENTS.md](../AGENTS.md) |
| 已知 BUG 修复/新增 | [KNOWN-ISSUES.zh.md](./KNOWN-ISSUES.zh.md) |
| 版本号 / 数据版本 | README、[CHANGELOG.md](../CHANGELOG.md)、[MAINTENANCE.zh.md](./MAINTENANCE.zh.md) |

## 5. 自检命令

```bash
# 围栏配对 + 相对链接是否指向真实文件（退出码 0 才算过）
python3 scripts/check-docs.py

# 顺手核对：文档里提到的键名是否还在代码里
grep -o 'gitcg\.[a-zA-Z.]*' docs/*.md | sort -u
grep -rhoE '"(gitcg|gi-tcg)[A-Za-z0-9_.:-]+"' packages/standalone --include=*.ts --include=*.html | sort -u

# 文档里代码块必须是成对的三反引号（脚本已覆盖）
grep -c '^```' docs/*.md
```

## 6. 提交前清单

- [ ] `python3 scripts/check-docs.py` 通过
- [ ] 新增/改动的路径、命令、键名都实际验证过
- [ ] 文末“相关文档”已互链（新文档要在 `docs/README.md` 与根 `README.md` 的文档表里出现）
- [ ] 涉及设置的，同步了 [SETTINGS.zh.md](./SETTINGS.zh.md)
- [ ] 涉及输出文件（牌组图、备份、日志）的，写清保存路径
- [ ] 归档类文档标了日期与“历史记录”字样

## 7. 文档分级

| 级别 | 例子 | 要求 |
|---|---|---|
| 教程 | USER-GUIDE、INSTALL | 从零能走通，含截图/入口名 |
| 参考 | UI、SETTINGS、DECK-IMAGE、DATA | 数字/键名/路径必须精确，给验收方法 |
| 过程记录 | DEVLOG、artifacts/*、AI实验交接 | 允许过时，但要标日期与“记录”性质 |
| 索引 | docs/README、README 文档表 | 每条一句话说明，链接有效 |
