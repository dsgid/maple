#!/bin/sh
# Starts the Host-header proxy, then the Maple apps listed in MAPLE_APPS (default: api electric-sync; the web client is prebuilt).
set -e
mkdir -p "$(dirname "$MAPLE_ROUTES_FILE")"
rm -f "$MAPLE_ROUTES_FILE"
bun deploy/dsg/proxy.ts &
exec bun dev ${MAPLE_APPS:-api electric-sync}
