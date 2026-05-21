# Agent Run Report

## Summary

- request_id: REQ_COMPANY_001
- company_id: COMPANY_001
- request_path: harness/tmp/batch-jobs/completed/sample-company-intro.json
- generated_path: generated-sites/COMPANY_001
- homepage_type: company_intro
- template_id: company_intro_basic
- final_status: generated
- retry_count: 1
- completed_at: 2026-05-21T07:17:53.110Z

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
