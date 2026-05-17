#!/usr/bin/env bash
set -euo pipefail

REQUEST_PATH="${1:-}"
RECIPE_PATH="${GOOSE_RECIPE_PATH:-recipes/homepage-builder.recipe.yaml}"
GOOSE_MAX_TURNS_FOR_RUN="${GOOSE_MAX_TURNS_FOR_RUN:-20}"
GOOSE_TOOL_MODE="${GOOSE_TOOL_MODE:-auto}"

export PATH="$HOME/.local/bin:$PATH"

source scripts/ensure-goose-runtime.sh

has_global_provider_config() {
  local config_candidates=(
    "$HOME/.config/goose/config.yaml"
    "$HOME/Library/Application Support/Block/goose/config/config.yaml"
  )

  local config_path
  for config_path in "${config_candidates[@]}"; do
    if [ -f "$config_path" ] && grep -Eq "GOOSE_PROVIDER|provider:" "$config_path"; then
      return 0
    fi
  done

  return 1
}

if [ -z "${GOOSE_PATH_ROOT:-}" ] && ! has_global_provider_config; then
  export GOOSE_PATH_ROOT="$PWD/harness/tmp/goose-runtime"
fi

if [ -z "$REQUEST_PATH" ]; then
  echo "Usage: bash scripts/run-goose-homepage-recipe.sh <request-json>"
  exit 1
fi

if ! command -v goose >/dev/null 2>&1; then
  echo "goose command not found"
  exit 1
fi

if [ ! -f "$RECIPE_PATH" ]; then
  echo "Goose recipe not found: $RECIPE_PATH"
  exit 1
fi

if [ ! -f "$REQUEST_PATH" ]; then
  echo "Request file not found: $REQUEST_PATH"
  exit 1
fi

bash scripts/goose-preflight.sh "$REQUEST_PATH"

GOOSE_MODE="$GOOSE_TOOL_MODE" goose run \
  --no-session \
  --recipe "$RECIPE_PATH" \
  --params "request_path=$REQUEST_PATH" \
  --max-turns "$GOOSE_MAX_TURNS_FOR_RUN"
