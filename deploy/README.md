# 云端跑批部署

把「自对弈采集轨迹」搬到云端跑。服务器只需要 Node 20，**不需要 npm、不需要 GitHub**。

## 一次性准备（本机）

```bash
# 1. 打包采集脚本（单文件，含引擎与卡牌数据）
node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild/bin/esbuild \
  packages/ai/scripts/collect-trajectories.mjs \
  --bundle --platform=node --format=esm --target=node20 \
  --outfile=dist-collect/collect.bundle.mjs
```

## 部署流程

```bash
# 1. 服务器装 Node（走 npmmirror，不翻墙）
scp -i ~/.ssh/id_ed25519 deploy/bootstrap.sh root@<IP>:/root/
ssh -i ~/.ssh/id_ed25519 root@<IP> "bash /root/bootstrap.sh"

# 2. 传 bundle + 牌组库（约 17MB）
HOST=<IP> bash deploy/sync-up.sh

# 3. 先试跑 200 局测速（约 1~2 分钟）
ssh -i ~/.ssh/id_ed25519 root@<IP> "cd /data/gitcg && ./run-collect.sh 200 2"

# 4. 正式跑（4 万局，4 并行）
ssh -i ~/.ssh/id_ed25519 root@<IP> "cd /data/gitcg && ./run-collect.sh 40000 4"

# 5. 拉回结果
HOST=<IP> bash deploy/sync-back.sh
```

## 断点续跑

采集脚本按分片记录 `progress-<shard>.json`，重跑同一条命令会**自动跳过已完成的局数**。
抢占式实例被回收后，重开一台、挂回原磁盘（或重传），再执行同一条 `run-collect.sh` 即可。

## 输出

```
/data/gitcg/traj/shard-0.jsonl   每行一条样本 {"s":座位,"w":胜负,"t":回合,"f":[22维特征]}
/data/gitcg/traj/progress-0.json 该分片进度
```

## 训练（本机或服务器）

```bash
python3 packages/ai/tools/train_value.py --data 'collected/traj/*.jsonl' --out nn.json --epochs 30
```
