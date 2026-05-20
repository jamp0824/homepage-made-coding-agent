#!/usr/bin/env bash
set -euo pipefail

DRAFT_PATH="${1:-}"
USER_MESSAGE="${2:-}"
RECIPE_PATH="${GOOSE_DRAFT_RECIPE_PATH:-recipes/homepage-draft.recipe.yaml}"
GOOSE_MAX_TURNS_FOR_DRAFT="${GOOSE_MAX_TURNS_FOR_DRAFT:-12}"
GOOSE_TOOL_MODE="${GOOSE_TOOL_MODE:-auto}"

export PATH="$HOME/.local/bin:$PATH"

source scripts/ensure-goose-runtime.sh

if [ -z "$DRAFT_PATH" ]; then
  echo "Usage: bash scripts/run-goose-homepage-draft-recipe.sh <content.draft.json> [user_message]"
  exit 1
fi

if ! command -v goose >/dev/null 2>&1; then
  echo "goose command not found"
  exit 1
fi

if [ ! -f "$RECIPE_PATH" ]; then
  echo "Goose draft recipe not found: $RECIPE_PATH"
  exit 1
fi

if [ ! -f "$DRAFT_PATH" ]; then
  echo "Draft file not found: $DRAFT_PATH"
  exit 1
fi

goose recipe validate "$RECIPE_PATH" >/dev/null
goose run \
  --recipe "$RECIPE_PATH" \
  --params "draft_path=$DRAFT_PATH" \
  --params "user_message=$USER_MESSAGE" \
  --render-recipe >/dev/null

GOOSE_MODE="$GOOSE_TOOL_MODE" goose run \
  --no-session \
  --recipe "$RECIPE_PATH" \
  --params "draft_path=$DRAFT_PATH" \
  --params "user_message=$USER_MESSAGE" \
  --max-turns "$GOOSE_MAX_TURNS_FOR_DRAFT"
