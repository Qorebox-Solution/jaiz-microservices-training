#!/usr/bin/env bash
# Stop the Jaiz web lab (your workspace files are kept).
set -e
cd "$(dirname "$0")"
export LAB_WORKSPACE="$(cd workspace && pwd)"
docker compose down
