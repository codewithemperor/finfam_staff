#!/usr/bin/env bash
# FinFam local development PostgreSQL (no root required)
# Uses real PostgreSQL binaries shipped via @embedded-postgres/linux-x64.
# The data directory lives in ./db/pg-data and is git-ignored.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_HOME="$ROOT_DIR/node_modules/@embedded-postgres/linux-x64/native"
PG_BIN="$PG_HOME/bin"
PG_DATA="$ROOT_DIR/db/pg-data"
DB_NAME="${FINFAM_DB_NAME:-finfam}"
DB_USER="${FINFAM_DB_USER:-postgres}"
DB_PORT="${FINFAM_DB_PORT:-5432}"

# ICU 60 runtime (vendored under db/pg-libs) required by the postgres binaries
export LD_LIBRARY_PATH="$ROOT_DIR/db/pg-libs:$PG_HOME/lib:${LD_LIBRARY_PATH:-}"

cmd="${1:-start}"

port_open() {
  (exec 3<>"/dev/tcp/127.0.0.1/$DB_PORT") 2>/dev/null && exec 3>&- && return 0
  return 1
}

init() {
  if [ -f "$PG_DATA/PG_VERSION" ]; then return 0; fi
  echo "[postgres] initializing data directory at $PG_DATA"
  mkdir -p "$PG_DATA"
  "$PG_BIN/initdb" -D "$PG_DATA" -U "$DB_USER" -A trust -E UTF8 --locale=C >/dev/null
  # Restrict to localhost only
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = $DB_PORT"
    echo "unix_socket_directories = '/tmp'"
  } >> "$PG_DATA/postgresql.conf"
}

ensure_database() {
  bun run "$ROOT_DIR/scripts/ensure-db.ts"
}

start() {
  init
  if port_open; then
    echo "[postgres] already running on 127.0.0.1:$DB_PORT"
  else
    echo "[postgres] starting PostgreSQL..."
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$ROOT_DIR/db/postgres.log" -w -t 30 start
  fi
  ensure_database
  echo "[postgres] ready: postgresql://$DB_USER@127.0.0.1:$DB_PORT/$DB_NAME"
}

stop() {
  if [ -f "$PG_DATA/PG_VERSION" ]; then
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -m fast stop || true
  fi
}

status() {
  if port_open; then echo "[postgres] running on port $DB_PORT"; else echo "[postgres] not running"; fi
}

case "$cmd" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac
