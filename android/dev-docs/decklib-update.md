# 牌组库更新指南（七圣召唤工具）

> 这份文档只讲一件事：**怎么把新发布的牌组安全、可复现地补进牌组库，并且让 AI 吃到这些经验。**
> 每次更新照着走，命令可以直接复制。

---

## 0. 先认清楚东西在哪

| 东西 | 路径 |
|---|---|
| 主仓库 | `/root/workspace/gi-tcg` |
| 牌组库数据（成品，打进 APK） | `packages/standalone/public/data/deck-library.json` |
| 牌组目录（训练/合并用中间表） | `/tmp/deck-catalog.json` |
| 角色/卡牌筛选元数据 | `packages/standalone/public/data/filter-meta.json` |
| 随机牌组池（摆盘器用） | `packages/standalone/public/data/random-decks.json` |
| 作者说明分析批次 | `/root/workspace/art/notes/batch-XX.json` / `out-XX.json` |
| AI 攻略提示 | `packages/ai/src/data/author-hints.ts` |
| 安卓壳 | `/root/workspace/gitcg-lab` |

一条原则：**`deck-library.json` 是唯一成品**，其它 JSON 都是它的中间产物。改动前先备份它。

---

## 1. 每日增量（正常情况走这条）

> 目标：只抓今天 0:00 之后新发布的牌组，去重、跑对局、分析、入库。

### 1.1 断点：上次抓到哪了

断点文件：`/root/workspace/art/decklib-state.json`

```json
{
  "lastScrapedAt": 1795599848,
  "lastRunAt": "2026-11-25T09:49:11.207Z",
  "lastCount": 6,
  "lastMergedAt": "2026-11-25T09:52:03.112Z",
  "lastMergedCount": 1
}
```

- `lastScrapedAt`：**下次从这里开始抓**（Unix 秒）
- 抓取脚本每次结束会把断点更新为「本次运行时间 − 5 分钟」，留出服务器时钟偏差余量；既不会漏掉刚发的帖，也不会重复太多
- **第一次跑（没有断点文件）会从 0 开始 = 全量抓取**；想强制全量就删掉这个文件
- 牌组库页面顶部会显示 `上次抓取 YYYY/MM/DD HH:mm`，数值来自 `deck-library.json` 的 `lastScrapedAt`

查看断点 / 手动回退到某个时间：

```bash
cat /root/workspace/art/decklib-state.json

# 想从 2026-11-20 00:00 重抓：
python3 -c "import json,datetime;p='/root/workspace/art/decklib-state.json';d=json.load(open(p));d['lastScrapedAt']=int(datetime.datetime(2026,11,20).timestamp());json.dump(d,open(p,'w'),indent=1);print(d)"
```

### 1.2 抓卡牌广场（从断点开始）

```bash
cd /root/workspace/gi-tcg/packages/ai
node scripts/scrape-today.mjs          # 自动读断点
node scripts/scrape-today.mjs 1795536000   # 也可以临时指定时间戳覆盖断点
```

- 接口：`POST https://api-takumi.mihoyo.com/event/cardsquare/index`
  body `{page_size:50, next_page_token, label_id?}`
- 分区池：`[14,19,12,13,11,20,27,15,22,3]` + 无标签池；**必须逐池翻页**，单池只有 ~1167 条
- 脚本按 `created_at < SINCE` 提前终止，所以日常增量很快（今天只抓到 6 套新帖）
- 字段：`card_code / title / desc / account_uid / nickname / label_ids / tags / like_cnt / view_cnt / created_at`

### 1.3 去重 + 自对弈 + 分析 + 入库（一条命令）

```bash
node scripts/incremental-update.mjs 6        # 参数=每套新牌打几局自对弈
```

它内部做四件事：

