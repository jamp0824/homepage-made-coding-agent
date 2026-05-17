#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

if [ -z "${GOOSE_PATH_ROOT:-}" ]; then
  export GOOSE_PATH_ROOT="$PWD/harness/tmp/goose-check"
fi

source scripts/ensure-goose-runtime.sh

if ! command -v goose >/dev/null 2>&1; then
  echo "goose command not found"
  echo
  echo "Current runner behavior:"
  echo "- GOOSE_MODE=auto: use local deterministic generator when goose is missing"
  echo "- GOOSE_MODE=local: always use local deterministic generator"
  echo "- GOOSE_MODE=required: fail if goose is missing"
  exit 1
fi

echo "goose path: $(command -v goose)"
goose --version
echo
echo "goose run help:"
goose run --help
echo
echo "goose recipe help:"
goose recipe --help
