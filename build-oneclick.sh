#!/bin/sh
# ============================================================================
# 七圣召唤工具 · 一键构建（素材 → Web → APK）
#
# 用法：
#   sh build-oneclick.sh                # 全流程：抓素材 → 构建 → 打 APK
#   sh build-oneclick.sh --check        # 只体检环境和工具链
#   sh build-oneclick.sh --deps         # 尝试自动安装缺失依赖（apt / pkg）
#   sh build-oneclick.sh --from-apk X.apk  # 不联网：从旧 APK 提取素材后重建
#   sh build-oneclick.sh --web-only     # 只出 Web 产物 zip，不打 APK
#
# 产物默认放到 /sdcard/Download/DSH-Go/（手机）或 ./out/（电脑）。
#
# 支持环境：Ubuntu/Debian proot、Termux、普通 Linux、macOS（无 aapt 时只能 --web-only）。
# MT 管理器的内置终端只有 Android sh（无 Node/JDK/aapt），点运行会先做体检并给出
# Termux 安装命令；要真正出 APK 请在 Termux 或 proot Linux 里跑同一脚本。
# ============================================================================
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$SCRIPT_DIR
STAMP=$(date +%Y%m%d-%H%M%S)
LOG="$ROOT/build-oneclick-$STAMP.log"

# ---------------- 参数 ----------------
MODE_CHECK=0
MODE_DEPS=0
MODE_WEB_ONLY=0
MODE_CLEAN=0
MODE_VERIFY=1
FETCH=auto
FORCE_FETCH=0
FROM_APK=""
DECK_SRC=""
OUT_DIR=""
KEYSTORE_ARG=""
KS_PASS=${KS_PASS:-gitcgapk}
SKIP_FULL_IMAGES=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    --check) MODE_CHECK=1 ;;
    --deps) MODE_DEPS=1 ;;
    --web-only) MODE_WEB_ONLY=1 ;;
    --clean) MODE_CLEAN=1 ;;
    --no-verify) MODE_VERIFY=0 ;;
    --skip-fetch) FETCH=0 ;;
    --force-fetch) FORCE_FETCH=1; FETCH=1 ;;
    --skip-full-images) SKIP_FULL_IMAGES=1 ;;
    --from-apk) shift; FROM_APK=$1 ;;
    --deck-lib) shift; DECK_SRC=$1 ;;
    --out) shift; OUT_DIR=$1 ;;
    --keystore) shift; KEYSTORE_ARG=$1 ;;
    --ks-pass) shift; KS_PASS=$1 ;;
    *) echo "未知参数: $1（-h 看帮助）" >&2; exit 2 ;;
  esac
  shift
done

# ---------------- 输出与日志 ----------------
if [ -t 1 ]; then
  C_OK=$(printf '\033[32m'); C_WARN=$(printf '\033[33m'); C_ERR=$(printf '\033[31m'); C_OFF=$(printf '\033[0m')
else
  C_OK=; C_WARN=; C_ERR=; C_OFF=
fi
step=0
STEP_START=$(date +%s)
log() { printf '%s %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "$LOG"; }
ok() { printf '%s[OK]%s %s\n' "$C_OK" "$C_OFF" "$*" | tee -a "$LOG"; }
warn() { printf '%s[WARN]%s %s\n' "$C_WARN" "$C_OFF" "$*" | tee -a "$LOG"; }
fail() { printf '%s[FAIL]%s %s\n' "$C_ERR" "$C_OFF" "$*" | tee -a "$LOG"; exit 1; }
start_step() { step=$((step + 1)); STEP_START=$(date +%s); log "[$step] $*"; }
end_step() { log "    └ 用时 $(( $(date +%s) - STEP_START ))s"; }

# ---------------- 环境探测 ----------------
IS_TERMUX=0
IS_ANDROID=0
IS_APT=0
[ -n "${PREFIX:-}" ] && case "$PREFIX" in *com.termux*) IS_TERMUX=1 ;; esac
[ -f /system/bin/getprop ] && IS_ANDROID=1
command -v apt-get >/dev/null 2>&1 && IS_APT=1

