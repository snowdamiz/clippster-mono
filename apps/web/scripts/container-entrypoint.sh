#!/bin/sh
set -eu
# Fly volumes are mounted as root. Drop privileges after preparing only our data directory.
if [ "$(id -u)" = 0 ]; then
  chown node:node "${WEB_DATA_DIR:-/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
