#!/usr/bin/env bash
# Stop the Jaiz web lab (your files are kept).
set -e
cd "$(dirname "$0")"
export LAB_WORKSPACE="${LAB_WORKSPACE:-$(pwd)}"   # any value works for "down"
docker compose down