1. **解码 + 合法性**：`DEFAULT_ASSETS_MANAGER.decode(code)`，再 `validateDeck(deck, deckData)`
2. **去重**：按「3 角色 + 30 张牌」排序后的指纹比较，同时比对分享码
3. **自对弈**：每套新牌 vs 库里随机强牌组打 N 局（一局最多 14 回合），统计 胜:负:平
4. **分析入库**：
   - `tags`：广场自带标签 + 作者说明关键词（快攻/OTK/冻结/召唤/整装/整活/上分/比赛…）+ 费用曲线
   - `role`：从作者说明里截一句定位（≤10 字）
   - `guide`：五段（开局/中期/注意/弱点/评价），开局中期直接取作者说明要点，评价带自对弈战绩
   - 增加字段：`author{uid,nickname}`、`note`、`createdAt`、`games/winRate`、`guideSource:"today"`
   - 同步追加到 `/tmp/deck-catalog.json`（下次全量重建不会丢）

跑完会打印类似：

```
今日抓到 6 套，去重后新增 1 套
索塔雅队/小男孩队（笑） → 5:1:0（83%）
新增 1 套已写入牌组库（共 4543 套）
```

### 1.4 重建并出包

```bash
cd /root/workspace/gi-tcg
pnpm --filter @gi-tcg/standalone build
cp packages/standalone/dist/index.html packages/standalone/dist/app.html
cp packages/standalone/public/editor.html packages/standalone/dist/editor.html

cd /root/workspace/gitcg-lab
rm -rf dist-lab.new && cp -r /root/workspace/gi-tcg/packages/standalone/dist dist-lab.new
mv dist-lab.new/index.html dist-lab.new/app.html
mv dist-lab.new/hub.html dist-lab.new/index.html
rm -rf dist-lab && mv dist-lab.new dist-lab
./build.sh
cp build/gitcg.apk "/sdcard/Download/DSH-Go/gitcg-<版本>.apk"
```

> 版本号两处都要改：`packages/standalone/hub.html` 的 `buildNo`、`gitcg-lab/src/AndroidManifest.xml` 的 `versionCode/versionName`。

---

## 2. 作者说明的深度分析（子代理流程）

> 增量脚本里的 `guide` 是「摘录式」的；要大改文案、要每套牌都有像样的攻略，就走这一套。
> 适用：攒了一批新说明（或第一次全量），需要逐条人工级分析。

### 2.1 生成批次（去重后说明书 ≥60 字）

```bash
python3 - <<'PY'
import json, collections
lib=json.load(open('/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json'))
chars=lib["characters"]; uniq=collections.OrderedDict()
for d in lib["decks"]:
    n=" ".join((d.get("note") or "").split())
    if len(n)<60 or n in uniq: continue
    uniq[n]={"id":d["id"],"t":(d.get("title") or "")[:40],
             "c":"/".join(chars.get(str(i),str(i)) for i in d["chars"]),"n":n[:500]}
notes=list(uniq.values()); B=60
import os; os.makedirs('/root/workspace/art/notes',exist_ok=True)
for i in range(0,len(notes),B):
    json.dump(notes[i:i+B], open(f'/root/workspace/art/notes/batch-{i//B:02d}.json','w'), ensure_ascii=False)
print("batches:", (len(notes)+B-1)//B)
PY
```

**关键**：批次文件必须是「一条一行」的多行 JSON，否则子代理的 read 工具会在 2000 字符处截断，读不到后面 50 多条。

### 2.2 派子代理（一条一条派，别贪多）

- **一次只派一个批次（60 条）**：一次给 6 个批次会上下文过载，子代理全挂且不留结果
- 子代理环境里 **bash 会被沙箱拒绝**，只能 read/write；所以：
  - 输入必须是多行 JSON
  - 输出 `out-XX.json` 也要求「一条一行」
- 提示词模板（照抄，替换批次号）：

