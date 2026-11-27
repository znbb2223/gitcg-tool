#!/bin/bash
# 等现有实验队列全部结束，再跑「加深搜索」实验
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
cd /data/gitcg || exit 1

# 等 chain-all 与它在跑的子进程都结束
while pgrep -f "chain-all" >/dev/null || pgrep -f "[a]b-value" >/dev/null; do
  sleep 30
done
echo "$(date +%H:%M:%S) 队列空闲，启动 deep30（A=深度30 vs B=深度10）"
for off in 364 377 390 403; do
  nohup node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=30 --depthB=10 \
    > "$LOG/ab-deep30-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) deep30 已启动"
