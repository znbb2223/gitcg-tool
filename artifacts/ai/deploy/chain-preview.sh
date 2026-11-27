#!/bin/bash
# 跳过 rollout 预览 vs 完整预览：同 150ms 预算，A 加速换 rollout 数
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
LIB=/data/gitcg/data/deck-library.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done
echo "$(date +%H:%M:%S) 启动 preview 加速对照（208 局）"
run_lane() { for off in "$@"; do
  node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" --budget=150 --depth=10 \
    --skipPreview --lib="$LIB" > "$LOG/ab-preview-$off.log" 2>&1
done; }
run_lane 1700 1752 &
run_lane 1713 1765 &
run_lane 1726 1778 &
run_lane 1739 1791 &
wait
echo "done $(date +%H:%M:%S)"
