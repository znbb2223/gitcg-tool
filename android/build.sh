#!/bin/bash
set -euo pipefail
ROOT=/root/workspace/gitcg-lab
SDK=/usr/lib/android-sdk
AJ=$SDK/platforms/android-23/android.jar
BT=/opt/android/bt/android-14
OUT=$ROOT/build
WEB=/root/workspace/gitcg-lab/dist-lab

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
KS=$ROOT/gitcg.jks
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias gitcg -keyalg RSA -keysize 2048 \
    -validity 36500 -storepass gitcgapk -keypass gitcgapk \
    -dname "CN=DSH, OU=Play, O=DSH, L=Local, S=Local, C=CN" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:gitcgapk --key-pass pass:gitcgapk \
  --out "$OUT/gitcg.apk" "$OUT/app-aligned.apk"
echo "完成: $OUT/gitcg.apk ($(du -h "$OUT/gitcg.apk" | cut -f1))"
