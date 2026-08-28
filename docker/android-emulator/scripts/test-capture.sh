#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ADB" wait-for-device

echo "==> Ouverture realmnovel.com dans le navigateur (test capture)..."
"$ADB" shell am start -a android.intent.action.VIEW -d "https://realmnovel.com/" 2>/dev/null || true

sleep 3

if [[ -f "$ROOT/captures/skynovel-flows.jsonl" ]]; then
  COUNT="$(wc -l < "$ROOT/captures/skynovel-flows.jsonl" | tr -d ' ')"
  echo "Captures enregistrées : $COUNT lignes dans captures/skynovel-flows.jsonl"
  "$ROOT/scripts/show-captures.sh"
else
  echo "Aucune capture encore — vérifie que le certificat MITM est installé."
  echo "  ./scripts/install-mitm-cert.sh"
fi
