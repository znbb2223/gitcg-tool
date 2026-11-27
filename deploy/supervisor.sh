#!/bin/bash
# 采集守护：保证 4 个分片常驻；23 维特征；每分片 5000 局（合计 2 万）
set -u
BIN=/data/gitcg/bin
OUT=/data/gitcg/traj-v3
LOG=/data/gitcg/logs-v3
LIB=/data/gitcg/data/deck-library.json
SHARDS=${SHARDS:-4}
PER_SHARD=${PER_SHARD:-5000}

mkdir -p "$OUT" "$LOG"
while true; do
  for i in $(seq 0 $((SHARDS-1))); do
    if ! pgrep -f "collect.bundle.*--shard $i " >/dev/null; then
      nohup node "$BIN/collect.bundle.mjs" \
        --games "$PER_SHARD" --shard "$i" --shards "$SHARDS" \
        --out "$OUT" --lib "$LIB" \
        --mix mixed --sample 3 --budget 100 --depth 10 \
        --searchShare 0.12 --blunderShare 0.13 \
        >> "$LOG/shard-$i.log" 2>&1 &
      echo "$(date +%H:%M:%S) 启动分片 $i"
    fi
  done
  sleep 60
done
