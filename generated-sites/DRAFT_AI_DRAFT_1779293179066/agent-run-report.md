# Agent Run Report

## Summary

- request_id: REQ_DRAFT_1779293179066
- company_id: DRAFT_AI_DRAFT_1779293179066
- request_path: /Users/junonan/Downloads/goose-homepage-builder-harness/harness/tmp/homepage-generation-requests/JOB_1779293263278.json
- generated_path: generated-sites/DRAFT_AI_DRAFT_1779293179066
- homepage_type: company_intro
- template_id: company_intro_basic
- final_status: generated
- retry_count: 1
- completed_at: 2026-05-20T16:08:32.521Z

## Validation

- passed: true

- none

## Build

- passed: true
- command: npm run build

- none

## Timeline

| Step | Status | Message |
| --- | --- | --- |
| requested | completed | Request file was accepted by the runner. |
| validating_request | completed | Request schema validation passed before generation. |
| agent_running | completed | Homepage files were generated under generated-sites/{company_id}. |
| validating_output | completed | Generated-site validation passed. |
| building | completed | Next.js build passed. |
| generated | completed | Final status recorded as generated. |
