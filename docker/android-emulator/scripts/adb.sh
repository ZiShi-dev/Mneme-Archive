#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MANHAW_ANDROID_CONTAINER:-manhaw-android}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERREUR: conteneur $CONTAINER non démarré. Lance ./scripts/start-capture.sh"
  exit 1
fi

# Git Bash sur Windows convertit /system/... — désactiver pour adb shell
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

exec docker exec "$CONTAINER" adb "$@"
