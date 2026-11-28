#!/bin/sh
# ============================================================================
# 七圣召唤工具 · 单文件一键构建（最新源码 → 内置素材 APK）
#
# 对方只需要这一个文件：
#   sh build-gitcg-apk.sh
#
# 脚本会自动完成：
#   1. 检测/安装工具链（Node 22+、pnpm、JDK17、aapt、apksigner、zipalign、d8、android.jar）
#   2. 从 GitHub 拉最新源码（tarball，不需要 git）
#   3. 下载牌组库数据包 + 抓取卡图素材
#   4. 构建 Web → 打 APK → 校验 → 输出安装包
#
# 支持：Ubuntu/Debian（含 proot）、Termux、macOS（已装工具时）、已有工具链的任意 Linux。
# 不支持：MT 管理器的 Android sh（没有 Node/JDK，脚本会提示改用 Termux/proot）。
#
# 可选参数：
#   --out DIR          输出目录（默认 /sdcard/Download/DSH-Go 或 ./out）
#   --work DIR         工作目录（默认 ~/.cache/gitcg-build）
#   --source-dir DIR   用本地源码目录代替下载（开发/测试用）
#   --skip-assets      跳过素材抓取（要求源码里已有素材）
#   --keystore PATH    签名密钥（覆盖安装旧版必须用原密钥）
#   --keep             保留工作目录
#   --check            只打印环境检测，不下载不构建
#   -h, --help
# ============================================================================
set -eu

REPO="${GITCG_REPO:-znbb2223/gitcg-tool}"
BRANCH="${GITCG_BRANCH:-main}"
SRC_URL="https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH"
DATA_URL="https://github.com/znbb2223/gitcg-tool/releases/download/data-7.2.0/data-7.2.0.tar.gz"
NODE_VER="${GITCG_NODE_VER:-v22.14.0}"
NODE_MIRROR="${GITCG_NODE_MIRROR:-https://npmmirror.com/mirrors/node}"
BT_ZIP="https://dl.google.com/android/repository/build-tools_r34-linux.zip"
PLATFORM_ZIP="https://dl.google.com/android/repository/platform-23_r03.zip"

OUT=""
WORK="${GITCG_WORK:-$HOME/.cache/gitcg-build}"
SRC_DIR=""
SKIP_ASSETS=0
ASSETS_SRC=""
DATA_SRC=""
KEEP=0
CHECK=0
SKIP_SYSTEM=0
KEYSTORE_ARG=""

usage() { sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }
log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*"; }
ok() { printf '  [OK] %s\n' "$*"; }
warn() { printf '  [WARN] %s\n' "$*"; }
die() { printf '  [FAIL] %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    --out) shift; OUT=$1 ;;
    --work) shift; WORK=$1 ;;
    --source-dir) shift; SRC_DIR=$1 ;;
    --skip-assets) SKIP_ASSETS=1 ;;
    --assets-dir) shift; ASSETS_SRC=$1 ;;
    --data-dir) shift; DATA_SRC=$1 ;;
    --keystore) shift; KEYSTORE_ARG=$1 ;;
    --keep) KEEP=1 ;;
    --check) CHECK=1 ;;
    --skip-system) SKIP_SYSTEM=1 ;;
    *) die "未知参数：$1（-h 查看帮助）" ;;
  esac
  shift
done

mkdir -p "$WORK"
LOG="$WORK/build.log"
: >"$LOG"
exec 3>&1
# 所有命令输出同时进日志
run() {
  log "  $*"
  "$@" >>"$LOG" 2>&1 || die "命令失败：$*（日志 $LOG）"
}

ARCH=$(uname -m)
OS=$(uname -s)
IS_TERMUX=0
IS_APT=0
[ -n "${PREFIX:-}" ] && case "$PREFIX" in *com.termux*) IS_TERMUX=1 ;; esac
command -v apt-get >/dev/null 2>&1 && IS_APT=1
[ "$OS" = "Darwin" ] && IS_APT=0

TOOLCHAIN="$WORK/toolchain"
mkdir -p "$TOOLCHAIN/bin"

TOKENS=""
find_tool() { command -v "$1" 2>/dev/null || true; }

