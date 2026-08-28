#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APK="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
CONTAINER="${ANDROID_CONTAINER:-manhaw-android}"
PACKAGE="${MANHAW_PACKAGE:-com.manhaw.livingarchive}"

if [[ ! -f "$APK" ]]; then
  echo "APK absent. Lance d'abord: bash scripts/android-docker-build.sh" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Conteneur $CONTAINER absent. Lance: docker compose -f docker/android-emulator/docker-compose.yml up -d" >&2
  exit 1
fi

echo "==> Attente émulateur..."
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" adb devices 2>/dev/null | grep -q 'device$'; then
    break
  fi
  sleep 5
done

docker exec "$CONTAINER" adb devices

echo "==> Copie APK dans le conteneur"
if command -v cmd.exe >/dev/null 2>&1; then
  WIN_APK="$(cd "$(dirname "$APK")" && pwd -W)/$(basename "$APK")"
  cmd.exe /c "docker cp ${WIN_APK//\//\\} ${CONTAINER}:/tmp/manhaw-debug.apk" >/dev/null
else
  MSYS_NO_PATHCONV=1 docker cp "$APK" "$CONTAINER:/tmp/manhaw-debug.apk"
fi

echo "==> Installation"
docker exec "$CONTAINER" adb install -r /tmp/manhaw-debug.apk

echo "==> Lancement"
docker exec "$CONTAINER" adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "==> App installée et lancée."
echo "    Émulateur web: http://localhost:6080"
echo "    ADB: localhost:5555"
