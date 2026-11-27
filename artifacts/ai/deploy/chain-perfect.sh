#!/bin/bash
# 明牌实验：A 开透视 vs B 不透视，同模型同权重，只改隐藏信息这一个变量
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do
  sleep 30
done
echo "$(date +%H:%M:%S) 队列空闲，启动 perfect-info（A 明牌 vs B 正常）"
for off in 620 633 646 659; do
  nohup node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 --perfectInfo \
    > "$LOG/ab-perfect-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) perfect-info 已启动"
