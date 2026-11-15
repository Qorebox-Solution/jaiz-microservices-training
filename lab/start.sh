#!/usr/bin/env bash
# Start the Jaiz web lab and open it in the browser.
#
#   ./start.sh              VS Code opens the repo folder (jaiz-microservices-lab)
#   ./start.sh <folder>     VS Code opens <folder> instead (e.g. ./start.sh workspace
#                           for an empty folder to build everything from scratch)
set -e
LAB_DIR="$(cd "$(dirname "$0")" && pwd)"

TARGET="${1:-$LAB_DIR/..}"
if [ ! -d "$TARGET" ] && [ -d "$LAB_DIR/$TARGET" ]; then TARGET="$LAB_DIR/$TARGET"; fi
if [ ! -d "$TARGET" ]; then echo "Folder not found: $TARGET"; exit 1; fi
export LAB_WORKSPACE="$(cd "$TARGET" && pwd)"

cd "$LAB_DIR"
docker compose up -d --build

echo ""
echo "Jaiz lab is starting:  http://localhost:3000"
echo "VS Code folder:        $LAB_WORKSPACE"
echo "Stop it with:          ./stop.sh"
( command -v open >/dev/null && open http://localhost:3000 ) || \
( command -v xdg-open >/dev/null && xdg-open http://localhost:3000 ) || true
