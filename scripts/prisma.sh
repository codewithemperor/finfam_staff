#!/usr/bin/env bash
# Runs Prisma with values from .env taking precedence over any inherited
# shell environment (sandbox images may export a default DATABASE_URL).
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source .env
set +a
exec bunx prisma "$@"
