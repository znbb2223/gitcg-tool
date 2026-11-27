#!/bin/bash
# 决策记忆实测：A 挂记忆 vs B 不挂，同 v1 搜索
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done
echo "$(date +%H:%M:%S) 启动 memory 实验"
for off in 852 865 878 891; do
  node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" --budget=150 --depth=10 --memory \
    > "$LOG/ab-mem-$off.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
