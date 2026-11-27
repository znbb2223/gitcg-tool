#!/bin/bash
# 用 2 万局 v3 子集（28.5 万条）训的策略网络，对启发式 400 局
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
POLICY=/data/gitcg/bin2/policy-v3-285k.json
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done
echo "$(date +%H:%M:%S) 启动 policy-v3(285k) vs heur，400 局"
for off in 1300 1318 1336 1354; do
  node "$BIN" --a=policy --b=heur --pairs=50 --offset="$off" --policy="$POLICY" --lib="$LIB" \
    > "$LOG/ab-polv3-$off.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