# ---------- 系统依赖 ----------
install_system() {
  log "[1/8] 系统依赖"
  if command -v java >/dev/null 2>&1 && command -v javac >/dev/null 2>&1 \
     && command -v aapt >/dev/null 2>&1 && command -v apksigner >/dev/null 2>&1 \
     && command -v zipalign >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    ok "系统依赖已齐全，跳过安装"
    return
  fi
  if [ "$IS_TERMUX" = 1 ]; then
    run pkg install -y curl unzip zip xz-utils openjdk-17 aapt apksigner zipalign nodejs-lts
  elif [ "$IS_APT" = 1 ]; then
    SUDO=""
    [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1 && SUDO="sudo"
    run $SUDO apt-get update -qq
    run $SUDO apt-get install -y curl ca-certificates unzip zip xz-utils openjdk-17-jdk-headless \
      aapt apksigner zipalign android-sdk-platform-23
  else
    warn "非 Debian/Termux 环境：跳过系统安装，只做检测"
  fi
}

# ---------- Node ----------
ensure_node() {
  log "[2/8] Node.js"
  NODE=$(find_tool node)
  if [ -n "$NODE" ] && [ "$("$NODE" -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')" -ge 22 ]; then
    ok "已有 node $("$NODE" -v)"
    return
  fi
  case "$ARCH" in
    aarch64|arm64) NARCH=arm64 ;;
    x86_64|amd64) NARCH=x64 ;;
    *) die "不支持的架构：$ARCH" ;;
  esac
  if [ "$OS" = "Darwin" ]; then
    url="$NODE_MIRROR/$NODE_VER/node-$NODE_VER-darwin-$NARCH.tar.gz"
  else
    url="$NODE_MIRROR/$NODE_VER/node-$NODE_VER-linux-$NARCH.tar.xz"
  fi
  log "  下载 Node：$url"
  ( cd "$WORK" && curl -fL --retry 3 -o node.tar.xz "$url" ) >>"$LOG" 2>&1 || die "Node 下载失败"
  tar -xf "$WORK/node.tar.xz" -C "$TOOLCHAIN" >>"$LOG" 2>&1 || die "Node 解压失败"
  mv "$TOOLCHAIN"/node-* "$TOOLCHAIN/node" 2>/dev/null || true
  export PATH="$TOOLCHAIN/node/bin:$PATH"
  ok "Node $($TOOLCHAIN/node/bin/node -v)"
}

ensure_pnpm() {
  log "[3/8] pnpm"
  if command -v pnpm >/dev/null 2>&1; then ok "已有 pnpm $(pnpm -v)"; return; fi
  run npm i -g pnpm --prefix "$TOOLCHAIN"
  export PATH="$TOOLCHAIN/bin:$PATH"
  command -v pnpm >/dev/null 2>&1 || die "pnpm 安装失败"
  ok "pnpm $(pnpm -v)"
}

# ---------- Android 工具链 ----------
SDK_DIR=""; BJ=""; BT_DIR=""; D8=""; AAPT=""; APKSIGNER=""; ZIPALIGN=""

