#!/usr/bin/env bash
set -euo pipefail

REQUEST_PATH="${1:-requests/sample-company-intro.json}"
MAX_RETRY="${MAX_RETRY:-3}"
SUCCESS_STATUS="${SUCCESS_STATUS:-generated}"
GOOSE_MODE="${GOOSE_MODE:-auto}"
LAST_ERROR_TYPE="agent_failed"
LAST_ERROR_MESSAGE="generation did not complete"

export PATH="$HOME/.local/bin:$PATH"

run_build_with_lock() {
  npm run build
}

has_required_generated_files() {
  local site_path="$1"
  local required_files=(
    "content.json"
    "assets.json"
    "metadata.json"
    "page.tsx"
    "index.html"
    "styles.css"
  )

  local file_name
  for file_name in "${required_files[@]}"; do
    if [ ! -f "$site_path/$file_name" ]; then
      return 1
    fi
  done

  return 0
}

maybe_wait_before_retry() {
  if [ "$attempt" -ge "$MAX_RETRY" ]; then
    return
  fi

  if [[ "$LAST_ERROR_MESSAGE" =~ [Qq]uota|[Rr]ate[[:space:]_-]*limit ]]; then
    sleep "${AGENT_RETRY_SLEEP_SECONDS:-8}"
  fi
}

if [ ! -f "$REQUEST_PATH" ]; then
  echo "Request file not found: $REQUEST_PATH"
  exit 1
fi

echo "Validating request: $REQUEST_PATH"
if ! node scripts/validate-request.mjs "$REQUEST_PATH"; then
  echo "Request validation failed: $REQUEST_PATH"
  exit 1
fi

if [[ "$GOOSE_MODE" != "auto" && "$GOOSE_MODE" != "local" && "$GOOSE_MODE" != "required" ]]; then
  echo "Unsupported GOOSE_MODE: $GOOSE_MODE"
  echo "Use one of: auto, local, required"
  exit 1
fi

attempt=0
while [ "$attempt" -lt "$MAX_RETRY" ]; do
  attempt=$((attempt + 1))
  echo "Homepage builder attempt $attempt/$MAX_RETRY for $REQUEST_PATH"

  if [[ "$GOOSE_MODE" == "required" ]] && ! command -v goose >/dev/null 2>&1; then
    LAST_ERROR_TYPE="agent_failed"
    LAST_ERROR_MESSAGE="GOOSE_MODE=required but goose command was not found"
    echo "$LAST_ERROR_MESSAGE"
    maybe_wait_before_retry
    continue
  fi

  if [[ "$GOOSE_MODE" != "local" ]] && command -v goose >/dev/null 2>&1; then
    GOOSE_LOG_PATH="$(mktemp -t goose-homepage-run.XXXXXX)"
    set +e
    bash scripts/run-goose-homepage-recipe.sh "$REQUEST_PATH" 2>&1 | tee "$GOOSE_LOG_PATH"
    GOOSE_STATUS="${PIPESTATUS[0]}"
    set -e
    if [ "$GOOSE_STATUS" -ne 0 ]; then
      LAST_ERROR_TYPE="agent_failed"
      LAST_ERROR_MESSAGE="goose recipe failed"
      if grep -Eiq "quota|rate limit|rate_limit" "$GOOSE_LOG_PATH"; then
        LAST_ERROR_MESSAGE="goose recipe failed: provider quota or rate limit"
      fi
      rm -f "$GOOSE_LOG_PATH"
      maybe_wait_before_retry
      continue
    fi
    COMPANY_ID="$(node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(r.company_id)" "$REQUEST_PATH")"
    SITE_PATH="generated-sites/$COMPANY_ID"
    if ! has_required_generated_files "$SITE_PATH"; then
      LAST_ERROR_TYPE="agent_failed"
      LAST_ERROR_MESSAGE="goose recipe completed without required generated files"
      if grep -Eiq "quota|rate limit|rate_limit" "$GOOSE_LOG_PATH"; then
        LAST_ERROR_MESSAGE="goose recipe hit provider quota or rate limit before generating files"
      fi
      rm -f "$GOOSE_LOG_PATH"
      echo "$LAST_ERROR_MESSAGE"
      maybe_wait_before_retry
      continue
    fi
    rm -f "$GOOSE_LOG_PATH"
  else
    if [[ "$GOOSE_MODE" == "local" ]]; then
      echo "GOOSE_MODE=local. Using deterministic local MVP generator."
    else
      echo "goose command not found. Using deterministic local MVP generator."
    fi
    if ! SITE_PATH="$(node scripts/generate-static-site.mjs "$REQUEST_PATH")"; then
      LAST_ERROR_TYPE="agent_failed"
      LAST_ERROR_MESSAGE="local generator failed"
      continue
    fi
  fi

  if ! bash scripts/validate-generated-site.sh "$SITE_PATH" "$REQUEST_PATH"; then
    LAST_ERROR_TYPE="validation_failed"
    LAST_ERROR_MESSAGE="generated site validation failed"
    node scripts/update-generation-result.mjs \
      --site "$SITE_PATH" \
      --request "$REQUEST_PATH" \
      --status "validation_failed" \
      --build-passed "false" \
      --build-command "npm run build" \
      --retry-count "$attempt" \
      --error-type "$LAST_ERROR_TYPE" \
      --errors "$LAST_ERROR_MESSAGE" >/dev/null
    continue
  fi

  if run_build_with_lock; then
    node scripts/update-generation-result.mjs \
      --site "$SITE_PATH" \
      --request "$REQUEST_PATH" \
      --status "$SUCCESS_STATUS" \
      --build-passed "true" \
      --build-command "npm run build" \
      --retry-count "$attempt" >/dev/null
    echo "Homepage generation completed: $SITE_PATH"
    exit 0
  fi

  LAST_ERROR_TYPE="build_failed"
  LAST_ERROR_MESSAGE="npm run build failed"
  node scripts/update-generation-result.mjs \
    --site "$SITE_PATH" \
    --request "$REQUEST_PATH" \
    --status "build_failed" \
    --build-passed "false" \
    --build-command "npm run build" \
    --build-errors "$LAST_ERROR_MESSAGE" \
    --retry-count "$attempt" \
    --error-type "$LAST_ERROR_TYPE" \
    --errors "$LAST_ERROR_MESSAGE" >/dev/null
done

COMPANY_ID="$(node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); console.log(r.company_id)" "$REQUEST_PATH")"
SITE_PATH="generated-sites/$COMPANY_ID"
node scripts/update-generation-result.mjs \
  --site "$SITE_PATH" \
  --request "$REQUEST_PATH" \
  --status "manual_required" \
  --build-passed "false" \
  --build-command "npm run build" \
  --build-errors "$LAST_ERROR_MESSAGE" \
  --retry-count "$MAX_RETRY" \
  --error-type "$LAST_ERROR_TYPE" \
  --errors "$LAST_ERROR_MESSAGE" \
  --validation-passed "$([[ "$LAST_ERROR_TYPE" == "agent_failed" ]] && echo "false" || echo "")" \
  --validation-errors "$([[ "$LAST_ERROR_TYPE" == "agent_failed" ]] && echo "agent failed before generated-site validation: $LAST_ERROR_MESSAGE" || echo "")" >/dev/null
echo "Homepage generation failed after $MAX_RETRY attempts: $SITE_PATH"
exit 1
