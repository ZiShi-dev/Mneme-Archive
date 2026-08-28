#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ADB" wait-for-device

echo "Ouverture Paramètres → Sécurité → Certificats..."
"$ADB" shell am start -a android.settings.SECURITY_SETTINGS 2>/dev/null || true

echo ""
echo "Dans noVNC (http://127.0.0.1:6080) :"
echo "  Chiffrement et identifiants → Installer un certificat → Certificat CA"
echo "  Fichier : mitmproxy-ca-cert.pem (sur /sdcard)"
echo ""
echo "Si absent, exécute : ./scripts/install-mitm-cert.sh"
