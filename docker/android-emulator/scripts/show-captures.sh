#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/captures/skynovel-flows.jsonl"

if [[ ! -f "$FILE" ]]; then
  echo "Aucune capture pour l'instant ($FILE)"
  exit 0
fi

echo "==> Dernières requêtes capturées (hors images) :"
tail -n 20 "$FILE" | while IFS= read -r line; do
  url="$(echo "$line" | sed -n 's/.*"url":"\([^"]*\)".*/\1/p')"
  status="$(echo "$line" | sed -n 's/.*"status":\([0-9]*\).*/\1/p')"
  method="$(echo "$line" | sed -n 's/.*"method":"\([^"]*\)".*/\1/p')"
  if [[ -n "$url" ]]; then
    echo "${status:-?} ${method:-?} $url"
  else
    echo "$line"
  fi
done

echo ""
echo "Fichier complet : $FILE"
echo "Astuce : chercher chapter, novel, api dans response_body"
