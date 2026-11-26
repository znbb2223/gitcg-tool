# 七圣召唤工具 · 新会话交接文档

> 目的：换新会话继续做「锚点偏移布局」。本文档记录当前进度、构建方式、已知问题根因、下一步精确改动点。

---

## 一、当前版本状态

| 项目 | 值 |
|---|---|
| 最新已安装版本 | **0.11.153**（versionCode 271） |
| 最新构建产物 | `/root/workspace/gitcg-lab/build/gitcg.apk` |
| 已交付 APK | `/sdcard/Download/gitcg-0.11.153.apk`（+ DSH-Go 目录同份） |
| 最新备份 | `art/backup-0.11.152.apk`（+ 0.11.151~0.11.139） |
| 数据版本 | 7.2.0 |

### 三种布局模式（设置 → 对局界面布局）
1. **20:9 等比**（原 122 方案）✅ 可用：等比 contain，留边用背景图填充
2. **20:9 拉伸填充** ✅ 可用：先按 20:9 满宽渲染，再只把 Y 拉到屏幕高（0.11.136/137 修好，四边木框完整）
3. **锚点居中/偏移** ✅ 完成：4 个比例（16:9 / 16:10 / 3:2 / 19.5:9）实测通过（第四节），待打包 APK

---

## 二、代码位置

```
/root/workspace/gi-tcg/                    pnpm monorepo
  packages/core/                           对局引擎（layout.ts 在同级 web-ui-core 里）
  packages/web-ui-core/
    src/layout.ts                          ★ 棋盘坐标函数（getCharacterAreaPos / getEntityPos / getHandPos）
    src/components/TransformWrapper.tsx    ★ 缩放/居中核心（onContainerResize）
    src/components/Chessboard.tsx          棋盘根组件；onResize 里读 window.__GI_VIRTUAL_SIZE
    src/components/ChessboardBackground.tsx 背景图（20x9 webp）
  packages/state-editor/                   摆盘器组件
  packages/standalone/
    src/StandaloneParent.tsx               ★ 对局容器、布局模式读取、syncLayout
    src/board-layout.ts                    ★ 锚点引擎（DESIGN 916×412、AnchorSpec、place、placeChild、stageRect、virtualBoardSize、dumpLayout、dumpAllAnchors）
    src/board-anchors.json                 锚点样例
    src/board-anchors-full.json            86 个绝对定位元素锚点（20:9 录制）
    src/style.css                          ★ 布局模式 CSS
    src/state-editor.tsx / state-editor.css 摆盘器页面与样式
    src/share-image.ts / lab.ts / deck-library.ts / deckbuilder.tsx
    hub.html                               首页（设置、布局三模式、版本号 buildNo）
    public/about.html                      关于页（七章节）
    public/responsive.css                  全页面比例适配
/root/workspace/gitcg-lab/                 Android 壳（build.sh 打包）
```

### 关键常量
- 锚点设计基准：`916×412` CSS px（= 2400×1080 ÷ DPR≈2.6），十字中心 `(458,206)`
- 棋盘内部 `MINIMUM_WIDTH=220, MINIMUM_HEIGHT=99`（单位制），`unitInPx() = 根字号/4`
- 20:9 背景图：`assets-local/ui/ChessboardBackground-20x9.webp`（2400×1080，左右都有木框）

---

## 三、构建与打包（完整命令）

