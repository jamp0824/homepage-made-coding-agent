# Agent Run Report

## Summary

- request_id: REQ_COMPANY_HISTORY_001
- company_id: COMPANY_HISTORY_001
- request_path: harness/fixtures/company-intro-history-portfolio.json
- generated_path: generated-sites/COMPANY_HISTORY_001
- homepage_type: company_intro
- template_id: company_intro_basic
- final_status: generated
- retry_count: 1
- completed_at: 2026-05-16T17:11:21.781Z

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
