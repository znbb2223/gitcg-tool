#!/bin/bash
# 380 局复验：v1nn（22 维 196k 模型，nnWeight 0.2）vs v1，等 deep30 跑完再启动
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
NN=/data/gitcg/data/nn-v1.json
cd /data/gitcg || exit 1

while pgrep -f "[a]b-value" >/dev/null; do
  sleep 30
done
echo "$(date +%H:%M:%S) 队列空闲，启动 380 局复验（15 实例 × 26 局）"

run_lane() {
  for off in "$@"; do
    node "$BIN" --a=v1nn --b=v1 --pairs=13 --offset="$off" --budget=150 \
      --depth=10 --nn="$NN" --nnWeight=0.2 > "$LOG/ab-repl380-$off.log" 2>&1
  done
}

run_lane 420 472 524 576 &
run_lane 433 485 537 589 &
run_lane 446 498 550 602 &
run_lane 459 511 563 615 &
wait
echo "$(date +%H:%M:%S) 380 局复验全部完成"
