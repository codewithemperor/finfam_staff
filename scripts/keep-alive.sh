#!/usr/bin/env bash
# Keeps the Next.js dev server alive in this sandbox.
#
# Observed behaviour: daemonised C processes (PostgreSQL via pg_ctl) survive
# platform restarts/message boundaries, but user-spawned node servers are
# periodically reaped. This watchdog is itself daemonised (small bash loop —
# same survival class as postgres) and restarts the dev server whenever
# port 3000 stops answering, self-healing both reaps and wedged servers.
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LOG=keep-alive.log

while true; do
  if ! curl -sf -o /dev/null --max-time 5 http://127.0.0.1:3000/; then
    echo "[$(date '+%F %T')] health check failed — restarting dev server" >> "$LOG"
    # Clear any stale/wedged server holding the port before respawning.
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "next-server" 2>/dev/null || true
    sleep 1
    setsid bash scripts/dev.sh >> dev.log 2>&1 < /dev/null &
    # Give the server time to boot before checking again.
    sleep 10
  fi
  sleep 5
done
