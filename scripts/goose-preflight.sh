#!/usr/bin/env bash
set -euo pipefail

REQUEST_PATH="${1:-requests/sample-company-intro.json}"
RECIPE_PATH="${GOOSE_RECIPE_PATH:-recipes/homepage-builder.recipe.yaml}"

export PATH="$HOME/.local/bin:$PATH"

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

has_provider_config() {
  if [ -n "${GOOSE_PROVIDER:-}" ] && [ -n "${GOOSE_MODEL:-}" ]; then
    return 0
  fi

  local config_candidates=(
    "$HOME/.config/goose/config.yaml"
    "$HOME/Library/Application Support/Block/goose/config/config.yaml"
  )

  if [ -n "${GOOSE_PATH_ROOT:-}" ]; then
    config_candidates+=("$GOOSE_PATH_ROOT/config/config.yaml")
  fi

  local config_path
  for config_path in "${config_candidates[@]}"; do
    if [ -f "$config_path" ] && grep -Eq "GOOSE_PROVIDER|provider:" "$config_path"; then
      return 0
    fi
  done

  return 1
}

if ! command -v goose >/dev/null 2>&1; then
  echo "goose command not found"
  echo "Install Goose CLI, then re-run this check."
  exit 1
fi

echo "goose path: $(command -v goose)"
goose --version

echo
echo "validating recipe: $RECIPE_PATH"
goose recipe validate "$RECIPE_PATH"

echo
echo "rendering recipe with request_path=$REQUEST_PATH"
goose run \
  --recipe "$RECIPE_PATH" \
  --params "request_path=$REQUEST_PATH" \
  --render-recipe >/dev/null
echo "✓ recipe parameters render correctly"

if ! has_provider_config; then
  echo
  echo "No Goose provider config was found."
  echo "Configure one provider before running GOOSE_MODE=required:"
  echo "  goose configure"
  echo
  echo "Or set provider/model environment variables, for example:"
  echo "  GOOSE_PROVIDER=openai GOOSE_MODEL=gpt-4.1"
  echo "  GOOSE_PROVIDER=anthropic GOOSE_MODEL=claude-sonnet-4-5"
  echo "  GOOSE_PROVIDER=gemini GOOSE_MODEL=gemini-2.5-pro"
  exit 1
fi

echo
echo "✓ Goose provider config is present"
