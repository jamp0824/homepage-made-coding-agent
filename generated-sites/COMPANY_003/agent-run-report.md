# Agent Run Report

## Summary

- request_id: REQ_PRODUCT_ITEMS_001
- company_id: COMPANY_003
- request_path: requests/sample-product-with-items.json
- generated_path: generated-sites/COMPANY_003
- homepage_type: product
- template_id: product_basic
- final_status: generated
- retry_count: 1
- completed_at: 2026-05-17T05:23:45.167Z

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
