#!/bin/bash
# 能力阶梯基线：搜索(v1) vs 纯启发式，104 局
# 用 bin2 的新 bundle，因为 heur 模式是今天才加的
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do
  sleep 20
done
echo "$(date +%H:%M:%S) 队列空闲，启动 heur-baseline（A=搜索 v1 vs B=纯启发式）"
for off in 800 813 826 839; do
  node "$BIN" --a=v1 --b=heur --pairs=13 --offset="$off" \
    --budget=150 --depth=10 > "$LOG/ab-heur-$off.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
