#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/captures"
mkdir -p "$OUT_DIR"

docker cp manhaw-mitmproxy:/home/mitmproxy/.mitmproxy/mitmproxy-ca-cert.pem "$OUT_DIR/mitmproxy-ca-cert.pem"
docker cp manhaw-mitmproxy:/home/mitmproxy/.mitmproxy/mitmproxy-ca-cert.cer "$OUT_DIR/mitmproxy-ca-cert.cer" 2>/dev/null || true

# Format Android (nom hashé requis pour installation système avec root)
if command -v openssl >/dev/null 2>&1; then
  HASH="$(openssl x509 -inform PEM -subject_hash_old -in "$OUT_DIR/mitmproxy-ca-cert.pem" | head -1)"
  cp "$OUT_DIR/mitmproxy-ca-cert.pem" "$OUT_DIR/${HASH}.0"
  echo "Certificat exporté :"
  echo "  $OUT_DIR/mitmproxy-ca-cert.pem"
  echo "  $OUT_DIR/${HASH}.0 (installation système)"
else
  echo "Certificat exporté : $OUT_DIR/mitmproxy-ca-cert.pem"
  echo "(openssl absent — installation manuelle via Paramètres Android)"
fi
