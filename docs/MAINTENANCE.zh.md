# 维护与数据更新（7.2.0 → 7.3.0）

> **状态：短期不再更新。**
> 本仓库当前只包含 **7.2.0** 的卡牌数据；作者接下来一段时间不打算继续跟进版本。
> 如果原神官方或上游「雨酱牌」更新到 7.3.0，需要由使用者自己把数据合并进来。
> 本文把两条路线写到可照着做的程度：**上游已更新** 与 **上游没更新、自己补**。

---

## 一、先弄清楚：哪些东西是“数据”

| 内容 | 位置 | 作用 |
|---|---|---|
| 卡牌/角色定义 | `packages/data/src/cards/**/*.gts`、`packages/data/src/characters/**/*.gts` | 规则、技能、费用、标签 |
| 数据版本 | `packages/data/package.json` 的 `version`（如 `0.21.0+gi-7-2-0`） | 解析成 `v7.2.0`，界面显示“数据版本” |
| 版本白名单 | `packages/core/src/base/version.ts` 的 `VERSIONS` | 引擎只认列表里的版本 |
| 名字/卡面/官方文本 | `packages/assets-manager/src/data/{CHS,EN,...}/` | 名称、`shareId`、描述、卡图 |
| 离线资源 | `packages/standalone/public/assets-local/` | 打包进 APK 的卡图与数据 |
| 牌组码映射 | `tools/deckcode/deckcode.sh` 里的 `TABLE` | `id \| shareId \| 中文名` |
| 牌组库 | `packages/standalone/public/data/deck-library.json` | 4,557 套社区牌组快照 |
| 筛选项 | `packages/standalone/public/data/filter-meta.json` | 角色/元素/费用筛选表 |

> 只改界面、不改数据，不需要动 `packages/data`；
> 只加一张卡，也必须同时改 **定义 + 版本 + 名字 + 牌组码表**，否则会出现“能打出但查不到/不能编进牌组码”。

---

## 二、路线 A：上游「雨酱牌」已经更新到 7.3.0

适用：上游仓库已经合并了 7.3.0 的卡牌定义与资源，你只需要同步过来。

### A1. 同步 core 的版本白名单

```bash
# 打开版本列表
vim packages/core/src/base/version.ts
# 在 VERSIONS 数组末尾追加 7.3.0（顺序必须从旧到新）
# "v7.2.0",
# "v7.3.0",
```

```ts
// 文件：packages/core/src/base/version.ts
// 引擎只接受这里列出的版本号
export const VERSIONS = [
  // ...旧版本
  "v7.2.0", // 当前仓库数据版本
  "v7.3.0", // 新增：上游 7.3.0
];
```

### A2. 拉取官方资源（名字、shareId、卡面、描述）

```bash
# 安装依赖（首次）
pnpm install
# 从官方 API 重新抓 CHS/EN 等数据到 src/data
pnpm --filter @gi-tcg/assets-manager build:data
# 检查是否出现 7.3.0 的新条目
grep -c '"sinceVersion": "v7.3.0"' packages/assets-manager/src/data/CHS/entities.json
```

- 这一步会更新 `names.json`、`entities.json`、`characters.json`；
- 抓取脚本在 `packages/assets-manager/scripts/fetch.ts`，需要能访问官方 API；
- 如果抓取失败，就手动把上游仓库的 `src/data/CHS/*` 覆盖过来。

### A3. 同步卡牌与角色定义

```bash
# 用上游仓库覆盖卡牌定义（保留本仓库的本地改动）
rsync -av --exclude node_modules \
  /path/to/upstream/packages/data/src/ \
  packages/data/src/
# 同步角色定义
rsync -av /path/to/upstream/packages/data/src/characters/ \
  packages/data/src/characters/
```

重点检查：
- 新卡文件里的 `@id` 是否与 `entities.json` 的 `id` 一致；
- `since "v7.3.0"` 是否写对；
- 旧卡是否被上游改动（技能数值、费用），不要只加新卡。

### A4. 改数据版本号

```jsonc
// 文件：packages/data/package.json
{
  // 版本号格式：<包版本>+gi-<主>-<次>-<修订>
  // 必须与 core 的 VERSIONS 最后一项一致，否则生成脚本会直接报错
  "version": "0.21.0+gi-7-3-0"
}
```

> 生成器会解析 `gi-7-3-0` 为 `v7.3.0`，并与 `VERSIONS.at(-1)` 比对；
> 不一致会抛 `New version ... does not match ...`。

### A5. 重新生成 + 静态检查

```bash
# 重新生成 index.ts 的 import 列表、卡牌测试等
pnpm --filter @gi-tcg/data regenerate_data
# TypeScript / GTS 类型检查
pnpm --filter @gi-tcg/data check
# 跑数据包测试
pnpm --filter @gi-tcg/data test
```

### A6. 更新牌组码映射表

