#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/server/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

FLY_SERVER_TOKEN=$(grep '^FLY_SERVER_TOKEN=' "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$FLY_SERVER_TOKEN" ]; then
  echo "Error: FLY_SERVER_TOKEN not found in $ENV_FILE"
  exit 1
fi

echo "Deploying server to fly.io (clippster-server)..."
cd "$REPO_ROOT/server"
FLY_API_TOKEN="$FLY_SERVER_TOKEN" flyctl deploy --remote-only
