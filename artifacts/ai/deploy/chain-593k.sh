#!/bin/bash
# 全量 59 万条训出的 40 维价值网络 vs v1，208 局（8 实例 × 26）
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
NN=/data/gitcg/data/nn-40d-593k.json
cd /data/gitcg || exit 1
echo "start $(date +%H:%M:%S)"
run_lane() {
  for off in "$@"; do
    node "$BIN" --a=v1nn --b=v1 --pairs=13 --offset="$off" --budget=150 \
      --depth=10 --nn="$NN" --nnWeight=0.45 > "$LOG/ab-v593k-$off.log" 2>&1
  done
}
run_lane 700 752 &
run_lane 713 765 &
run_lane 726 778 &
run_lane 739 791 &
wait
echo "done $(date +%H:%M:%S)"
