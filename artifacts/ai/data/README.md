# 训练样本（v6 格式，44 维）

480 局 / 20,777 条决策样本，gzip 压缩，每行一条 JSON。用于价值网络训练与统计诊断。

## 字段

```jsonc
{"v":6,"s":0,"w":1,"t":3,
 "f":{ /* 44 个命名特征 */ },
 "x":[ /* 44 维定长向量，供 NN */ ],
 "c":[{ /* 前 5 个候选动作特征：k,cost,dmg,kill,fast,tgtHp,et,sc */ }],
 "a":动作下标,"l":"card:332004",
 "h":[我方手牌 id],"e":[对手已出牌 id],"ai":AI 标记,"n":局号}
```

- 特征顺序由 `packages/ai/src/value.ts` 的 `FEATURE_NAMES` 决定，**顺序发布后不可改**（模型维度校验会拒绝）。
- 44 维 = 40 维基础特征 + 牌组索引 + 对手已出牌；`e` 字段在 v3 里 99% 为空，本批已修复。

## 重新采集

```bash
node packages/ai/scripts/collect-trajectories.mjs --games 5000 --shard 0 --shards 4 \
  --out /tmp/traj-v6 --lib packages/standalone/public/data/deck-library.json \
  --mix mixed --sample 3 --budget 100 --depth 10 --searchShare 0.12 --blunderShare 0.13
```

`--mix heuristic|mixed|search` 控制对手强度；`--sample N` 每 N 个决策点采一条；
`progress-<shard>.json` 记录进度，重跑同参数自动跳过。

## 训练

```bash
OPENBLAS_NUM_THREADS=1 python3 packages/ai/tools/train_value.py \
  --data 'artifacts/ai/data/traj-v6/*.jsonl.gz' --out model.json --epochs 30
```

样本更大的一批（v3，2 万局 / 59.3 万条 / 64MB）因体积与 `e` 字段无效没有入库，可用同一脚本重新采集。
