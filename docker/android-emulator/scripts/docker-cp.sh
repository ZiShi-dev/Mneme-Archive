#!/usr/bin/env bash
# Copie host → conteneur sans conversion de chemin Git Bash (Windows)
set -euo pipefail
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'
docker cp "$1" "$2"
