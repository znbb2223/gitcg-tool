# 关键数字与事实核对表

文档里的每个关键数字都应该能在这里找到出处和校验方法。**改代码/发新包后要更新本表**。

> 最近核对：2026-11-28，基于 `0.11.158 / versionCode 279 / 数据 7.2.0` 与发行 APK。
> 相关：[DOC-STANDARD.md](./DOC-STANDARD.md)（文档规范）· [BUILD.zh.md](./BUILD.zh.md)（体积口径）

---

## 1. 卡片与牌组数据

| 事实 | 值 | 出处 / 校验 |
|---|---|---|
| 社区牌组数 | **4,557 套** | 发行包 `assets/web/data/deck-library.json` 的 `decks.length` |
| 牌组库累计对局 | **34,800 局** | 同上 `totalGames`（注意：这和 AI 种子局数是两回事） |
| 牌组库数据体积 | **12.9 MB（5 个文件）** | 发行 APK 内 `assets/web/data/` 实测 |
| 卡牌数据版本 | **7.2.0** | `packages/data` 生成产物；关于页/构建号同源 |

```bash
# 复算牌组数（在解包后的 web 目录里）
python3 -c "import json;d=json.load(open('data/deck-library.json'));print(len(d['decks']), d['totalGames'])"
```

## 2. AI 经验种子

| 事实 | 值 | 出处 / 校验 |
|---|---|---|
| 内置种子局数 | **70,102 局** | `packages/ai/src/data/experience-seed.ts` 的 `games` 字段（文件头写明合并来源） |
| 手机端首次启动 | 直接加载该种子，不需联网 | `hub.html` 统计行 + `experience-seed.ts` |

> 历史文档里出现过 `69,515`，那是合并训练器经验包之前的旧数；以文件里的 `games` 为准。

```bash
grep -o '"games":[0-9]*' packages/ai/src/data/experience-seed.ts | head -1
```

## 3. 体积口径

| 事实 | 值 | 说明 |
|---|---|---|
| `assets-local`（卡图/UI） | **15,111 个文件 / 148.8 MB** | 解包字节；按 4K 块算约 **185.6 MB**（小文件多，`du` 会更大） |
| `assets/web`（完整 Web 目录） | **189.3 MB** | 解包字节（= assets-local + data + JS/CSS） |
| APK 文件 | **156.3 MB** | 压缩后的 APK 本体 |
| 牌组图 JPG（默认） | 1404×3715，约 **0.85 MB** | `encodeShareImage()` 缩 65% + JPEG q0.82 |
| 牌组图 PNG（高画质） | 2160×5716，约 **10.5 MB** | 原尺寸 `toDataURL("image/png")` |

> 之前文档写的「202MB 卡图」是块占用/旧统计口径，不是解包字节；两者不要混用。

```bash
unzip -l 七圣召唤工具.apk | awk '/assets\/web\/assets-local\//{n++;s+=$1}END{printf "%d files %.1f MB\n",n,s/1e6}'
```

## 4. AI 战绩（来自归档，不是估算）

| 事实 | 值 | 出处 |
|---|---|---|
| 搜索 vs 纯启发式 | **60.7%**（798 局） | `artifacts/ai/AI-整合配置.md`、`AI-终结报告-2026-11-28.md` |
| 跳过 rollout 预览 | **63.9%**（416 局，+13.9 点） | `docs/AI-EXPERIMENTS.zh.md`、`artifacts/ai/AI-整合配置.md` |
| DMC vs 纯启发式 | **67.6%**（224 局） | `artifacts/ai/DMC-结果-2026-11-28.md` |
| DMC vs 冻结搜索 150ms | **50.2%**（224 局） | 同上 |
| DMC vs App 2500ms | **28.7%**（224 局） | 同上 |

## 5. 代码常量

| 事实 | 值 | 出处 / 校验 |
|---|---|---|
| 局面特征维度 | **44** | `packages/ai/src/value.ts` 的 `FEATURE_NAMES.length` |
| 动作编码维度 | **12**（`usesScore` 时 13） | `ACTION_KINDS` 6 类 + 6 个数值字段（+ score） |
| 搜索默认预算 | **2500ms** | `packages/standalone` 的 AI 默认参数 |
| 对局设计基准 | **2400×1080（20:9）**，220×99 单位 | `docs/UI.zh.md`、`layout.ts` |
| 安卓 origin | **http://127.0.0.1:8765** | `android/src/java/.../MainActivity.java:36` |
| 权限 | **无 `uses-permission`** | `android/src/AndroidManifest.xml` |

```bash
# 特征维度
python3 - <<'PY'
import re
s=open('packages/ai/src/value.ts').read()
names=re.findall(r'"([^"]+)"', re.search(r'FEATURE_NAMES = \[(.*?)\];', s, re.S).group(1))
print(len(names))
PY
```

## 6. 文档自身的一致性

| 事实 | 值 | 校验 |
|---|---|---|
| 已知问题（最影响使用） | **3 条** | `docs/KNOWN-ISSUES.zh.md` 第零节 |
| 踩坑清单 | **24 条** | `docs/PITFALLS.zh.md` 二级标题计数 |
| Markdown 死链 / 围栏 | **0** | `python3 scripts/check-docs.py` |

## 7. 记录约定

- 每个数字写清「值 + 出处 + 校验方式」，改动时三样一起改；
- 发行包才能算的（牌组数、体积），脚本要写在这里，别人能复算；
- 归档类文档（`artifacts/`、`DEVLOG`）里的数字如果过时，**不要静默改历史**，在文首加“历史记录”或在本表注明新值。
