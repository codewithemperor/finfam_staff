#!/usr/bin/env bash
# Admin Account bootstrap (Stage 11). Runs with .env values taking
# precedence over any inherited shell environment (same pattern as
# scripts/test.sh and scripts/backfill-staff-accounts.sh).
#
# Usage: bash scripts/bootstrap-admin.sh <email> [--dry-run]
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source .env
set +a
exec bun --conditions react-server scripts/bootstrap-admin.ts "$@"
