#!/usr/bin/env bash
set -euo pipefail

DRAFT_PATH="${1:?Usage: bash scripts/validate-homepage-draft.sh harness/tmp/homepage-drafts/DRAFT_ID/content.draft.json}"

node harness/validators/validate-homepage-draft.mjs "$DRAFT_PATH"
