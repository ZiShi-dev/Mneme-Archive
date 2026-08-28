#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
BUILD_IMAGE="${MANHAW_ANDROID_BUILD_IMAGE:-manhaw-android-build}"

echo "==> Build web + sync Capacitor"
cd "$ROOT_DIR"
npm run build:android

echo "==> Compile APK debug"
rm -rf "$ANDROID_DIR/.gradle/8.14.3/fileHashes" "$ANDROID_DIR/.gradle/8.14.3/checksums" 2>/dev/null || true
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$ROOT_DIR:/workspace" \
  -w /workspace/android \
  -e ANDROID_HOME=/opt/android-sdk \
  "$BUILD_IMAGE" \
  ./gradlew assembleDebug --no-daemon

APK="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "APK introuvable: $APK" >&2
  exit 1
fi

echo "==> APK prêt: $APK"