```
给《七圣召唤》牌组打标签并写攻略。只处理一个文件：/root/workspace/art/notes/batch-XX.json（多行 JSON，可完整读取）。
【工具】本机没有可用 bash 沙箱：不要执行 bash。直接用 read 读文件、write 写文件。
文件是 JSON 数组，60 条，每项：id、t=标题、c=角色、n=作者说明。逐条：
1) tags：3~5 个，优先从词表选：快攻、中速、控制、组合技、OTK、铺场、消耗、爆发、续航、召唤、装备、支援、元素反应、冻结、超载、绽放、感电、扩散、结晶、燃烧、蒸发、融化、激化、速切、过牌、整活、新手友好、上分、比赛、魂向、轮椅、长局、三回合内、双打、冒险挑战。「控制」只在作者真写了护盾/回复/解场/拖后期时才用。标签不含角色名、不重复。
2) role：≤10 字定位。
3) guide 五段 open/mid/watch/weak/verdict，每段 25~45 字，五段合计 ≤200 字；必须来自作者说明的事实，没写到的段落结合角色组合写具体建议，不要编造卡名或数字。
写 JSON 数组到 /root/workspace/art/notes/out-XX.json（纯 JSON、不要 markdown、60 条、id 原样）。
写完回复一行：OK 60。
```

### 2.3 审计（必做，别信“已完成”）

```bash
cd /root/workspace/art/notes && python3 - <<'PY'
import json, glob, collections
for p in sorted(glob.glob("out-*.json")):
    try:
        d=json.load(open(p))
    except Exception as e:
        print(p, "坏文件", e); continue
    bad=[x for x in d if not isinstance(x,dict)]
    if bad: print(p, "有非对象条目", len(bad))
PY
```

已知会踩的坑：

- 子代理会把 `cardsquare-x-…` 的 `x-` 抄丢、把 id 末位写错 → **合并脚本按批次输入顺序配对**，id 以输入为准
- `out-07.json` 曾出现数组里混字符串 → 重跑该批次
- 个别说明被多套牌共用 → 合并时按「归一化说明文本」扩散（120 字前缀兜底）

### 2.4 合并分析结果

```bash
cd /root/workspace/gi-tcg/packages/ai
node scripts/merge-ai-tags.mjs        # 写回 authorTags / role / 五段 guide（超 200 字自动按比例削）
node scripts/gen-author-hints.mjs     # 生成 AI 用的 keep/play 提示 → src/data/author-hints.ts
```

`merge-ai-tags.mjs` 的行为：

- 读 `batch-XX.json`（输入）与 `out-XX.json`（输出），**按下标配对**
- 缺 id 时按 id 找；再不行按说明文本 / 前缀扩散
- 写回字段：`authorTags[]`、`role`、`guide`、`guideSource:"ai"`

### 2.5 覆盖检查

```bash
cd /root/workspace/gi-tcg/packages/ai && python3 - <<'PY'
import json
lib=json.load(open('/root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json'))
need=[d for d in lib["decks"] if len((d.get("note") or "").strip())>=60]
miss=[d for d in need if d.get("guideSource")!="ai"]
print("有说明:",len(need),"缺分析:",len(miss))
PY
```

要求是 **缺口 0**；有缺就单独补批次（曾用 `batch-43.json` 补最后 24 套）。

---

## 2.6 短说明（8~60 字）的提炼

长说明走上面的批次；**短说明另走一套**，别混在一起：

- 批次目录：`/root/workspace/art/notes2/`
- 批次文件：`short-XX.json`（60 条一批，一条一行），输出 `out-short-XX.json`
- 生成批次的筛选条件：说明去空白后长度 **8 ≤ len < 60**，且 `guideSource !== "ai"`
- 提示词与长说明基本一致，但要求更克制：**每段 20~40 字、看不清就写「说明里没有特别提到…」**，不许编造卡名/数字
- 合并：`node packages/ai/scripts/merge-short-notes.mjs`
  （按批次输入顺序配对、id 以输入为准、五段合计超 200 字自动按比例压缩、写入 `authorTags / role / guide`，`guideSource` 记为 `ai`）

实测：说明 8~60 字的牌组约 1,982 套 → 34 个批次。

## 3. 让 AI 吃到经验


- `author-hints.ts`：`{ "<角色排序|卡牌排序>": { keep:[卡牌id], play:[卡牌id] } }`
- `player.ts`：起手换牌时，攻略点名要留的牌减 3 分（不换）
- `evaluate.ts`：`ScoreContext.authorCards / authorBonus`，出牌评分里给攻略点名的牌 +0.35
- 改完必须跑 A/B（同批牌组镜像、只有先手开提示）：

