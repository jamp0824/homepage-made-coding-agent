#!/usr/bin/env bash
set -euo pipefail

GOOSE_LOG_DATE="$(date +%F)"
mkdir -p "$HOME/.local/state/goose/logs/cli/$GOOSE_LOG_DATE"
