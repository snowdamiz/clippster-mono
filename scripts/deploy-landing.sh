#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/server/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

FLY_LANDING_TOKEN=$(grep '^FLY_LANDING_TOKEN=' "$ENV_FILE" | cut -d'=' -f2-)

if [ -z "$FLY_LANDING_TOKEN" ]; then
  echo "Error: FLY_LANDING_TOKEN not found in $ENV_FILE"
  exit 1
fi

echo "Deploying landing page to fly.io (clippster-landing)..."
cd "$REPO_ROOT/landing"
FLY_API_TOKEN="$FLY_LANDING_TOKEN" flyctl deploy --remote-only
