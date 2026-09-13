#!/usr/bin/env bash
# Starts the Next.js dev server on port 3000 with .env values taking
# precedence over any inherited shell environment.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source .env
set +a
exec node_modules/.bin/next dev -p 3000
