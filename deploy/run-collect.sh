#!/bin/bash
# 服务器端：并行采集，可断点续跑
# 用法: ./run-collect.sh <总局数> [并行数]
set -e
TOTAL="${1:?用法: ./run-collect.sh <总局数> [并行数]}"
WORKERS="${2:-$(nproc)}"
OUT=/data/gitcg/traj
LOG=/data/gitcg/logs
mkdir -p "$OUT" "$LOG"

# 依据已完成进度计算每片还要跑多少
echo "== 启动 $WORKERS 个分片，共 $TOTAL 局 =="
for i in $(seq 0 $((WORKERS-1))); do
  nohup node /data/gitcg/bin/collect.bundle.mjs \
    --games "$TOTAL" --shard "$i" --shards "$WORKERS" \
    --out "$OUT" --mix mixed --sample 3 \
    > "$LOG/shard-$i.log" 2>&1 &
  echo "  分片 $i → $LOG/shard-$i.log"
done

echo "== 已启动，查看进度: tail -f $LOG/shard-0.log =="
