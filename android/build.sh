#!/bin/bash
set -euo pipefail
# 目录与工具链都可用环境变量覆盖，默认按离线开发机的布局
ROOT=${ROOT:-$(cd "$(dirname "$0")" && pwd)}
SDK=${ANDROID_SDK:-/usr/lib/android-sdk}
AJ=$SDK/platforms/android-${ANDROID_PLATFORM:-23}/android.jar
BT=${BUILD_TOOLS:-/opt/android/bt/android-14}
OUT=${OUT:-$ROOT/build}
WEB=${WEB:-$ROOT/dist-lab}
KS=${KEYSTORE:-$ROOT/gitcg.jks}
KS_PASS=${KS_PASS:-gitcgapk}

for f in "$WEB" "$AJ" "$BT/d8"; do
  [ -e "$f" ] || { echo "缺少依赖: $f（可用 WEB / ANDROID_SDK / BUILD_TOOLS 覆盖）" >&2; exit 1; }
done

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex" "$OUT/assets/web"

echo "[1/6] 拷贝网页资源（$(du -sh "$WEB" | cut -f1)）"
cp -r "$WEB"/. "$OUT/assets/web/"

echo "[1.5/6] 拷贝开发资料包"
mkdir -p "$OUT/assets/dev-docs"
cp "$ROOT"/dev-docs/*.md "$ROOT"/dev-docs/*.txt "$OUT/assets/dev-docs/" 2>/dev/null || true

echo "[2/6] aapt package"
cd "$ROOT/src"
aapt package -f -M AndroidManifest.xml -S "$ROOT/res" -A "$OUT/assets" -I "$AJ" -F "$OUT/app-unsigned.apk" >/dev/null

echo "[3/6] javac"
javac -source 8 -target 8 -encoding UTF-8 -nowarn -classpath "$AJ" \
  -d "$OUT/classes" $(find java -name '*.java')

echo "[4/6] d8"
CLASSES=$(find "$OUT/classes" -name '*.class')
"$BT/d8" --lib "$AJ" --min-api 24 --output "$OUT/dex" $CLASSES 2>&1 | tail -5

echo "[5/6] 打包 dex + zipalign"
cd "$OUT/dex"
zip -q -X "$OUT/app-unsigned.apk" classes.dex
cd "$OUT"
zipalign -f -p 4 app-unsigned.apk app-aligned.apk

echo "[6/6] 签名"
if [ ! -f "$KS" ]; then
  # 首次构建才生成；请务必备份这个文件，换签名会导致无法覆盖安装
  keytool -genkeypair -keystore "$KS" -alias gitcg -keyalg RSA -keysize 2048 \
    -validity 36500 -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=DSH, OU=Play, O=DSH, L=Local, S=Local, C=CN" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT/gitcg.apk" "$OUT/app-aligned.apk"
echo "完成: $OUT/gitcg.apk ($(du -h "$OUT/gitcg.apk" | cut -f1))"