```bash
# 改完代码后
cd /root/workspace/gi-tcg
pnpm --filter @gi-tcg/state-editor build      # 改过摆盘器才需要
pnpm --filter @gi-tcg/standalone build

# dist → 安卓工程（index.html 是模拟器，hub 换成首页）
cp packages/standalone/dist/index.html packages/standalone/dist/app.html
cp packages/standalone/public/editor.html packages/standalone/dist/editor.html
cp packages/standalone/public/about.html packages/standalone/dist/about.html
cp packages/standalone/public/responsive.css packages/standalone/dist/responsive.css

cd /root/workspace/gitcg-lab
rm -rf dist-lab.new && cp -r /root/workspace/gi-tcg/packages/standalone/dist dist-lab.new
mv dist-lab.new/index.html dist-lab.new/app.html
mv dist-lab.new/hub.html dist-lab.new/index.html
rm -rf dist-lab && mv dist-lab.new dist-lab
./build.sh

# 版本号（两处都要改）
# 1) packages/standalone/hub.html 的 <b id="buildNo">
# 2) gitcg-lab/src/AndroidManifest.xml 的 versionCode / versionName

cp build/gitcg.apk /sdcard/Download/gitcg-<ver>.apk
cp build/gitcg.apk "/sdcard/Download/DSH-Go/gitcg-<ver>.apk"
```

### 测试环境
```bash
cd packages/standalone/dist && python3 -m http.server 8899 &
# 首页 http://127.0.0.1:8899/hub.html
# 模拟器 http://127.0.0.1:8899/app.html   （游戏是横屏，测试视口用横屏）
# 摆盘器 http://127.0.0.1:8899/state-editor.html
# 调试：app.html?debugLayout=1（画舞台框+十字线）、?dumpLayout=1（录制锚点）
```
Playwright 脚本样例在 `/tmp/a3.py`、`/tmp/shot2.py`、`/tmp/dump-all.py`（如已清空可按文档重写）。

---

## 四、锚点偏移：已完成 & 下一步

### 已完成
- `board-layout.ts`：`AnchorSpec`（ax/ay/dx/dy/w/h + children）、`place()`、`placeChild()`（角标绑卡角）、`stageRect()`、`virtualBoardSize()`、`applyLayoutVars()`
- 20:9 下用 `dumpAllAnchors()` 录到 **86 个绝对定位元素**，存在 `board-anchors-full.json`
- 调试视图 `mountLayoutDebug()`
- 知道棋盘内部是绝对 px 定位 + `TransformWrapper` 做缩放居中

### 锚点偏移核心机制（已完成，4 个比例全部实测通过，含重投后对局截图）
- **`layout.ts`**：`setBoardSpread(kx, ky, unitPx)` + `applySpread` / `applySpreadX`。
  各元素的偏移规则（以 20:9 为基准，用户指定）：
  - **角色行 / 实体**：上下以正中心水平线对称、行间距固定（48 单位）→ 只做 X 方向 spread；
  - **手牌**：己方手牌**顶边到屏幕下边 = 37.2px**、对面手牌**底边到屏幕上边 = 44.8px**
    （20:9 经典模式实测值，屏幕含留边；锚点按 unitPx 反算：己 `h−2−37.2/us`、
    敌 `44.8/us−34`，4 个比例实测 35.9~38.8 / 43.4~46.6px）→ 不做 spread；
  - **牌堆**：**右缘到界面左边的距离固定 = 20:9 经典模式的 102.9px**（视觉右缘
    = 0.8×x×unitPx − 1.75 → `x = 130.8/unitPx`，各比例实测 102.5~103.1px）；
    上下镜像（下锚点 `base+114.9`、上锚点 `0.75h−44.4`，镜像误差 ≤0.5px），
    中间竖直距离较 20:9 拉开 6 单位；
  - **居中元素**（换牌展示、调谐区）：全方向 spread。
- **`TransformWrapper.tsx`**：
  - 新增 `spread?: boolean`；开启时算 `kx=scaleX/min、ky=scaleY/min`、
    `unitPx=UNIT×scale` 写入 `setBoardSpread`；
  - 旋转 0 时去掉 translate 百分比：`transform-origin: 0 0` +
    `translate((容器−盒子×s)/2, …) scale(s)`，内容精确居中铺满；
  - `spread` 模式跳过 `autoHeight` 高度覆盖。
- **`Chessboard.tsx`**：`spread` 透传；**`StandaloneParent.tsx`**：三态映射修复、
  锚点模式 `__WIDE_BOARD__=true`（20x9 背景铺满）。
