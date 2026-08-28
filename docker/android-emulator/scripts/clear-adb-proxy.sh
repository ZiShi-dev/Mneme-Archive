#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ADB" wait-for-device
"$ADB" shell settings put global http_proxy :0
echo "Proxy HTTP désactivé."
