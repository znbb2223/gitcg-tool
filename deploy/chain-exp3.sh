#!/bin/bash
# 等实验 2 全部结束后，自动开实验 3（v1+nn vs v1，4 实例并行）
set -u
LOG=/data/gitcg/logs4
cd /data/gitcg || exit 1

# 等所有 ab-value 实验进程退出
while pgrep -f "[a]b-value" >/dev/null; do
  sleep 30
done
echo "$(date +%H:%M:%S) 实验2结束，启动实验3"

for off in 0 13 26 39; do
  nohup node bin/ab-value.bundle.mjs \
    --a=v1nn --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 --nn="$LOG/../data/nn-v1.json" \
    > "$LOG/ab-exp3-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) 实验3 已启动（4 实例）"
