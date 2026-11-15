#!/usr/bin/env bash
# Start the Jaiz web lab and open it in the browser.
set -e
cd "$(dirname "$0")"
mkdir -p workspace
export LAB_WORKSPACE="$(cd workspace && pwd)"

docker compose up -d --build

echo ""
echo "Jaiz lab is starting:  http://localhost:3000"
echo "Stop it with:          ./stop.sh"
( command -v open >/dev/null && open http://localhost:3000 ) || \
( command -v xdg-open >/dev/null && xdg-open http://localhost:3000 ) || true