OS_NAME=$(uname -s 2>/dev/null || echo unknown)
ARCH=$(uname -m 2>/dev/null || echo unknown)

NODE=""
PNPM=""
JAVA=""
JAVAC=""
D8=""
AAPT=""
APKSIGNER=""
ZIPALIGN=""
AJ=""
SDK_DIR=""
BT_DIR=""

find_d8() {
  if command -v d8 >/dev/null 2>&1; then D8=$(command -v d8); BT_DIR=$(dirname "$D8"); return; fi
  for d in "${BUILD_TOOLS:-}" /opt/android/bt/* /opt/android/build-tools/* /usr/lib/android-sdk/build-tools/*; do
    [ -n "$d" ] || continue
    if [ -x "$d/d8" ]; then D8="$d/d8"; BT_DIR=$d; return; fi
    if [ -x "$d/d8.bat" ]; then D8="$d/d8.bat"; BT_DIR=$d; return; fi
  done
}

find_jar() {
  for d in "${ANDROID_SDK:-}" /usr/lib/android-sdk /opt/android/sdk /opt/android "${ANDROID_HOME:-}"; do
    [ -n "$d" ] || continue
    for p in "$d/platforms/android-${ANDROID_PLATFORM:-23}/android.jar" "$d/platforms/android-34/android.jar" "$d/platforms/android-33/android.jar"; do
      [ -f "$p" ] && { AJ=$p; SDK_DIR=${p%%/platforms/*}; [ -d "$SDK_DIR" ] || SDK_DIR=$(dirname "$(dirname "$(dirname "$p")")"); return; }
    done
  done
}

detect() {
  NODE=$(command -v node 2>/dev/null || true)
  PNPM=$(command -v pnpm 2>/dev/null || true)
  JAVA=$(command -v java 2>/dev/null || true)
  JAVAC=$(command -v javac 2>/dev/null || true)
  AAPT=$(command -v aapt 2>/dev/null || true)
  APKSIGNER=$(command -v apksigner 2>/dev/null || true)
  ZIPALIGN=$(command -v zipalign 2>/dev/null || true)
  find_d8
  find_jar
}

node_major() {
  "$NODE" -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo 0
}

npm_install_hint() {
  cat <<EOF
缺少依赖。按你的环境二选一：
  Termux：
    pkg install -y nodejs-lts git openjdk-17 aapt apksigner zipalign unzip zip curl
  Ubuntu/Debian(proot)：
    apt-get update && apt-get install -y nodejs npm openjdk-17-jdk-headless \\
      aapt apksigner zipalign unzip zip curl
  然后：npm i -g pnpm
  还缺 android.jar 时：把 android-sdk 放到 /usr/lib/android-sdk，或设 ANDROID_SDK 指向它。
  MT 管理器内置终端没有 Node/JDK/aapt，无法直接出 APK，请改用 Termux 跑本脚本。
EOF
}

install_deps() {
  [ "$MODE_DEPS" = 1 ] || fail "依赖缺失。加 --deps 尝试自动安装，或按 -h 手动装（详细见日志）"
  if [ "$IS_APT" = 1 ]; then
    start_step "自动安装依赖（apt）"
    apt-get update -qq || warn "apt-get update 失败，继续尝试安装"
    apt-get install -y openjdk-17-jdk-headless aapt apksigner zipalign unzip zip curl >>"$LOG" 2>&1 || warn "apt 安装部分失败"
    command -v node >/dev/null 2>&1 || apt-get install -y nodejs npm >>"$LOG" 2>&1 || true
    command -v pnpm >/dev/null 2>&1 || npm i -g pnpm >>"$LOG" 2>&1 || true
    end_step
  elif [ "$IS_TERMUX" = 1 ]; then
    start_step "自动安装依赖（pkg）"
    pkg install -y nodejs-lts git openjdk-17 aapt apksigner zipalign unzip zip curl >>"$LOG" 2>&1 || warn "pkg 安装部分失败"
    command -v pnpm >/dev/null 2>&1 || npm i -g pnpm >>"$LOG" 2>&1 || true
    end_step
  else
    npm_install_hint | tee -a "$LOG"
    fail "当前环境没有包管理器，无法自动装"
  fi
  detect
}

require_node() {
  [ -n "$NODE" ] || return 1
  [ "$(node_major)" -ge 22 ]
}

check_report() {
  printf '%s\n' "==== 构建环境体检 ====" | tee -a "$LOG"
  printf '  系统      : %s %s%s%s\n' "$OS_NAME" "$ARCH" \
    "$([ "$IS_ANDROID" = 1 ] && echo ' (Android)')" "$([ "$IS_TERMUX" = 1 ] && echo ' (Termux)')" | tee -a "$LOG"
  printf '  Node      : %s%s\n' "${NODE:-缺失}" "$([ -n "$NODE" ] && echo " ($(node_major 2>/dev/null || echo '?'))")" | tee -a "$LOG"
  printf '  pnpm      : %s\n' "${PNPM:-缺失}" | tee -a "$LOG"
  printf '  JDK       : %s%s\n' "${JAVA:-缺失}" "$([ -n "$JAVAC" ] && echo ' (javac 有)')" | tee -a "$LOG"
  printf '  aapt      : %s\n' "${AAPT:-缺失}" | tee -a "$LOG"
  printf '  d8        : %s\n' "${D8:-缺失}" | tee -a "$LOG"
  printf '  apksigner : %s\n' "${APKSIGNER:-缺失}" | tee -a "$LOG"
  printf '  zipalign  : %s\n' "${ZIPALIGN:-缺失}" | tee -a "$LOG"
  printf '  android.jar: %s\n' "${AJ:-缺失}" | tee -a "$LOG"
  printf '  输出目录  : %s\n' "$(resolve_out)" | tee -a "$LOG"
  printf '  日志      : %s\n' "$LOG" | tee -a "$LOG"
  if [ "$IS_ANDROID" = 1 ] && [ "$IS_TERMUX" = 0 ] && [ -z "$NODE" ]; then
    warn "这里像 Android 原生 sh（MT/文件管理器终端）：没有 Node，无法构建。"
    npm_install_hint | tee -a "$LOG"
  fi
  if [ -n "$NODE" ] && [ -n "$PNPM" ] && [ -n "$JAVA" ] && [ -n "$AAPT" ] && [ -n "$D8" ] && [ -n "$APKSIGNER" ] && [ -n "$ZIPALIGN" ] && [ -n "$AJ" ]; then
    ok "全流程依赖齐全，可以出 APK"
    return 0
  fi
  warn "只能跑部分流程（缺的项见上）：至少需要 Node≥22 + pnpm 才能构建 Web"
}

# ---------------- 输出目录 ----------------
resolve_out() {
  if [ -n "$OUT_DIR" ]; then printf '%s' "$OUT_DIR"; return; fi
  if [ -d /sdcard/Download/DSH-Go ]; then printf '%s' "/sdcard/Download/DSH-Go"; return; fi
  printf '%s' "$ROOT/out"
}

# ---------------- 依赖安装（JS） ----------------
ensure_js_deps() {
  MARK="$ROOT/node_modules/.oneclick-install-ok"
  if [ ! -f "$MARK" ] || [ "$ROOT/pnpm-lock.yaml" -nt "$MARK" ]; then
    start_step "安装 JS 依赖"
    # 手机/容器环境：跳过 puppeteer 的 Chromium 下载（arm64 会失败，且构建不需要）
    export PUPPETEER_SKIP_DOWNLOAD=1
    export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
    export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
    if ! ( cd "$ROOT" && pnpm install --config.package-import-method=copy ) >>"$LOG" 2>&1; then
      warn "依赖安装失败，尝试忽略生命周期脚本重装"
      ( cd "$ROOT" && pnpm install --config.package-import-method=copy --ignore-scripts ) >>"$LOG" 2>&1 \
        || fail "pnpm install 失败（详见 $LOG）"
    fi
    touch "$MARK"
    end_step
  else
    log "    JS 依赖已就绪，跳过"
  fi
}

# ---------------- 素材 ----------------
ASSETS_DIR="$ROOT/packages/standalone/public/assets-local"
DATA_DIR="$ROOT/packages/standalone/public/data"

count_files() { find "$1" -type f 2>/dev/null | wc -l | tr -d ' '; }

assets_ready() {
  [ -d "$ASSETS_DIR" ] || return 1
  [ "$(count_files "$ASSETS_DIR")" -ge 10000 ] || return 1
  [ -f "$ASSETS_DIR/ui/ChessboardBackground.webp" ] || [ -f "$ASSETS_DIR/ui/ChessboardBackground-20x9.webp" ] || return 1
  return 0
}

data_ready() { [ -f "$DATA_DIR/deck-library.json" ]; }

extract_from_apk() {
  apk=$1
  [ -f "$apk" ] || fail "找不到 APK: $apk"
  start_step "从旧 APK 提取素材：$apk"
  tmp="$ROOT/.oneclick-extract"
  rm -rf "$tmp"; mkdir -p "$tmp/assets"
  unzip -q -o "$apk" 'assets/web/assets-local/*' 'assets/web/data/*' -d "$tmp" >>"$LOG" 2>&1 || fail "解包失败：$apk"
  rm -rf "$ASSETS_DIR" "$DATA_DIR"
  mkdir -p "$ROOT/packages/standalone/public"
  mv "$tmp/assets/web/assets-local" "$ASSETS_DIR"
  mv "$tmp/assets/web/data" "$DATA_DIR"
  rm -rf "$tmp"
  end_step
  ok "从 APK 提取完成：素材 $(count_files "$ASSETS_DIR") 个文件，数据 $(count_files "$DATA_DIR") 个文件"
}

fetch_assets() {
  start_step "抓取卡面 / 数据 / 界面素材（网络）"
  ( cd "$ROOT/packages/standalone" \
      && node scripts/download-assets.mjs >>"$LOG" 2>&1 \
      && node scripts/download-datum.mjs >>"$LOG" 2>&1 ) || fail "素材抓取失败（详见 $LOG）"
  if [ "$SKIP_FULL_IMAGES" = 0 ]; then
    ( cd "$ROOT/packages/standalone" && node scripts/download-full.mjs >>"$LOG" 2>&1 ) \
      || warn "全尺寸图抓取失败（可忽略，详情见日志）"
  fi
  end_step
  assets_ready || fail "素材仍不完整（$ASSETS_DIR）"
  ok "素材就绪：$(count_files "$ASSETS_DIR") 个文件"
}

ensure_data() {
  data_ready && { log "    牌组库数据已就绪，跳过"; return; }
  if [ -n "$DECK_SRC" ]; then
    [ -f "$DECK_SRC" ] || fail "--deck-lib 指向的文件不存在：$DECK_SRC"
    mkdir -p "$DATA_DIR"
    cp "$DECK_SRC" "$DATA_DIR/deck-library.json"
    ok "已使用指定牌组库：$DECK_SRC"
    return
  fi
  # 自动找：任意一个包含 deck-library.json 的 data 目录
  for d in \
    "$ROOT/android/dist-lab/data" \
    /sdcard/Download/DSH-Go/服务器备份 \
    /sdcard/Download/DSH-Go \
    "$ROOT/../apkcheck" \
    /tmp/web-full/data; do
    if [ -f "$d/deck-library.json" ]; then
      mkdir -p "$DATA_DIR"
      cp "$d"/*.json "$DATA_DIR"/ 2>/dev/null || cp "$d/deck-library.json" "$DATA_DIR/"
      ok "已找到牌组库数据：$d"
      return
    fi
  done
  fail "缺牌组库 deck-library.json。用 --deck-lib 指定，或 --from-apk 从旧包提取；牌组库需发行包/备份提供，仓库不内置"
}

# ---------------- 构建 Web ----------------
build_web() {
  start_step "构建 Web（按依赖拓扑：typings → data/core → ui → standalone）"
  # 只写 4 个 filter 会漏掉 @gi-tcg/typings 等依赖；`...` 让 pnpm 按依赖顺序构建
  if ! ( cd "$ROOT" && pnpm --filter "@gi-tcg/standalone..." build ) >>"$LOG" 2>&1; then
    warn "拓扑构建失败，回退到显式顺序"
    ( cd "$ROOT" \
        && pnpm --filter @gi-tcg/typings build >>"$LOG" 2>&1 \
        && pnpm --filter @gi-tcg/assets-manager build >>"$LOG" 2>&1 \
        && pnpm --filter @gi-tcg/web-ui-core build >>"$LOG" 2>&1 \
        && pnpm --filter @gi-tcg/deck-builder build >>"$LOG" 2>&1 \
        && pnpm --filter @gi-tcg/standalone build >>"$LOG" 2>&1 ) \
      || fail "Web 构建失败（见 $LOG）"
  fi
  DIST="$ROOT/packages/standalone/dist"
  [ -f "$DIST/hub.html" ] || fail "构建产物缺 hub.html"
  # 兜底：若 Vite 没把 public 下的素材带进 dist，手动补
  if [ ! -d "$DIST/assets-local" ] || [ "$(count_files "$DIST/assets-local")" -lt 10000 ]; then
    log "    dist 里没有完整素材，手动复制 assets-local / data"
    rm -rf "$DIST/assets-local" "$DIST/data"
    cp -a "$ASSETS_DIR" "$DIST/assets-local"
    cp -a "$DATA_DIR" "$DIST/data"
  fi
  [ -f "$DIST/data/deck-library.json" ] || { mkdir -p "$DIST/data"; cp -a "$DATA_DIR"/. "$DIST/data/"; }
  end_step
  log "    dist 体积：$(du -sh "$DIST" 2>/dev/null | cut -f1)"
}

# ---------------- 打包 APK ----------------
package_apk() {
  start_step "打包 APK（aapt + javac + d8 + zipalign + apksigner）"
  [ -n "$AAPT" ] && [ -n "$D8" ] && [ -n "$APKSIGNER" ] && [ -n "$ZIPALIGN" ] \
    || { npm_install_hint | tee -a "$LOG"; fail "缺少安卓打包工具，无法出 APK（可先 --web-only）"; }
  [ -n "$AJ" ] || fail "缺 android.jar（设 ANDROID_SDK 指向 SDK 根）"
  if [ ! -f "$ROOT/android/res/mipmap-hdpi-v4/ic_launcher.png" ]; then
    if [ -n "$FROM_APK" ] && [ -f "$FROM_APK" ]; then
      log "    android/res 缺启动图标，从旧 APK 提取"
      mkdir -p "$ROOT/android/res/mipmap-hdpi-v4"
      unzip -o -j "$FROM_APK" "res/mipmap-hdpi-v4/ic_launcher.png" -d "$ROOT/android/res/mipmap-hdpi-v4" >>"$LOG" 2>&1 \
        || fail "旧 APK 里没有 res/mipmap-hdpi-v4/ic_launcher.png"
    else
      fail "缺 android/res/mipmap-hdpi-v4/ic_launcher.png（启动图标）；用 --from-apk <旧APK> 可自动提取"
    fi
  fi
  DIST="$ROOT/packages/standalone/dist"
  WJ="$ROOT/android/dist-lab"
  rm -rf "$WJ"; mkdir -p "$WJ"
  cp -a "$DIST"/. "$WJ"/
  KS=${KEYSTORE_ARG:-${KEYSTORE:-$ROOT/android/gitcg.jks}}
  if [ ! -f "$KS" ]; then
    warn "找不到签名密钥 $KS，将自动生成新密钥：这样打出的 APK 不能覆盖安装旧版！"
    warn "要覆盖安装，请把原密钥放到 android/gitcg.jks，或用 --keystore 指定"
  fi
  ( cd "$ROOT/android" \
      && ANDROID_SDK="${SDK_DIR}" ANDROID_PLATFORM="${ANDROID_PLATFORM:-23}" \
         BUILD_TOOLS="${BT_DIR:-${BUILD_TOOLS:-}}" WEB="$WJ" KEYSTORE="$KS" KS_PASS="$KS_PASS" \
         bash ./build.sh ) >>"$LOG" 2>&1 || fail "APK 打包失败（见 $LOG）"
  APK="$ROOT/android/build/gitcg.apk"
  [ -f "$APK" ] || APK=$(find "$ROOT/android/build" -name '*.apk' 2>/dev/null | head -1)
  [ -f "$APK" ] || fail "没找到打包产物"
  end_step
  OUT_APK=$APK
}

# ---------------- 校验与交付 ----------------
verify_apk() {
  apk=$1
  [ "$MODE_VERIFY" = 1 ] || { warn "已跳过校验"; return; }
  start_step "校验 APK"
  for f in AndroidManifest.xml classes.dex assets/web/hub.html assets/web/data/deck-library.json; do
    unzip -l "$apk" | grep -q "$f" || fail "APK 缺少 $f"
  done
  n_assets=$(unzip -l "$apk" | grep -c 'assets/web/assets-local/' || true)
  [ "$n_assets" -ge 10000 ] || fail "APK 里素材只有 $n_assets 个，疑似没打进去"
  perms=$(aapt dump permissions "$apk" 2>/dev/null | grep -i 'uses-permission' || true)
  [ -z "$perms" ] || fail "APK 出现权限声明：$perms（应为零权限）"
  if [ -n "$APKSIGNER" ]; then
    "$APKSIGNER" verify "$apk" >>"$LOG" 2>&1 || fail "签名校验失败"
  fi
  end_step
  ok "校验通过：素材 $n_assets 个、零权限、签名有效"
}

deliver() {
  apk=$1
  out=$(resolve_out); mkdir -p "$out"
  ver=$(grep -o 'versionName="[^"]*"' "$ROOT/android/src/AndroidManifest.xml" | head -1 | cut -d'"' -f2)
  [ -n "$ver" ] || ver=unknown
  name="七圣召唤工具-${ver}-oneclick-$(date +%m%d).apk"
  cp "$apk" "$out/$name"
  size=$(du -h "$out/$name" | cut -f1)
  sha=$(sha256sum "$out/$name" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$out/$name" | cut -d' ' -f1)
  start_step "完成"
  cat <<EOF | tee -a "$LOG"
  安装包 : $out/$name
  体积   : $size
  SHA256 : $sha
  日志   : $LOG
  提示   : 覆盖安装需同签名；keystore 默认 android/gitcg.jks，备份它！
EOF
  end_step
}

# ---------------- 主流程 ----------------
detect
resolve_out >/dev/null 2>&1 || true

if [ "$MODE_CHECK" = 1 ]; then
  check_report
  exit 0
fi

[ "$MODE_DEPS" = 1 ] && install_deps

# 依赖缺失：先给报告，再决定
if ! require_node; then
  check_report
  fail "Node ≥22 不可用，无法构建"
fi
[ -n "$PNPM" ] || { npm_install_hint | tee -a "$LOG"; fail "缺 pnpm：npm i -g pnpm"; }

start_step "准备环境"
detect
log "    系统：$OS_NAME $ARCH${IS_ANDROID:+ (Android)}"
log "    Node：$(node -v) / pnpm：$("$PNPM" -v)"
[ "$MODE_CLEAN" = 1 ] && { log "    清理旧产物"; rm -rf "$ROOT/packages/standalone/dist" "$ROOT/android/dist-lab" "$ROOT/android/build"; }
ensure_js_deps
end_step

if [ -n "$FROM_APK" ]; then
  extract_from_apk "$FROM_APK"
elif [ "$FORCE_FETCH" = 1 ] || [ "$FETCH" = 1 ]; then
  fetch_assets
elif assets_ready; then
  log "    素材已就绪（$(count_files "$ASSETS_DIR") 个文件），跳过抓取"
else
  fetch_assets
fi
ensure_data

build_web

if [ "$MODE_WEB_ONLY" = 1 ]; then
  out=$(resolve_out); mkdir -p "$out"
  start_step "打包 Web 产物（zip）"
  zname="七圣召唤工具-web-$(date +%m%d-%H%M).zip"
  ( cd "$ROOT/packages/standalone" && zip -q -r "$out/$zname" dist ) || fail "zip 失败"
  end_step
  ok "Web 产物：$out/$zname（解压后打开 dist/hub.html）"
  exit 0
fi

package_apk
verify_apk "$OUT_APK"
deliver "$OUT_APK"