- **验证方式**：Playwright 机机对战（AI vs AI）自动走完 选人→掷骰→重投→第 1 回合，
  在「重投完骰子」的行动阶段截图（`art/anchor10-*.png`）：
  | 比例 | 视口 | 牌堆右缘 | 镜像误差 | 行间距 | 手牌条(我/敌) | 背景 |
  |---|---|---|---|---|---|---|
  | 16:9 | 792×445 | 102.9px | 0.4px | 48 单位 | 37.7/44.9px | 铺满 |
  | 16:10 | 800×500 | 102.9px | 0.4px | 48 单位 | 35.9/43.8px | 铺满 |
  | 3:2 | 750×500 | 103.0px | 0.4px | 48 单位 | 36.2/43.4px | 铺满 |
  | 19.5:9 | 891×412 | 102.5px | 0.2px | 48 单位 | 38.8/46.6px | 铺满 |
  - 牌堆右缘 4 个比例最大偏差 0.6px；行间距 48 单位恒定（行动 +6 槽位移除外）；
    经典/拉伸模式回归通过。

### 为什么之前做不成（已解决）
- `TransformWrapper` 的 `translate(-50%,-50%)` 百分比与容器尺寸互相打架 → 显式 px 平移。
- 锚点模式被映射回 classic（三态判断缺失）→ 已修复。
- 锚点 CSS 的 `100dvh !important` 与 `autoHeight` 内联高度冲突 → spread 模式跳过 autoHeight。
- 上下牌堆不镜像：渲染链存在 0.8 投影系数，简单锚点镜像不成立 →
  按 `视觉块 = 0.8×扁平块` 反解出上牌堆锚点公式（实测标定）。

### 下一步
1. **打 APK**：版本 0.11.140（hub.html buildNo + AndroidManifest versionCode/versionName），
   `cp dist → gitcg-lab/dist-lab` → `./build.sh` → 交付 `/sdcard/Download/DSH-Go/gitcg-0.11.140.apk`；
2. 真机确认三种布局模式切换正常、对局手感（拖拽调谐、聚焦手牌）无回归。

### 四个目标比例（横屏，用户指定重点）
| 比例 | 视口 |
|---|---|
| 19.5:9 | 891×412 |
| 16:9 | 792×445 |
| 16:10 | 800×500 |
| 3:2 | 750×500 |

验收标准（用户要求）：四边木框完整、元素按十字中心等比偏移、卡片/角标不变形、无棕色空边。

---

## 五、其他已完成模块（不要回退）

- **牌组库 AI 训练修复**：①「对手来源=专挑克制它的对手」开始训练点不动的根因 =
  `deck.counteredBy`（DeckCounter 对象）被当字符串调 `counter.includes(...)` 抛异常 →
  改为 `counter.id === item.id || counter.label.includes(item.title)`；无克制记录时回退全部对手。
  ②快速自对弈日志不实时 = worker 的 fast 分支 `continue` 跳过了 `postMessage(progress)` →
  补上逐局进度上报（深度强化分支的 `if(true)` 包装一并清理）。
- **牌组库排序框**：`<select id="sort">` 的选项文本「推荐/胜率/对局数/热度」→
  「排序：推荐 / 排序：胜率 / …」（deck-library.html，避免被误认为推荐内容）。
- **组牌器**：
  - 四行张数提示去重：`validateDeck` 对本地规则与引擎校验的报错做归一化去重
    （"必须 3 张"≡"必须是 3 张"、去「当前 X 张」后缀、去「卡牌 」前缀），空牌组只显示两行；
  - 顶栏按钮重排 + 新增「清空」（清空牌组与报错）与「合法性检查：开/关」开关
  （`gi-tcg-deckbuilder-legal-check-v1` 持久化、动态生效）；
  加入牌组库/牌组码/牌组图在角色不满 3 张或行动牌不满 30 张时置灰不可点；
  操作提示改为悬浮 toast（2.6 秒自动消失、不占布局）。
    （`gi-tcg-deckbuilder-legal-check-v1` 持久化、动态生效）；开关关闭时 AI 生成与随机
    跳过组牌器规则+引擎校验（note 提示"未校验"），开启时恢复原校验与重试/回退逻辑；
  - 样式：primary/danger/toggle 配色 + 分隔线（deckbuilder.css）。
