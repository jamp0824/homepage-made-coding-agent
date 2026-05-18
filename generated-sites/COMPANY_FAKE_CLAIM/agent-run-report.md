# Agent Run Report

## Summary

- request_id: REQ_FAKE_CLAIM_001
- company_id: COMPANY_FAKE_CLAIM
- request_path: harness/fixtures/fake-claim-request.json
- generated_path: generated-sites/COMPANY_FAKE_CLAIM
- homepage_type: company_intro
- template_id: company_intro_basic
- final_status: manual_required
- retry_count: 1
- completed_at: 2026-05-18T16:59:54.287Z

## Validation

- passed: false

- Unsupported high-risk phrase found: 업계 1위
- Unsupported high-risk phrase found: 수상 경력

## Build

- passed: false
- command: npm run build

- generated site validation failed

## Timeline

| Step | Status | Message |
| --- | --- | --- |
| requested | completed | Request file was accepted by the runner. |
| validating_request | completed | Request schema validation passed before generation. |
| agent_running | completed | Homepage files were generated under generated-sites/{company_id}. |
| validating_output | failed | Generated-site validation failed. |
| building | failed | Next.js build failed or was not completed. |
| manual_required | failed | Retry limit reached; automation failure was recorded. |
