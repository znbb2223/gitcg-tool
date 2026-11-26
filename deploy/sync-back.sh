#!/bin/bash
# 服务器 → 本机：拉回样本与进度
set -e
HOST="${HOST:?需要 HOST=<公网IP>}"
USER_="${USER_:-root}"
KEY="${KEY:-/root/workspace/.ssh/id_ed25519}"
DEST="${DEST:-/root/workspace/gi-tcg/collected}"
mkdir -p "$DEST"

rsync -az --info=progress2 -e "ssh -i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  "$USER_@$HOST:/data/gitcg/traj/" "$DEST/traj/"
rsync -az -e "ssh -i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  "$USER_@$HOST:/data/gitcg/logs/" "$DEST/logs/"

echo "== 已拉回 =="
du -sh "$DEST"/traj "$DEST"/logs 2>/dev/null
wc -l "$DEST"/traj/*.jsonl 2>/dev/null | tail -1