- **0.11.153**：关于页更新（构建号、近 12 个版本的版本日志、AGPL-3.0 白话说明）。
- **0.11.152 修正（返回后变实验室新发现）**：
  - 根因：搜索结果首轮渲染时牌组索引尚未加载完成（指纹表为空），社区牌组被
    误判为新发现写入本地；本地条目随后在指纹表里覆盖社区条目，返回实验室
    重载后就显示成「实验室新发现」。修复：索引加载完成前一律不写新发现；
    本地条目不再覆盖同指纹的社区条目（社区优先）。已实测两次进入均显示
    社区原条目、本地库零污染。
- **0.11.151 修正（实验室↔牌组库 重点排查）**：
  - 跨页传参从牌组码改为牌组库条目 id：社区牌组码对卡牌顺序敏感，实验室
    排序后的规范码与库里原始码对不上（已实测两个数据文件的 id 100% 重合、
    码不相同）；结果卡 href 用 ?id=，牌组库 deepLinkDeck 支持 ?id= 精确命中。
  - 排查确认：实验室结果展示的「牌组库标题/作者」来自指纹索引
    （libraryByFp，社区 + 本地都有），与点进去的路径原先是两套键，
    现在统一走 id。
  - 筛选弹层 ✕ 缩小到 18px 收进角上（不再压住已选图标）；清除按钮显示
    已选数量「清除·N」，点 ✕ 收起后选择保留、数量仍可见（已实测）。
- **0.11.150 修正**：
  - 摆盘器快照局写缓存彻底修好：记录从 onCleanup 移到 pagehide（历史后退走
    bfcache 不会卸载组件，onCleanup 不触发）；门槛从 >2 帧降到 >1 帧；对局
    结束帧（canResume=false）立即记录，不等退出页面。
  - 实验室搜索新增「每副候选对局数」设置（2/4/6/10/20/30，默认 6）；
    worker 支持 games 参数；结果过滤与写入阈值跟随设置。
  - 实验室搜索结果的牌组码规范化：角色/卡牌按 id 排序后再编码，
    与牌组库规范码一致——已有牌组点进去就是牌组库原条目（作者/标题），
    不再变成「实验室新发现」；新发现存入的也是规范码。
  - 横屏筛选弹层美化：渐变底 + 金色描边 + 阴影 + 更大的点击热区。
- **0.11.149 修正**：
  - 闪屏根治：实验室/牌组库各自的脚本里还留着写死的 setOrientation("portrait")
    （主页跳转后先被强制竖屏、再被设置转回横屏 → 闪两下）；已改为跟随
    「主体方向」设置；主页入口点击先按设置转方向再跳转；实验室「工具首页」
    改走历史后退（与牌组库一致，不重新加载）。
  - 筛选弹层 ✕ 的 CSS 由兄弟选择器改为后代选择器（✕ 在弹层内部）；卡池
    放大镜 z-index 120→20（低于弹层 30 / 抽屉 40）。
  - 摆盘器快照局写入缓存日志的条件放宽（复用导入通道但也是真实对局）：
    (!fromImport() || autoStartFromSnapshot) && stateLog().length > 2。
- **0.11.148 修正**：
  - 摆盘器直达对局与日志回放的「原始界面」根因：ChessboardBackground 的 wide
    标记只在锚点模式为真，20:9 专用回滚（classic）下为假 → 走原版
    ChessboardBackground.webp + 240×135 固定盒子；改为锚点或 20:9 都置宽屏
    标记，摆盘器/回放与配置页开局完全一致（新背景 + 同一坐标，已实测牌堆
    114.4/44.4 完全相同）。
  - 横屏筛选弹层加 ✕ 关闭按钮（勾选后显示，点击取消勾选收起）。
  - 壳的 onPageFinished 恢复立即应用（缓存方向），不再延迟 600ms 造成闪竖屏。
