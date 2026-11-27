#!/bin/bash
# 等 w02 全部结束，立刻开第二批 sanity（v1 vs v1），用全新对局区间
set -u
LOG=/data/gitcg/logs4
BIN=/data/gitcg/bin/ab-value.bundle.mjs
cd /data/gitcg || exit 1

echo "$(date +%H:%M:%S) 等待 w02 结束…"
while true; do
  done_count=$(grep -l RESULT "$LOG"/ab-w02-*.log 2>/dev/null | wc -l)
  running=$(pgrep -c -f "w02" || true)
  if [ "$done_count" -ge 4 ] && [ "$running" -eq 0 ]; then
    break
  fi
  sleep 30
done

echo "$(date +%H:%M:%S) w02 结束，启动 sanity2（第二批 v1 vs v1）"
for off in 520 533 546 559; do
  nohup node "$BIN" --a=v1 --b=v1 --pairs=13 --offset="$off" \
    --budget=150 --depth=10 > "$LOG/ab-sanity2-$off.log" 2>&1 &
done
echo "$(date +%H:%M:%S) sanity2 已启动（4 实例 = 104 局）"
