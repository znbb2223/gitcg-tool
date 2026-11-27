#!/bin/bash
# 把"搜索 vs 启发式"从 104 局扩到 500+ 局，确认 +7.7 点是不是真的
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done
echo "$(date +%H:%M:%S) 启动 heur 扩样（400 局）"
for off in 1400 1418 1436 1454; do
  node "$BIN" --a=v1 --b=heur --pairs=50 --offset="$off" --budget=150 --depth=10 \
    --lib="$LIB" > "$LOG/ab-heur2-$off.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
