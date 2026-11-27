#!/bin/bash
# 策略头引导搜索：A=搜索+策略先验 vs B=纯搜索，208 局
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
POLICY=/data/gitcg/bin2/policy-40d.json
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done
echo "$(date +%H:%M:%S) 启动 policy-guide（A 引导 vs B 纯搜索）"
run_lane() { for off in "$@"; do
  node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" --budget=150 --depth=10 \
    --policy="$POLICY" --policyGuide --lib="$LIB" > "$LOG/ab-guide-$off.log" 2>&1
done; }
run_lane 1500 1552 &
run_lane 1513 1565 &
run_lane 1526 1578 &
run_lane 1539 1591 &
wait
echo "done $(date +%H:%M:%S)"
