#!/usr/bin/env bash
set -uo pipefail

REQUEST_PATH="${1:-requests/sample-company-intro.json}"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
E2E_OUTPUT_PATH="${E2E_OUTPUT_PATH:-harness/tmp/e2e/latest-run.log}"
E2E_QUOTA_WARNING="false"
E2E_EXIT_CODE="1"
E2E_REPORT_WRITTEN="false"

export PATH="$HOME/.local/bin:$PATH"

source scripts/ensure-goose-runtime.sh

write_report() {
  if [ "$E2E_REPORT_WRITTEN" = "true" ]; then
    return
  fi
  E2E_REPORT_WRITTEN="true"
  if [ -f "$E2E_OUTPUT_PATH" ] && grep -Eiq "quota|rate limit|rate_limit" "$E2E_OUTPUT_PATH"; then
    E2E_QUOTA_WARNING="true"
  fi
  node scripts/write-e2e-report.mjs \
    --request "$REQUEST_PATH" \
    --started-at "$STARTED_AT" \
    --ended-at "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
    --exit-code "$E2E_EXIT_CODE" \
    --quota-warning "$E2E_QUOTA_WARNING" >/dev/null
}

trap write_report EXIT

if [ ! -f "$REQUEST_PATH" ]; then
  echo "Request file not found: $REQUEST_PATH"
  exit 1
fi

mkdir -p "$(dirname "$E2E_OUTPUT_PATH")"
: > "$E2E_OUTPUT_PATH"

set -o pipefail
bash scripts/goose-preflight.sh "$REQUEST_PATH" 2>&1 | tee -a "$E2E_OUTPUT_PATH"
PREFLIGHT_STATUS="${PIPESTATUS[0]}"
if [ "$PREFLIGHT_STATUS" -ne 0 ]; then
  E2E_EXIT_CODE="$PREFLIGHT_STATUS"
  exit "$PREFLIGHT_STATUS"
fi

GOOSE_MODE=required bash scripts/run-homepage-builder.sh "$REQUEST_PATH" 2>&1 | tee -a "$E2E_OUTPUT_PATH"
RUN_STATUS="${PIPESTATUS[0]}"
if [ "$RUN_STATUS" -ne 0 ]; then
  E2E_EXIT_CODE="$RUN_STATUS"
  exit "$RUN_STATUS"
fi
E2E_EXIT_CODE="0"

COMPANY_ID="$(node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(r.company_id)" "$REQUEST_PATH")"
SITE_PATH="generated-sites/$COMPANY_ID"

echo
echo "Goose E2E completed."
echo "Generated site: $SITE_PATH"
echo "Preview URL: /homepage/$COMPANY_ID"
write_report