- **0.11.147 修正**：
  - 摆盘器直达对局回归修复：恢复快照局必须 showLogIndex(0) 才能让 resumeGame
    切到有效日志，否则静默返回导致对局空白卡死（0.11.146 引入，已修）。
  - 横屏筛选弹层：选择器从 grid-area 改为 FM:grid-area（避免误选占位框），
    弹层 z-index 提到 999 压过卡牌放大镜，用兄弟选择器展开（兼容老 WebView）。
  - 工具页方向自应用脚本改为 300ms 延迟、壳的 onPageFinished 对非 app 页
    延迟 600ms 兜底，双保险确保横屏设置生效。
- **0.11.146 修正**：
  - 摆盘器「开始对局」恢复直达对局（不经过配置页），布局与配置页开局同一套；
    首页进摆盘器走新局面（不再直接跳摆盘完成页）；只有从对局返回时
    （游戏退出前写 gi-tcg-editor-resume 标记）才恢复草稿到完成页。
  - 各工具页（实验室/牌组库/关于/摆盘器/AI 设置/组牌器）进页时自应用
    「主体方向」设置（读 localStorage 调 AndroidHost.setOrientation），
    横屏设置不再被壳的时序问题打回竖屏。
  - 组牌器横屏矮屏（≤560px 高）也启用竖屏式「筛选」按钮收起筛选栏，
    并压紧标签/搜索行，选卡区加高约 20px。
- **摆盘器统一入口（0.11.145）**：摆盘器的「开始对局」把快照经 sessionStorage
  带到 app.html 后**停在配置页**（与配置页入口一致），由配置页的「开始对局」
  统一开局（App 的 fromSnapshot 不再直接跳 Standalone 模式）；对局返回走
  history.back 回摆盘器，摆盘器完成页返回清草稿回摆盘器首页，整个链路
  hub→摆盘器→配置→对局→摆盘器→摆盘器首页→hub 无绕路。
- **20:9 专用回滚（0.11.144）**：20:9 视口下 StandaloneParent 强制 classic 模式
  （设置三选项失效）并置 `__GI_CLASSIC_20X9__`，layout.ts 的牌堆/手牌退回
  0.11.121 原始坐标；其余 4 比例保持锚点布局。工具页入口不再强制竖屏；
  组牌器竖屏按钮改换行（不再横向滚出屏）；摆盘器完成页返回清草稿回摆盘器首页
  （不重新随机），对局退出走 history.back 不叠历史条目。
- **组牌器窄屏压缩**：竖屏（≤560px）顶栏改两行紧凑（146→66px）、按钮行横向滑动、
  卡池头部压缩，可滑动选卡区从 547→646px；摆盘器完成页按返回键清草稿回摆盘器首页
  （__dshBack），对局退出用 location.replace 覆盖历史不再绕模拟器配置页；
  主体方向偏好由 MainActivity 缓存（SharedPreferences + 桥接写回），页面切换同步
  应用方向，不再先竖屏再转横屏。
- **竖屏适配 + 主体方向设置**：
  - 全部工具页面（首页/牌组库/组牌器/实验室/关于/摆盘器/AI 设置）在竖屏 412×891
    与横屏 16:9/16:10/3:2/19.5:9/20:9 下均无横向溢出（组牌器 ≤900px 自动变底部抽屉）；
  - 首页设置新增「主体方向」：竖屏/横屏二选一，选择即调 Android 桥
    `AndroidHost.setOrientation` 生效并持久化 `gitcg.mainOrientation`；
    MainActivity 的 onPageFinished 对非 app.html 页面改用 evaluateJavascript 读该偏好
    （默认竖屏）；/app.html 始终 SENSOR_LANDSCAPE 不受影响；壳底色 #101a24→#17140f。
