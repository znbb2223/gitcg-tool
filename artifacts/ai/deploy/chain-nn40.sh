#!/bin/bash
# 等 bud80 结束后，插队跑 40 维价值网络的 A/B
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
NN=/data/gitcg/data/nn-40d.json
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do
  sleep 20
done
echo "$(date +%H:%M:%S) 队列空闲，启动 nn40（40 维价值网络 0.45 vs v1）"
for off in 312 325 338 351; do
  nohup node "$BIN" --a=v1nn --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 --nn="$NN" --nnWeight=0.45 \
    > "$LOG/ab-nn40-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) nn40 已启动"
