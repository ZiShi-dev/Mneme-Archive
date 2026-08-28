#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ROOT/scripts/export-mitm-cert.sh"

CERT_PEM="$ROOT/captures/mitmproxy-ca-cert.pem"
CONTAINER="${MANHAW_ANDROID_CONTAINER:-manhaw-android}"

"$ADB" wait-for-device
"$ROOT/scripts/adb-push.sh" "$CERT_PEM" mitmproxy-ca-cert.pem

echo "==> Installation certificat utilisateur (Android 11+)..."
if "$ADB" shell cmd cert install-user-ca /sdcard/mitmproxy-ca-cert.pem 2>/dev/null; then
  echo "Certificat installé via cmd cert install-user-ca"
  exit 0
fi

echo "==> Ouverture de l'assistant d'installation du certificat..."
"$ADB" shell am start -a android.intent.action.VIEW \
  -d "file:///sdcard/mitmproxy-ca-cert.pem" \
  -t application/x-x509-ca-cert 2>/dev/null || true
sleep 2

HASH_FILE="$(ls "$ROOT/captures"/*.0 2>/dev/null | head -1)"
if [[ -n "$HASH_FILE" ]]; then
  echo "==> Tentative installation système..."
  HASH_NAME="$(basename "$HASH_FILE")"
  "$ADB" root 2>/dev/null || true
  sleep 2
  "$ROOT/scripts/adb-push.sh" "$HASH_FILE" "$HASH_NAME"
  if "$ADB" shell "cp /sdcard/$HASH_NAME /system/etc/security/cacerts/$HASH_NAME && chmod 644 /system/etc/security/cacerts/$HASH_NAME"; then
    echo "Certificat installé dans le magasin système."
    exit 0
  fi
fi

echo ""
echo "Installation automatique échouée — procédure manuelle (noVNC http://127.0.0.1:6080) :"
echo "  1. Paramètres → Sécurité → Chiffrement et identifiants"
echo "  2. Installer un certificat → Certificat CA"
echo "  3. Choisir mitmproxy-ca-cert.pem (fichier sur /sdcard)"
echo ""
echo "Le certificat est sur /sdcard/mitmproxy-ca-cert.pem dans l'émulateur."
