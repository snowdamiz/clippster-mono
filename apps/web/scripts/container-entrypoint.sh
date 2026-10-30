#!/bin/sh
set -eu
data="${WEB_DATA_DIR:-/data}"
# Cloudflare Container disks don't persist: media lives in R2 through a tigrisfs mount, and Litestream restores the
# SQLite database (kept off the mount in WEB_DATABASE_DIR) from R2 and replicates every change back.
if [ -n "${WEB_R2_BUCKET:-}" ]; then
  mkdir -p "$data" "$WEB_DATABASE_DIR"
  chown node:node "$WEB_DATABASE_DIR"
  # tigrisfs uploads closed files in the background, so it must outlive the server: its own session keeps tini's
  # group-wide SIGTERM away from it, and it is stopped only after the server exits (on SIGTERM it uploads what is
  # pending, then unmounts).
  setsid tigrisfs --endpoint "$WEB_R2_ENDPOINT" --region auto -o allow_other --uid "$(id -u node)" --gid "$(id -g node)" \
    --fsync-on-close -f "$WEB_R2_BUCKET:web/data" "$data" &
  mount=$!
  for _ in $(seq 1 30); do
    mountpoint -q "$data" && break
    kill -0 "$mount" 2>/dev/null || { echo "tigrisfs exited before mounting $WEB_R2_BUCKET" >&2; exit 1; }
    sleep 1
  done
  mountpoint -q "$data" || { echo "Mounting $WEB_R2_BUCKET at $data timed out" >&2; exit 1; }
  setpriv --reuid=node --regid=node --init-groups \
    litestream replicate -config /etc/litestream.yml -restore-if-db-not-exists -exec "$*" &
  app=$!
  trap 'kill -TERM "$app" 2>/dev/null || true' TERM INT
  status=0
  # A trapped signal ends `wait` early, so wait again until the server has really exited.
  while kill -0 "$app" 2>/dev/null; do wait "$app" && status=0 || status=$?; done
  kill -TERM "$mount" 2>/dev/null || true
  wait "$mount" || true
  exit "$status"
fi
# Docker volumes are mounted as root. Drop privileges after preparing only our data directory.
if [ "$(id -u)" = 0 ]; then
  chown node:node "$data"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
