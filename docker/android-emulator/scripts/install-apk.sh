#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APK_PATH="${1:-}"

if [[ -z "$APK_PATH" ]]; then
  echo "Usage: ./scripts/install-apk.sh <chemin.apk|chemin.xapk>"
  echo ""
  echo "APK locaux attendus :"
  ls -1 "$ROOT/apk/"*.{apk,xapk} 2>/dev/null || echo "  (aucun — place un APK dans docker/android-emulator/apk/)"
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "Fichier introuvable : $APK_PATH"
  exit 1
fi

CONTAINER="${MANHAW_ANDROID_CONTAINER:-manhaw-android}"
"$ROOT/scripts/adb.sh" wait-for-device

case "$APK_PATH" in
  *.xapk)
    TMP="$(mktemp -d)"
    unzip -q "$APK_PATH" -d "$TMP"
    MAIN_APK="$(find "$TMP" -name '*.apk' | head -1)"
    if [[ -z "$MAIN_APK" ]]; then
      echo "XAPK invalide : aucun APK interne"
      exit 1
    fi
    "$ROOT/scripts/adb-push.sh" "$MAIN_APK" install.apk
    "$ROOT/scripts/adb.sh" install -r /sdcard/install.apk
    rm -rf "$TMP"
    ;;
  *.apk)
    "$ROOT/scripts/adb-push.sh" "$APK_PATH" install.apk
    "$ROOT/scripts/adb.sh" install -r /sdcard/install.apk
    ;;
  *)
    echo "Extension non supportée (apk ou xapk uniquement)"
    exit 1
    ;;
esac

echo "Installation terminée."
