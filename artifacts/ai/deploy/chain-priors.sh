#!/bin/bash
# 两组先验实验：静态先验（牌/角色经验内置）+ 学习先验（2 万局统计出来的单卡胜率）
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin2/ab-value.bundle.mjs
cd /data/gitcg || exit 1
while pgrep -f "[a]b-value" >/dev/null; do sleep 20; done

echo "$(date +%H:%M:%S) 启动 static-priors（A 关先验 vs B 开先验，400 局）"
for off in 900 918 936 954; do
  node "$BIN" --a=heurnp --b=heur --pairs=50 --offset="$off" \
    --lib=/data/gitcg/data/deck-library.json > "$LOG/ab-priorstatic-$off.log" 2>&1 &
done
wait

echo "$(date +%H:%M:%S) 启动 learned-priors（A 带学习先验 vs B 不带，400 局）"
for off in 980 998 1016 1034; do
  node "$BIN" --a=heur --b=heur --pairs=50 --offset="$off" --priors=/data/gitcg/data/card-priors.json \
    --lib=/data/gitcg/data/deck-library.json > "$LOG/ab-priorlearn-$off.log" 2>&1 &
done
wait
echo "done $(date +%H:%M:%S)"
