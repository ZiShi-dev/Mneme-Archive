#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ADB="$ROOT/scripts/adb.sh"

echo "==> Démarrage émulateur + mitmproxy..."
docker compose up -d android-emulator 2>/dev/null || docker start manhaw-android

if ! docker ps --format '{{.Names}}' | grep -qx manhaw-mitmproxy; then
  echo "==> Démarrage mitmproxy (réseau partagé)..."
  MSYS_NO_PATHCONV=1 docker run -d --name manhaw-mitmproxy --network container:manhaw-android \
    -v "$ROOT/mitmproxy/addons:/addons:ro" \
    -v "$ROOT/captures:/captures" \
    -v manhaw-mitmproxy-home:/home/mitmproxy/.mitmproxy \
    mitmproxy/mitmproxy:10.4.1 \
    mitmdump --listen-host 0.0.0.0 --listen-port 8080 -s /addons/addon_log_api.py --set flow_detail=1
fi

echo "==> Attente ADB (peut prendre 2–3 min au premier lancement)..."
for i in $(seq 1 90); do
  if "$ADB" shell getprop sys.boot_completed 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 2
done

if ! "$ADB" shell getprop sys.boot_completed 2>/dev/null | grep -q 1; then
  echo "ERREUR: émulateur non prêt. Ouvre http://127.0.0.1:6080"
  exit 1
fi

echo "==> Configuration du proxy HTTP..."
"$ROOT/scripts/setup-adb-proxy.sh"

echo ""
echo "Prêt."
echo "  noVNC (émulateur) : http://127.0.0.1:6080"
echo "  Captures          : $ROOT/captures/skynovel-flows.jsonl"
echo ""
echo "Suivant : installer Sky Novel dans l'émulateur, puis lire un chapitre 51+."
echo "Voir README.md pour le certificat MITM et le dépannage."
