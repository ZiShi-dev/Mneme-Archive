#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/clear-adb-proxy.sh" 2>/dev/null || true
docker compose down
echo "Stack arrêtée."
