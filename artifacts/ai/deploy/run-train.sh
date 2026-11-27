#!/bin/bash
# 用全部 2 万局数据训练 40 维价值网络；setsid 挂起，SSH 断了也不影响
cd /data/gitcg || exit 1
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1
echo "start $(date +%H:%M:%S)" >> logs4/train-593k.log
python3 -u bin2/train_value.py --data '/data/gitcg/traj-v3/shard-*.jsonl.gz' \
  --out /data/gitcg/data/nn-40d-593k.json --epochs 30 >> logs4/train-593k.log 2>&1
echo "done $(date +%H:%M:%S)" >> logs4/train-593k.log
