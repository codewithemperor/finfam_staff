#!/usr/bin/env bash
# Runs the flow test suite (bun test) with .env values taking precedence over
# any inherited shell environment (the sandbox exports a global DATABASE_URL).
#
# The suite drives the REAL HTTP APIs of the running dev server
# (http://127.0.0.1:3000), so `bun run dev` must be up before testing.
# FLOW_TEST_BASE_URL can override the target for CI setups.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source .env
set +a
# 30s per-test default: journey-driving tests make many real HTTP calls
# against the dev server; the 5s bun default is too tight for them.
exec bun test --conditions react-server --timeout 30000 "$@"
