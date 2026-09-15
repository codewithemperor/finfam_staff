#!/usr/bin/env bash
# Staff Account backfill (Stage 7). Runs with .env values taking precedence
# over any inherited shell environment (same pattern as scripts/test.sh).
#
# Usage: bash scripts/backfill-staff-accounts.sh [--dry-run]
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source .env
set +a
exec bun --conditions react-server scripts/backfill-staff-accounts.ts "$@"