```bash
cd /root/workspace/gi-tcg/packages/ai
node scripts/_ab-hints.mjs 80
```

历史数据：80 局 不带 19:21 → 带 22:18（47.5% → 55%）；40 局 14:25:1 → 21:18:1。
**没有正向就不要加权重**，别为了“感觉更强”乱改。

---

## 4. 首次全量（只在数据大版本更新时走）

```bash
cd /root/workspace/gi-tcg/packages/ai
node scripts/scrape-cardsquare-full.mjs "[14,19,12,13,11,20,27,15,22,3]" 60 /tmp/cardsquare-full.json
node scripts/enrich-cardsquare-details.mjs            # 老牌组补详情（id 走 detail 接口）
node scripts/build-catalog.mjs                        # 合并 + 去重 + 硬性过滤（缺标题/作者/说明的不收）
node scripts/build-decklib.mjs                        # 生成 deck-library.json（含标签/元素/梯度/说明）
node scripts/parse-card-effects.mjs                   # 从卡牌描述解析技能效果 + 校准费用
node scripts/merge-ai-tags.mjs                        # 再合一遍作者分析（会覆盖脚本版说明）
node scripts/gen-author-hints.mjs
```

顺序不能反：**catalog → decklib → merge-ai-tags → hints**。
`build-decklib` 会重写 `deck-library.json`，所以**每次重建后都必须重跑 merge-ai-tags**，否则作者标签和提炼说明会丢。

---

## 5. 收尾验收清单

- [ ] `deck-library.json` 里新牌组有 `title / author{uid,nickname} / note / tags / role / guide`
- [ ] `deck-library.json` 的 `lastScrapedAt` 是本次时间，页面顶部显示正确
- [ ] 说明 ≥60 字的牌组 `guideSource === "ai"` 全覆盖
- [ ] 首页构建号、`AndroidManifest` 版本号都 +1
- [ ] `aapt dump badging build/gitcg.apk` 版本正确、`apksigner verify` 通过
- [ ] 无头浏览器打开 `deck-library.html`：筛选能开、角色/卡牌子条件实时缩候选、搜索能命中新牌组
- [ ] `md5sum` 记到交接文档里

---

## 6. 踩坑清单（重复踩过）

1. **单行 JSON 会被 read 截断**（2000 字符）→ 批次与输出一律一条一行
2. **子代理 bash 被拒**（workspace-write 无沙箱）→ 提示词里明确“只用 read/write”
3. **一次派 6 个批次会全挂** → 一批一个，最多同时 8 个子代理（超了会报 active child limit）
4. **id 会被抄错** → 合并按下标配对，永远以输入 id 为准
5. **`build-decklib` 会覆盖作者分析** → 重建后必须重跑 `merge-ai-tags`
6. **说明共用** → 合并时按说明文本扩散，否则同说明的其它牌组没标签
7. **卡牌费用**：`entities` 上的 cost 全是 0，要用 datum 的 `playCost`
8. **技能效果**：数据里只有部分标签，其余必须解析描述文本（`parse-card-effects.mjs`）
9. **阵营多标签**：一个角色可能同时属于「须弥 + 镀金旅团」，元数据必须存数组，否则筛不出角色
10. **重复 CSS 块**：`deck-library.html` 里同一段样式被贴两次会互相覆盖，改样式前先 grep 计数

---

## 7. 命令速查

```bash
# 每日增量
SINCE=$(date -d "today 00:00" +%s)
cd /root/workspace/gi-tcg/packages/ai
node scripts/scrape-today.mjs
node scripts/incremental-update.mjs 6

# 重建 + 出包
cd /root/workspace/gi-tcg && pnpm --filter @gi-tcg/standalone build
cp packages/standalone/dist/index.html packages/standalone/dist/app.html
cp packages/standalone/public/editor.html packages/standalone/dist/editor.html
cd /root/workspace/gitcg-lab && ./build.sh
cp build/gitcg.apk "/sdcard/Download/DSH-Go/gitcg-<版本>.apk"

# 作者分析流水线
node scripts/merge-ai-tags.mjs && node scripts/gen-author-hints.mjs
node scripts/_ab-hints.mjs 80
```