find_android() {
  AAPT=$(find_tool aapt); APKSIGNER=$(find_tool apksigner); ZIPALIGN=$(find_tool zipalign)
  for d in "${ANDROID_SDK:-}" /usr/lib/android-sdk /opt/android/sdk /opt/android; do
    [ -n "$d" ] || continue
    for p in "$d/platforms/android-${ANDROID_PLATFORM:-23}/android.jar" "$d/platforms/android-34/android.jar"; do
      [ -f "$p" ] && { BJ=$p; SDK_DIR=${p%%/platforms/*}; break; }
    done
    [ -n "$BJ" ] && break
  done
  D8=$(find_tool d8)
  if [ -z "$D8" ] || [ ! -x "$D8" ]; then
    for d in "${BUILD_TOOLS:-}" /opt/android/bt/* /usr/lib/android-sdk/build-tools/*; do
      [ -n "$d" ] || continue
      [ -x "$d/d8" ] && { D8="$d/d8"; BT_DIR=$d; break; }
    done
  else
    BT_DIR=$(dirname "$D8")
  fi
}

ensure_android() {
  log "[4/8] Android 打包工具"
  find_android
  if [ -z "$BJ" ]; then
    warn "缺 android.jar，尝试下载 platform-23"
    ( cd "$WORK" && curl -fL --retry 3 -o platform.zip "$PLATFORM_ZIP" ) >>"$LOG" 2>&1 || die "android.jar 下载失败"
    mkdir -p "$TOOLCHAIN/sdk/platforms"
    unzip -q "$WORK/platform.zip" -d "$WORK/platform-tmp" >>"$LOG" 2>&1
    jar=$(find "$WORK/platform-tmp" -name android.jar | head -1)
    [ -n "$jar" ] || die "platform 包里没有 android.jar"
    mkdir -p "$TOOLCHAIN/sdk/platforms/android-23"
    cp "$jar" "$TOOLCHAIN/sdk/platforms/android-23/android.jar"
    BJ="$TOOLCHAIN/sdk/platforms/android-23/android.jar"
    SDK_DIR="$TOOLCHAIN/sdk"
  fi
  if [ -z "$AAPT" ] || [ -z "$APKSIGNER" ] || [ -z "$ZIPALIGN" ]; then
    die "缺 aapt/apksigner/zipalign：请 apt install aapt apksigner zipalign（或 Termux pkg install）"
  fi
  if [ -z "$D8" ]; then
    warn "缺 d8，下载 build-tools 并生成 java 包装"
    ( cd "$WORK" && curl -fL --retry 3 -o bt.zip "$BT_ZIP" ) >>"$LOG" 2>&1 || die "build-tools 下载失败"
    unzip -o -q "$WORK/bt.zip" 'android-14/lib/d8.jar' -d "$TOOLCHAIN/bt-tmp" >>"$LOG" 2>&1
    mkdir -p "$TOOLCHAIN/bt/lib"
    cp "$TOOLCHAIN/bt-tmp/android-14/lib/d8.jar" "$TOOLCHAIN/bt/lib/d8.jar"
    cat >"$TOOLCHAIN/bt/d8" <<EOF
#!/bin/sh
exec java -cp "$TOOLCHAIN/bt/lib/d8.jar" com.android.tools.r8.D8 "\$@"
EOF
    chmod +x "$TOOLCHAIN/bt/d8"
    D8="$TOOLCHAIN/bt/d8"; BT_DIR="$TOOLCHAIN/bt"
  fi
  ok "aapt=$AAPT d8=$D8 java.jar=$BJ"
}

check_report() {
  log "环境检测"
  printf '  系统: %s %s%s\n' "$OS" "$ARCH" "$([ "$IS_TERMUX" = 1 ] && echo ' (Termux)')"
  for t in node pnpm java javac aapt apksigner zipalign; do
    v=$(find_tool "$t"); printf '  %-10s %s\n' "$t" "${v:-缺失}"
  done
  find_android
  printf '  %-10s %s\n' d8 "${D8:-缺失}"
  printf '  %-10s %s\n' android.jar "${BJ:-缺失}"
  printf '  输出目录: %s\n' "$(resolve_out)"
}

resolve_out() {
  if [ -n "$OUT" ]; then printf '%s' "$OUT"; return; fi
  if [ -d /sdcard/Download/DSH-Go ]; then printf '%s' /sdcard/Download/DSH-Go; else printf '%s' "$PWD/out"; fi
}

# ---------- 源码 ----------
download_source() {
  log "[5/8] 拉取最新源码（$BRANCH）"
  if [ -n "$SRC_DIR" ]; then
    [ -d "$SRC_DIR" ] || die "--source-dir 不存在：$SRC_DIR"
    SRC="$SRC_DIR"; ok "使用本地源码：$SRC"; return
  fi
  ( cd "$WORK" && curl -fL --retry 3 -o src.tar.gz "$SRC_URL" ) >>"$LOG" 2>&1 || die "源码下载失败"
  rm -rf "$WORK/src"; mkdir -p "$WORK/src"
  tar -xzf "$WORK/src.tar.gz" -C "$WORK/src" --strip-components=1 >>"$LOG" 2>&1 || die "源码解压失败"
  SRC="$WORK/src"
  ok "源码：$SRC"
}

# ---------- 数据 + 素材 ----------
prepare_data_assets() {
  log "[6/8] 牌组库数据 + 卡图素材"
  DATA="$SRC/packages/standalone/public/data"
  ASSETS="$SRC/packages/standalone/public/assets-local"
  if [ -n "$DATA_SRC" ]; then
    [ -d "$DATA_SRC" ] || die "--data-dir 不存在：$DATA_SRC"
    mkdir -p "$DATA"; cp -a "$DATA_SRC"/. "$DATA"/
    ok "使用本地数据：$DATA_SRC"
  elif [ ! -f "$DATA/deck-library.json" ]; then
    log "  下载牌组库数据包"
    ( cd "$WORK" && curl -fL --retry 3 -o data.tar.gz "$DATA_URL" ) >>"$LOG" 2>&1 || die "数据包下载失败"
    rm -rf "$WORK/data-tmp"; mkdir -p "$WORK/data-tmp"
    tar -xzf "$WORK/data.tar.gz" -C "$WORK/data-tmp" >>"$LOG" 2>&1 || die "数据包解压失败"
    mkdir -p "$DATA"
    if [ -d "$WORK/data-tmp/data" ]; then cp -a "$WORK/data-tmp/data"/. "$DATA"/; else cp -a "$WORK/data-tmp"/. "$DATA"/; fi
    ok "数据：$(ls "$DATA" | wc -l) 个文件"
  else
    ok "数据已存在"
  fi

  if [ -n "$ASSETS_SRC" ]; then
    [ -d "$ASSETS_SRC" ] || die "--assets-dir 不存在：$ASSETS_SRC"
    rm -rf "$ASSETS"; mkdir -p "$(dirname "$ASSETS")"; cp -a "$ASSETS_SRC" "$ASSETS"
    ok "使用本地素材：$ASSETS_SRC"
    return
  fi
  if [ "$SKIP_ASSETS" = 1 ]; then
    [ -d "$ASSETS" ] || die "--skip-assets 但源码里没有 assets-local"
    ok "跳过素材抓取"
    return
  fi
  n=$(find "$ASSETS" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "${n:-0}" -ge 10000 ]; then ok "素材已存在（$n 个）"; return; fi
  log "  抓取卡图/数据（约 150MB，慢但只需一次）"
  ( cd "$SRC/packages/standalone" \
      && node scripts/download-assets.mjs >>"$LOG" 2>&1 \
      && node scripts/download-datum.mjs >>"$LOG" 2>&1 \
      && node scripts/download-full.mjs >>"$LOG" 2>&1 ) || warn "全尺寸图抓取失败（可继续）"
  n=$(find "$ASSETS" -type f 2>/dev/null | wc -l | tr -d ' ')
  [ "${n:-0}" -ge 10000 ] || die "素材仍然不完整（$n 个），检查网络后重试"
  ok "素材：$n 个文件"
}

# ---------- 构建 ----------
build_apk() {
  log "[7/8] 构建 + 打包（可能 2~5 分钟）"
  out=$(resolve_out); mkdir -p "$out"
  export ANDROID_SDK="$SDK_DIR" BUILD_TOOLS="$BT_DIR" ANDROID_PLATFORM=23
  export PUPPETEER_SKIP_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  set -- --skip-fetch --out "$out"
  [ -n "$KEYSTORE_ARG" ] && set -- "$@" --keystore "$KEYSTORE_ARG"
  ( cd "$SRC" && sh build-oneclick.sh "$@" ) >>"$LOG" 2>&1 || die "构建失败（日志 $LOG）"
  APK=$(ls -t "$out"/*.apk 2>/dev/null | head -1)
  [ -n "$APK" ] || die "构建结束但输出目录没有 APK"
  log "[8/8] 完成"
  printf '  安装包 : %s\n' "$APK"
  printf '  体积   : %s\n' "$(du -h "$APK" | cut -f1)"
  printf '  SHA256 : %s\n' "$(sha256sum "$APK" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$APK" | cut -d' ' -f1)"
  printf '  日志   : %s\n' "$LOG"
  printf '  提示   : 覆盖安装旧版必须用原签名密钥（--keystore）\n'
}

# ---------- 主流程 ----------
T0=$(date +%s)
[ "$CHECK" = 1 ] && { check_report; exit 0; }

log "七圣召唤工具 · 单文件构建"
[ "$SKIP_SYSTEM" = 1 ] || install_system
ensure_node
ensure_pnpm
ensure_android
download_source
prepare_data_assets
build_apk

if [ "$KEEP" = 0 ] && [ -z "$SRC_DIR" ]; then
  log "清理工作目录（--keep 可保留）"
  rm -rf "$WORK/src" "$WORK"/*.tar.gz "$WORK"/*.zip "$WORK/data-tmp" "$WORK/platform-tmp" "$WORK/bt-tmp" 2>/dev/null || true
fi
log "总用时 $(( $(date +%s) - T0 ))s"
