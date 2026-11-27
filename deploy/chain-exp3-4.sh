#!/bin/bash
# 接力：实验2 结束后 → 实验3（v1+nn vs v1）→ 实验4（仅 v2 vs v1，新对局区间复核）
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
NN=/data/gitcg/data/nn-v1.json
cd /data/gitcg || exit 1

wait_idle() {
  while pgrep -f "[a]b-value" >/dev/null; do
    sleep 20
  done
}

wait_idle
echo "$(date +%H:%M:%S) 启动实验3（v1+nn vs v1）"
for off in 0 13 26 39; do
  nohup node "$BIN" --a=v1nn --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 --nn="$NN" > "$LOG/ab-exp3-$off.log" 2>&1 &
done

wait_idle
echo "$(date +%H:%M:%S) 启动实验4（仅 v2 vs v1，新区间 52~103）"
for off in 52 65 78 91; do
  nohup node "$BIN" --a=v2 --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 > "$LOG/ab-exp4-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) 实验4 已启动（4 实例）"
