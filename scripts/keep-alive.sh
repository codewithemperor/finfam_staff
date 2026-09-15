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
  # Probe the lightweight health endpoint (compile-cheap, also proves the
  # DB connection) — NEVER the root page, whose cold Turbopack compile
  # takes >5s and used to make this watchdog kill perfectly healthy
  # servers mid-compile in an endless restart loop.
  if ! curl -sf -o /dev/null --max-time 10 http://127.0.0.1:3000/api/health; then
    # Debounce: one miss can be a legitimate transient compile stall.
    sleep 5
    if curl -sf -o /dev/null --max-time 10 http://127.0.0.1:3000/api/health; then
      sleep 5
      continue
    fi
    echo "[$(date '+%F %T')] health check failed twice — restarting dev server" >> "$LOG"
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
