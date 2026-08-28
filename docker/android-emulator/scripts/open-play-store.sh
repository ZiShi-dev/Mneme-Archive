#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"
PKG="${1:-com.myapp.novels_sky}"

"$ADB" wait-for-device
echo "Ouverture Play Store pour : $PKG"
"$ADB" shell am start -a android.intent.action.VIEW -d "market://details?id=$PKG" 2>/dev/null \
  || "$ADB" shell am start -a android.intent.action.VIEW -d "https://play.google.com/store/apps/details?id=$PKG"
echo ""
echo "Dans noVNC (http://127.0.0.1:6080) : connectez Google Play et installez l'app."
echo "Apps utiles :"
echo "  Sky Novel       : com.myapp.novels_sky"
echo "  Realm Novel app : com.realmnovel.novel_app"
