#!/usr/bin/env bash
set -e

# Let the 'coder' user talk to the host Docker daemon through the mounted socket.
if [ -S /var/run/docker.sock ]; then
  sudo chmod 666 /var/run/docker.sock || true
fi

WORKSPACE="${WORKSPACE:-/home/coder/workspace}"
mkdir -p "$WORKSPACE"

exec /usr/bin/entrypoint.sh \
  --bind-addr 0.0.0.0:8080 \
  --auth none \
  --disable-telemetry \
  --disable-update-check \
  --disable-workspace-trust \
  "$WORKSPACE"