`tools/deckcode/deckcode.sh` 顶部的 `TABLE` 是手写的三列：`id|shareId|中文名`。

```text
# 格式：卡牌/角色 id | shareId | 中文名
321020|123456|赤王陵
```

新增卡时：
1. 从 `packages/assets-manager/src/data/CHS/entities.json` 找 `id` 与 `shareId`；
2. 在 `TABLE` 里按 id 排序插入一行；
3. 四个版本都要同步：
   - `deckcode.sh`（sh）
   - `deckcode.bat`（纯 cmd，名字是 `\uXXXX`）
   - `deckcode-windows.bat`
   - `deckcode.html`

> 漏改的后果：牌组码能解码出 id，但工具查不到名字，或编码时提示未知 shareId。

### A7. 牌组库与筛选项（可选）

`deck-library.json` / `filter-meta.json` 是社区牌组快照，不随卡牌数据自动更新。
如果上游给了新快照，直接覆盖；没有就保留旧快照，只影响“牌组库”页的样例，不影响对局。

### A8. 构建与回归

```bash
# 构建 Web 产物
pnpm --filter @gi-tcg/standalone build
# 打包 APK（详细步骤见 BUILD.zh.md）
bash android/build.sh
# 本地起静态服务，浏览器验收
python3 -m http.server 8899 -d packages/standalone/dist
```

验收清单：
- [ ] 新角色能选、能出战、技能能放；
- [ ] 新卡能加入牌组、费用/标签正确；
- [ ] 牌组码能编码/解码新卡；
- [ ] 旧对局日志还能回放；
- [ ] 关于页显示“数据版本 7.3.0”。

---

## 三、路线 B：上游没更新，自己按机制补

适用：雨酱牌没跟进 7.3.0，但你想先把这个版本跑起来。
核心思路：**从模拟器的机制代码反推卡牌定义**，而不是凭空写文案。

### B1. 先拿到“官方事实”

至少准备三样：
1. 官方卡面/卡牌 ID（`shareId`）；
2. 官方中文描述（逐字，包括“打出时/行动阶段开始时/可用次数”）；
3. 同类旧卡的实现（最重要）。

```bash
# 找同类旧卡：按关键词搜描述
grep -rn "费用增加" packages/data/src/cards | head
# 找同角色/同类型实现
ls packages/data/src/cards/support/
# 看引擎提供了哪些 DSL
ls packages/core/src/base/
```

### B2. 读引擎 DSL，不要自创 API

卡牌定义使用 GTS（`*.gts`），常用入口：

| DSL | 用途 | 例子 |
|---|---|---|
| `$` | 声明技能/效果 | `$`(...) |
| `DamageType` | 伤害类型 | `DamageType.Piercing` |
| `DiceType` | 骰子类型 | `DiceType.Same` |
| `EquipmentCard` / `SupportCard` / `EventCard` | 卡牌基类 | 见同目录旧卡 |
| `Character` | 角色基类 | `packages/data/src/characters/` |
| `query` / `modifier` | 查询与修正 | 见 `packages/core/src/base/` |

> 先复制一张机制最接近的旧卡，改 id、名字、数值、`since`；
> 不要从零写，GTS 的隐式规则很多，照抄再改最稳。

### B3. 写一张新卡（最小示例）

```ts
// 文件：packages/data/src/cards/support/place.gts
// 新增一张 0 费场地：行动阶段开始给敌方随机手牌加费
import { $, DiceType } from "@gi-tcg/core/data";

/**
 * 示例卡：噩梦的预兆（7.2.0 已有，仅作写法参考）
 * @id 321041
 * @cost 0
 * @tags GCG_TAG_PLACE
 * @since v7.3.0
 */
export const NightmareOmen = {
  // 卡牌类型：场地
  type: "support",
  // 子类型：场地
  supportType: "place",
  // 费用：0
  cost: [],
  // 行动阶段开始时触发
  onActionPhaseStart: $((c) => {
    // 给敌方随机 1 张手牌加费
    c.giveCostIncrease(c.opponent.hand.random(), 1);
  }),
};
```

> 上面是**结构示意**，真实字段以同目录旧卡为准；
> 不要直接复制进仓库，先对照 `place.gts` 里 `NightmareOmen` 的实现。

### B4. 注册与生成

```bash
# 新文件放进对应目录后，重新生成 import 列表
pnpm --filter @gi-tcg/data regenerate_data
# 检查语法/类型
pnpm --filter @gi-tcg/data check
```

`regenerate_data` 会扫描目录、生成 `packages/data/src/index.ts` 的 import；
**不要手改 `index.ts`**（文件头写着 DO NOT EDIT）。

### B5. 补名字、shareId、牌组码

1. 在 `entities.json` / `names.json` 加条目（或跑 A2 抓取）；
2. 在 `tools/deckcode/*` 的 `TABLE` 加 `id|shareId|中文名`；
3. 如果新卡有衍生牌（如“生效中”状态），也要给衍生牌分配 id 并加进 `TABLE`。

