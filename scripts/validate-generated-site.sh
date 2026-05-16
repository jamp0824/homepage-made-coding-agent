#!/usr/bin/env bash
set -euo pipefail

SITE_PATH="${1:-}"
REQUEST_PATH="${2:-}"

if [ -z "$SITE_PATH" ]; then
  echo "Usage: bash scripts/validate-generated-site.sh generated-sites/COMPANY_001"
  exit 1
fi

if [ ! -d "$SITE_PATH" ]; then
  echo "Generated site directory not found: $SITE_PATH"
  exit 1
fi

node harness/validators/validate-generated-site.mjs "$SITE_PATH" "$REQUEST_PATH"
