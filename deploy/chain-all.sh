#!/bin/bash
# 实验队列：实验4 → J(同配置自打) → A1(nnWeight 0.2) → A2(nnWeight 0.7) → B(预算 80ms)
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

phase() {
  local name="$1"; shift
  local base="$1"; shift
  local a="$1"; shift
  local b="$1"; shift
  local budget="$1"; shift
  local weight="${1:-0.45}"
  wait_idle
  echo "$(date +%H:%M:%S) 启动 $name（a=$a b=$b budget=$budget base=$base）"
  for i in 0 1 2 3; do
    local off=$((base + i * 13))
    nohup node "$BIN" --a="$a" --b="$b" --pairs=13 --offset="$off" \
      --budget="$budget" --depth=10 --nn="$NN" --nnWeight="$weight" \
      > "$LOG/ab-$name-$off.log" 2>&1 &
  done
}

phase "exp4"   52  v2    v1    150
phase "sanity" 104 v1    v1    150
phase "w02"    156 v1nn  v1    150 0.2
phase "w07"    208 v1nn  v1    150 0.7
phase "bud80"  260 v1nn  v1    80  0.45
echo "$(date +%H:%M:%S) 全部实验队列执行完毕"
