#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ADB" wait-for-device

# 10.0.2.2 = host du QEMU (mitmproxy partage le réseau du conteneur émulateur)
"$ADB" shell settings put global http_proxy 10.0.2.2:8080

echo "Proxy HTTP configuré : 10.0.2.2:8080"
