#!/usr/bin/env bash
set -euo pipefail

JOBS_ROOT="${1:-jobs}"

node scripts/run-pending-homepage-jobs.mjs "$JOBS_ROOT"
