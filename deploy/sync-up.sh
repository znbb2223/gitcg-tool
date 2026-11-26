#!/bin/bash
# 本机 → 服务器：传采集 bundle + 牌组库 + 脚本
set -e
HOST="${HOST:?需要 HOST=<公网IP>}"
USER_="${USER_:-root}"
KEY="${KEY:-/root/workspace/.ssh/id_ed25519}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $USER_@$HOST"

echo "== 确保服务器目录 =="
$SSH "mkdir -p /data/gitcg/bin /data/gitcg/data"

echo "== 传 bundle（7MB） =="
scp -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  /root/workspace/gi-tcg/dist-collect/collect.bundle.mjs "$USER_@$HOST:/data/gitcg/bin/"

echo "== 传牌组库（9.6MB） =="
scp -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  /root/workspace/gi-tcg/packages/standalone/public/data/deck-library.json "$USER_@$HOST:/data/gitcg/data/"

echo "== 传运行脚本 =="
scp -i "$KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  /root/workspace/gi-tcg/deploy/run-collect.sh "$USER_@$HOST:/data/gitcg/"

$SSH "chmod +x /data/gitcg/run-collect.sh; ls -lh /data/gitcg/bin /data/gitcg/data"
