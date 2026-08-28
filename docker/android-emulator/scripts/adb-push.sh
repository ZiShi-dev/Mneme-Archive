#!/usr/bin/env bash
# Pousse un fichier local vers /sdcard/ de l'émulateur (évite docker cp + Git Bash)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${1:-}"
REMOTE_NAME="${2:-$(basename "$FILE")}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: ./scripts/adb-push.sh <fichier-local> [nom-sur-sdcard]"
  exit 1
fi

CONTAINER="${MANHAW_ANDROID_CONTAINER:-manhaw-android}"
REMOTE_DIR="${3:-/data/local/tmp}"
REMOTE_PATH="$REMOTE_DIR/$REMOTE_NAME"

export MSYS_NO_PATHCONV=1

docker exec -i "$CONTAINER" adb shell "mkdir -p $REMOTE_DIR && rm -f $REMOTE_PATH && cat > $REMOTE_PATH" < "$FILE"
echo "Poussé vers $REMOTE_PATH"
