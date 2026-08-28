#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"
APK_DIR="$ROOT/apk/extracted-sky-full"

CONTAINER="${MANHAW_ANDROID_CONTAINER:-manhaw-android}"
"$ADB" wait-for-device

if [[ ! -f "$APK_DIR/com.myapp.novels_sky.apk" ]]; then
  unzip -q -o "$ROOT/apk/skynovel.apk" -d "$APK_DIR"
fi

echo "==> Copie APK splits dans le conteneur /tmp..."
pushd "$APK_DIR" >/dev/null
export MSYS_NO_PATHCONV=1
for f in com.myapp.novels_sky.apk config.arm64_v8a.apk config.en.apk config.mdpi.apk; do
  docker cp "$f" "$CONTAINER:/tmp/$f"
done
popd >/dev/null

echo "==> Installation (install-multiple)..."
"$ADB" install-multiple -r -d \
  /tmp/com.myapp.novels_sky.apk \
  /tmp/config.arm64_v8a.apk \
  /tmp/config.en.apk \
  /tmp/config.mdpi.apk

echo "==> Lancement Sky Novel..."
"$ADB" shell monkey -p com.myapp.novels_sky -c android.intent.category.LAUNCHER 1 2>/dev/null || true

echo "Dans noVNC : lire un chapitre 51+, puis ./scripts/show-captures.sh"
