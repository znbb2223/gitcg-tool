#!/bin/bash
# 用修好的采集器（含 e 字段修复）采搜索标签数据：双方都搜索，标签就是搜索的决策
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/collect.bundle.mjs
LIB=/data/gitcg/data/deck-library.json
OUT=/data/gitcg/traj-v4
mkdir -p "$OUT"
cd /data/gitcg || exit 1
echo "start $(date +%H:%M:%S)"
for s in 0 1 2 3; do
  node "$BIN" --games 500 --shard $s --shards 4 --out "$OUT" \
    --mix search --sample 2 --budget 150 --depth 10 --lib "$LIB" \
    > "$LOG/collect-v4-$s.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
