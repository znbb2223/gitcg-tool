#!/bin/bash
# 策略网络正式验证：400 局 vs 启发式（±5%）+ 208 局 vs 搜索
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
POLICY=/data/gitcg/bin2/policy-40d.json
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done

echo "$(date +%H:%M:%S) 启动 policy-vs-heur（400 局）"
for off in 1100 1118 1136 1154; do
  node "$BIN" --a=policy --b=heur --pairs=50 --offset="$off" --policy="$POLICY" --lib="$LIB" \
    > "$LOG/ab-polheur-$off.log" 2>&1 &
done
wait

echo "$(date +%H:%M:%S) 启动 policy-vs-search（208 局）"
run_lane() { for off in "$@"; do
  node "$BIN" --a=policy --b=v1 --pairs=13 --offset="$off" --budget=150 --depth=10 \
    --policy="$POLICY" --lib="$LIB" > "$LOG/ab-polv1-$off.log" 2>&1
done; }
run_lane 1200 1252 &
run_lane 1213 1265 &
run_lane 1226 1278 &
run_lane 1239 1291 &
wait
echo "done $(date +%H:%M:%S)"