### B6. 写测试，别只靠肉眼

```bash
# 数据包自带测试
pnpm --filter @gi-tcg/data test
# 引擎测试（如果改了 core）
pnpm --filter @gi-tcg/core test
```

测试至少覆盖：
- 费用与标签；
- 触发时机（打出/行动阶段开始/结束阶段）；
- 目标选择（随机/最高费/敌方出战）；
- 衍生牌是否正确生成/弃置。

### B7. 让 AI 帮忙时的正确姿势

不要把“帮我加一张 7.3.0 新卡”直接丢给 AI，信息不够会瞎编。按这个模板给：

```text
你是 gi-tcg 的卡牌实现助手。
引擎 DSL 在 packages/core/src/base/，卡牌样例在 packages/data/src/cards/support/place.gts。
这是新卡官方描述（原文）：<粘贴>
这是最接近的旧卡实现：<粘贴代码>
请：
1) 先指出需要哪些 DSL/事件钩子；
2) 再给完整 .gts 文件；
3) 列出需要同步的 names/entities/TABLE 条目；
4) 给出 3 条测试用例。
不要修改 index.ts；不要发明不存在的 API。
```

验收 AI 产出：
- `pnpm --filter @gi-tcg/data check` 必须过；
- 能在模拟器里实际打出一次；
- 牌组码能编码/解码；
- 旧卡回归测试不挂。

---

## 四、已知 BUG（截至 7.2.0）

### BUG 1：模拟器“先手/后手牌组”名不副实

- 位置：模拟器 → 对局配置 → “先手牌组 / 后手牌组”两个输入框；
- 现象：这两个框实际控制的是 **人机（玩家）牌组** 与 **AI 牌组**，不是真正的先手/后手；
- 影响：想测“同一牌组先后手”时会发现牌组对不上；
- 规避：按“我方牌组 / AI 牌组”理解，或进对局后用摆盘器改；
- 修复方向：改字段名与绑定（`humanDeck` / `aiDeck`），不要只改 UI 文案。

### BUG 2：组牌器竖屏，卡牌右下角放大镜失效

- 位置：组牌器 → 竖屏 → 卡牌右下角 🔍；
- 现象：点击无反应，无法查看大图；
- 影响：竖屏下只能看缩略图；
- 规避：横屏，或进卡组实验室看牌组图；
- 修复方向：检查竖屏布局下按钮的点击区域是否被卡面容器覆盖。

> 这两条是**已知问题**，不是“待办承诺”；短期不更新期间不会修。

---

## 五、牌组码工具（重点）

README 首页那张“整活牌组图”（3 个相同角色 + 30 张相同卡）不是正常牌组，
是用 [`tools/deckcode/`](../tools/deckcode/README.md) 生成的非常规牌组码。

| 文件 | 平台 | 特点 |
|---|---|---|
| `deckcode.sh` | Android sh / Termux / dash / mksh | 零外部命令 |
| `deckcode.bat` | 纯 cmd（Winlator / Wine） | 只用 cmd 内建 |
| `deckcode-windows.bat` | Windows 10/11 | certutil + cscript |
| `deckcode.html` | 浏览器 | 可编辑 33 槽，最直观 |

用法（sh 版）：

```bash
# 进入工具目录
cd tools/deckcode
# 运行菜单：2) 编码 33 个 ID
./deckcode.sh
# 选 4) 可生成“3 个同角色 + 30 张同卡”的整活码
```

注意：
- 牌组码固定 **33 槽 = 3 角色 + 30 行动牌**；
- 同名卡正常最多 2 张、角色不能重复；整活码属于**非常手段**，正式对局可能被拒绝；
- 改了卡牌数据后，记得同步 `TABLE`，否则新卡查不到名字。

---

## 六、最短验收流程（照着打勾）

- [ ] `packages/core/src/base/version.ts` 有 `v7.3.0`；
- [ ] `packages/data/package.json` 是 `0.21.0+gi-7-3-0`；
- [ ] `pnpm --filter @gi-tcg/data regenerate_data` 成功；
- [ ] `pnpm --filter @gi-tcg/data check` 成功；
- [ ] `pnpm --filter @gi-tcg/data test` 成功；
- [ ] 新卡在模拟器能打出；
- [ ] 牌组码能编码/解码新卡；
- [ ] 关于页显示 7.3.0；
- [ ] APK 能装、能离线打开。

---

## 相关文档

- [BUILD.zh.md](BUILD.zh.md) · [DATA.zh.md](DATA.zh.md) · [ARCHITECTURE.zh.md](ARCHITECTURE.zh.md) · [TESTING.zh.md](TESTING.zh.md)
- [KNOWN-ISSUES.zh.md](KNOWN-ISSUES.zh.md) · [AI.zh.md](AI.zh.md) · [文档中心](README.md) · [项目首页](../README.md)
