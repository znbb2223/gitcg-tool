> ⚠️ 本文件由 `scripts/sync-dev-docs.py` 从 `docs/KNOWN-ISSUES.zh.md` 自动生成，请改源文档。
> 校验：`python3 scripts/sync-dev-docs.py --check`

# 已知问题与限制

> 这里记录**目前确实存在的问题**，以及每个问题的规避方式。
> 新发现的问题欢迎提 Issue（带上版本号与屏幕比例）。

## 零、当前版本最影响使用的两条

### 1. 模拟器“先手/后手牌组”实际控制的是人机/AI 牌组
- 位置：模拟器 → 对局配置 → “先手牌组 / 后手牌组”；
- 现象：两个输入框并不控制先手/后手，而是分别控制 **人机（玩家）牌组** 和 **AI 牌组**；
- 影响：想测试同一牌组先后手时会对不上；
- 规避：按“我方牌组 / AI 牌组”理解，或进对局后用摆盘器改；
- 状态：已知，短期不修。

### 2. 组牌器竖屏下卡牌右下角放大镜失效
- 位置：组牌器 → 竖屏 → 卡牌右下角 🔍；
- 现象：点击无反应，不能**直接**打开这张牌的详情；
- 影响：少一个快捷入口，但**不影响把牌选进牌组**；
- 规避：**先把这张牌加入牌组**，再点屏幕下方「当前牌组」里的同一张牌，就能看到详情；
- 状态：已知，短期不修。

### 3. 组牌器 / 牌组库 / 关于 的“返回”会跳到对局配置
- 位置：组牌器、牌组库、关于页顶部的“返回/返回首页”按钮；
- 现象：点击后进入的是**对局配置**页，而不是工具首页；
  此时按系统返回会回到当前功能页，再按一次才回到工具首页；
- 影响：多走一步，容易以为按钮坏了；
- 规避：点完后再按系统返回，或直接用系统返回退出；
- 状态：已知，短期不修。

## 一、布局相关

### 1. 20:9 屏幕上布局设置不生效
- 现象：设置里的「对局界面布局」三个选项在 20:9 手机上切换无效。
- 原因：20:9 固定使用 0.11.121 的经典布局（有意为之）。
- 规避：不用管，20:9 就是最优解。

### 2. 极端比例（如 21:9、折叠屏展开）下元素有偏移
- 现象：超宽屏下牌堆/手牌位置与 20:9 不一致（偏差 1-3px 级）。
- 原因：锚点按 0.8 投影系数标定，超出标定范围时误差放大。
- 规避：切到「20:9 等比」模式。

### 3. 竖屏下对局不可用
- 现象：竖屏时对局界面显示不全。
- 原因：对局强制横屏（手游横屏打牌）。
- 规避：工具页可以竖屏，对局会自动转横屏。

## 二、牌组库与实验室

### 4. 牌组库是快照数据
- 现象：新赛季/新卡上线后，牌组库没有新卡组。
- 原因：数据靠脚本抓取，不是实时同步。
- 规避：等数据更新，或自己按 `docs/ASSETS.zh.md` 抓取重建。

### 5. 实验室搜索很吃 CPU
- 现象：跑实验室时手机发热、耗电快。
- 原因：多线程穷举 + 每副候选多局对弈。
- 规避：把「每副候选对局数」调低（2~4）、候选数调小。

### 6. 实验室部分结果无胜率
- 现象：某些候选牌组只有对局数没有胜率。
- 原因：样本不足（低于阈值不展示胜率，避免误导）。
- 规避：提高对局数再跑。

## 三、AI 相关

### 7. AI 强度有上限（见 `docs/AI.zh.md`）
- 现象：AI 长线规划差，容易被针对性牌组击败。
- 原因：rollout 深度有限，评估偏即时收益。
- 规避：提高搜索预算、用训练器补经验。

### 8. 极高预算下出牌明显变慢
- 现象：搜索预算调到 8000ms 以上时，每步思考约 1-2 秒。
- 原因：时间驱动预算。
- 规避：日常对局用 2000-3000ms。

### 9. 训练器导入会合并，不会回滚
- 现象：导入经验后无法撤销。
- 原因：按对局数合并设计。
- 规避：导入前备份 localStorage（或清除应用数据重置）。

## 四、安装与运行

### 10. 只能装安卓 10+（API 29）
- 原因：`minSdk 29`（WebView 与 localStorage 行为需要）。
- 规避：低版本设备请用网页版。

### 11. WebView 版本过低会白屏
- 要求：WebView 105+ 完整支持；80-104 基本可用。
- 规避：系统设置里更新 Android System WebView。

### 12. 覆盖安装失败（签名不一致）
- 现象：`INSTALL_FAILED_UPDATE_INCOMPATIBLE`。
- 规避：先卸载旧版；或统一使用同一签名包。

### 13. 清除应用数据会丢掉一切
- 影响：设置、收藏、实验室参数、导入的 AI 经验。
- 规避：先导出经验包再清。

## 五、已知但暂不修

| 问题 | 原因 |
|---|---|
| 组牌器在极窄屏（<360px）下筛选按钮换行 | 空间不足，可滚动 |
| 牌组图导出在部分老 WebView 上字体回退 | 字体缺失，不影响牌组码 |
| 宣传片素材含游戏美术，不能直接商用 | 版权归米哈游 |


---

## 相关文档

- [AI-EXPERIMENTS.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/AI-EXPERIMENTS.zh.md) · [AI-ROADMAP.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/AI-ROADMAP.zh.md) · [AI-实现详解.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/AI-实现详解.zh.md) · [AI.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/AI.zh.md)
- [AI实验交接-2026-11-27.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/AI实验交接-2026-11-27.md) · [ARCHITECTURE.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/ARCHITECTURE.zh.md) · [ASSETS.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/ASSETS.zh.md) · [BUILD.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/BUILD.zh.md)
- [DATA.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/DATA.zh.md) · [DEVLOG.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/DEVLOG.zh.md) · [GLOSSARY.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/GLOSSARY.zh.md) · [INSTALL.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/INSTALL.zh.md)
- [PITFALLS.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/PITFALLS.zh.md) · [README.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/README.md) · [ROADMAP.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/ROADMAP.zh.md) · [TESTING.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/TESTING.zh.md)
- [TRAINER.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/TRAINER.zh.md) · [UI.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/UI.zh.md) · [USER-GUIDE.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/USER-GUIDE.zh.md) · [README.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/README.md)
- [MAINTENANCE.zh.md](https://github.com/znbb2223/gitcg-tool/blob/main/docs/MAINTENANCE.zh.md) · [牌组码工具](https://github.com/znbb2223/gitcg-tool/blob/main/docs/tools/deckcode/README.md) · [文档中心](https://github.com/znbb2223/gitcg-tool/blob/main/docs/README.md)
