#!/usr/bin/env bash
set -euo pipefail

REQUEST_PATH="${1:-requests/sample-company-intro.json}"

export PATH="$HOME/.local/bin:$PATH"

source scripts/ensure-goose-runtime.sh

if [ ! -f "$REQUEST_PATH" ]; then
  echo "Request file not found: $REQUEST_PATH"
  exit 1
fi

bash scripts/goose-preflight.sh "$REQUEST_PATH"

GOOSE_MODE=required bash scripts/run-homepage-builder.sh "$REQUEST_PATH"

COMPANY_ID="$(node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(r.company_id)" "$REQUEST_PATH")"
SITE_PATH="generated-sites/$COMPANY_ID"

echo
echo "Goose E2E completed."
echo "Generated site: $SITE_PATH"
echo "Preview URL: /homepage/$COMPANY_ID"
