#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Suite capture Sky Novel / Realm Novel ==="
echo ""

if ! docker ps --format '{{.Names}}' | grep -qx manhaw-android; then
  ./scripts/start-capture.sh
else
  echo "[OK] Émulateur déjà en cours"
  if ! docker ps --format '{{.Names}}' | grep -qx manhaw-mitmproxy; then
    MSYS_NO_PATHCONV=1 docker run -d --name manhaw-mitmproxy --network container:manhaw-android \
      -v "$ROOT/mitmproxy/addons:/addons:ro" \
      -v "$ROOT/captures:/captures" \
      -v manhaw-mitmproxy-home:/home/mitmproxy/.mitmproxy \
      mitmproxy/mitmproxy:10.4.1 \
      mitmdump --listen-host 0.0.0.0 --listen-port 8080 -s /addons/addon_log_api.py --set flow_detail=1
  fi
  ./scripts/setup-adb-proxy.sh
fi

echo ""
echo "1) Certificat MITM (obligatoire pour HTTPS)"
./scripts/install-mitm-cert.sh 2>/dev/null || true
./scripts/open-cert-settings.sh

echo ""
echo "2) Installer l'app (Play Store ou APK local)"
if ls "$ROOT/apk/"*.apk "$ROOT/apk/"*.xapk 2>/dev/null | head -1; then
  APK="$(ls "$ROOT/apk/"*.apk "$ROOT/apk/"*.xapk 2>/dev/null | head -1)"
  echo "   APK trouvé : $APK"
  if [[ -t 0 ]]; then
    read -r -p "   Installer cet APK ? [o/N] " ans
    if [[ "${ans,,}" == "o" || "${ans,,}" == "y" ]]; then
      ./scripts/install-apk.sh "$APK"
    fi
  else
    echo "   Lance : ./scripts/install-apk.sh \"$APK\""
  fi
else
  echo "   Aucun APK dans apk/ — ouverture Play Store..."
  ./scripts/open-play-store.sh com.myapp.novels_sky
fi

echo ""
echo "3) Dans l'app : lire un chapitre 51+"
echo "   noVNC : http://127.0.0.1:6080"
echo ""
echo "4) Vérifier captures : ./scripts/show-captures.sh"
echo "   Fichier : captures/skynovel-flows.jsonl"
