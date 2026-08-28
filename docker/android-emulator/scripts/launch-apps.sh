#!/usr/bin/env bash
# Lance les deux apps pour générer du trafic API (après certificat MITM installé).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="$ROOT/scripts/adb.sh"

"$ADB" wait-for-device

echo "==> Lancement Realm Novel..."
"$ADB" shell monkey -p com.realmnovel.novel_app 1 2>/dev/null || true
sleep 5

echo "==> Lancement Sky Novel..."
"$ADB" shell monkey -p com.myapp.novels_sky 1 2>/dev/null || true
sleep 3

echo ""
echo "Dans noVNC : ouvrir un roman et lire le chapitre 51+"
echo "Puis : ./scripts/show-captures.sh"
