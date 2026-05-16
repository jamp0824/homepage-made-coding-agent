# Agent Run Report

## Summary

- request_id: REQ_GOOSE_NO_PROVIDER
- company_id: COMPANY_GOOSE_NO_PROVIDER
- request_path: /Users/junonan/Downloads/goose-homepage-builder-harness/harness/tmp/goose-no-provider/request.json
- generated_path: generated-sites/COMPANY_GOOSE_NO_PROVIDER
- homepage_type: company_intro
- template_id: company_intro_basic
- final_status: manual_required
- retry_count: 1
- completed_at: 2026-05-16T17:11:43.910Z

## Validation

- passed: false

- agent failed before generated-site validation: goose recipe failed

## Build

- passed: false
- command: npm run build

- goose recipe failed

## Timeline

| Step | Status | Message |
| --- | --- | --- |
| requested | completed | Request file was accepted by the runner. |
| validating_request | completed | Request schema validation passed before generation. |
| agent_running | failed | Homepage agent failed before generated-site validation completed. |
| validating_output | skipped | Generated-site validation skipped because the agent failed. |
| building | skipped | Build skipped because automation failed before build. |
| manual_required | failed | Retry limit reached; automation failure was recorded. |