- **原神 UI 风格整体改版（除模拟器游戏界面外）**：
  - 新增共享样式 `public/genshin-ui.css`（深黑棕底 #17140f 系 + 金色 #d3bc8e +
    米白 #ece5d8）+ SVG 装饰素材 `public/assets-local/genshin/`（四角金饰 corner-*.svg、
    菱形分隔 divider.svg、暗斜纹纹理 texture.svg、金质按钮底 btn-gold.svg）；
  - 首页/牌组库/组牌器/实验室/关于页/摆盘器/AI 设置页全部挂载并换掉蓝灰底与
    蓝灰字（蓝黑底→黑棕底、#dfe6ee 类冷字色→米白金）；组牌器组件（@gi-tcg/deck-builder）
    白底卡片也整体转为黑棕金；首页设置弹窗加四角金饰（g-frame）；
  - 4 种比例（16:9/16:10/3:2/19.5:9）逐页检查无横向溢出，可正常滚动使用。
- **设置弹窗（hub.html）**：对局界面布局选项文案去掉「122 方案」，选项更名
  「锚点偏移」并重写说明；**默认布局改为锚点偏移**（localStorage 无值时 hub 与
  StandaloneParent 都回落 anchor，选过则持久化记忆）；弹窗标题栏（设置/关闭）改为
  sticky 固定，滚动设置项时不跟着滚。

- **摆盘器**：顶栏四个按钮一行带框（重新随机 / 导入快照 / 重置 / 完成）；重置=空白桌（0 手牌/0 牌库/0 骰子/第 1 回合）；草稿存 `sessionStorage: gi-tcg-editor-draft-v1`；返回对局直达摆盘器；角色选择器用卡面 + 中文名；变量名已汉化（exp→经验值、stage5→阶段 5 进度…）
- **骰子数量编辑**：单行 `[元素骰图标] [−] [数量] [＋] [加满]`
- **AI**：修复 `this.options.cardPriors` 崩溃（训练 100% 胜根因）；线程数 = 核数−1；快速自对弈走 `playFastGame`（2 场约 3 秒）；深度模式强制 `delayMs=0`
- **牌组图**：三处渲染器统一版式，头部按文字边缘排布，JPG/PNG 画质切换
- **导出分类**：`下载/七圣召唤工具/{AI数据备份,牌组库备份,牌组图,对局日志,AI经验库}/`
- **全页面比例适配**：`responsive.css` 按高度/方向（不要再用 `max-aspect-ratio` 判断短屏，竖屏会全命中）
- **小窗适配**：Java `isInMultiWindowMode()` 反射判断，小窗顶部不留白
- **关于页**：七章节，含心得指南与版本日志

---

## 六、备份与产物

| 文件 | 说明 |
|---|---|
| `art/backup-0.11.121.apk` | 锚点工作开始前 |
| `art/backup-0.11.122.apk` | 20:9 舞台方案 |
| `art/backup-0.11.138.apk` | 锚点模式回退前 |
| `art/board-anchors-20x9.json` | 20:9 全量锚点 |
| `art/edge-916.png` | 20:9 四边木框完整验证 |
| `art/stretch2-4-3.png` | 拉伸填充 4:3 完整铺满 |
| `art/anchor6-*.png` | 锚点 v2 四个比例截图（仅作参考，非最终） |
| `art/deck-library.json` 备份 | `art/backup-decklibrary-0.11.138.json` |

---

## 七、用户偏好（必须遵守）

- 中文回复，简洁；手机屏幕小，代码块别太宽
- 任何改动都要**出图验证**，不能只描述
- 改布局前**先备份**当前 APK
- 数据不能对不上（训练场次/胜负要能相加）
- 回退必须符合层级（对局 → 摆盘器，不能绕配置页）
- 界面要像原生手游，不要网页感；20:9 是基准比例
- 关键 bug 要查根因，不接受"补丁摞补丁"

---

## 八、已知未做事项

1. 锚点偏移模式：布局全部完成（4 比例验证通过），剩 APK 打包（第四节）
2. 摆盘器「正在编辑」抽屉与牌组详情底部抽屉的交互统一（目前是固定 56px 条 / 86vh）
3. 实验室搜索 worker 内存增长（长时间搜索未测上限）
4. 牌组库训练「深度强化」在低端机上的耗时上限
