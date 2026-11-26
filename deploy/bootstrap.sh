#!/bin/bash
# 服务器端：装 Node 20 + 建目录（走国内镜像，无需 GitHub）
set -e
NODE_VER="${NODE_VER:-v20.18.1}"
MIRROR="https://npmmirror.com/mirrors/node"

echo "== 系统 =="
cat /etc/os-release | head -2
echo "== 装依赖 =="
if ! command -v curl >/dev/null; then
  apt-get update -qq && apt-get install -y -qq curl xz-utils
fi

if command -v node >/dev/null && [ "$(node -v | cut -c1-3)" = "v20" ]; then
  echo "Node 已存在: $(node -v)"
else
  echo "== 下载 Node ${NODE_VER} =="
  cd /tmp
  curl -fsSL -o node.tar.xz "${MIRROR}/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz"
  tar -xf node.tar.xz
  mv "node-${NODE_VER}-linux-x64" /usr/local/node
  ln -sf /usr/local/node/bin/node /usr/local/bin/node
  ln -sf /usr/local/node/bin/npm /usr/local/bin/npm
  echo "Node: $(node -v) / npm $(npm -v)"
fi

mkdir -p /data/gitcg/traj /data/gitcg/logs
echo "== 就绪 =="
nproc
free -h | head -2
df -h / | tail -1
