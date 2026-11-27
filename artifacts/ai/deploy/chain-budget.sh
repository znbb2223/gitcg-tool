#!/bin/bash
# 预算不对称：A=600ms vs B=150ms，同 AI 同权重，只改思考时间
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
echo "start $(date +%H:%M:%S)"
run_lane() { for off in "$@"; do
  node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" --budget=600 --budgetB=150 \
    --depth=10 --lib="$LIB" > "$LOG/ab-bud600-$off.log" 2>&1
done; }
run_lane 1600 1652 &
run_lane 1613 1665 &
run_lane 1626 1678 &
run_lane 1639 1691 &
wait
echo "done $(date +%H:%M:%S)"
