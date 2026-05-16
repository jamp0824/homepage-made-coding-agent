# Homepage Output Requirements

## Purpose

This document defines what the Goose Homepage Builder Agent may generate from a completed request JSON. The generator must stay inside known template, config, component, and validation rules.

## Common Generated Files

Every generated site must be isolated under `generated-sites/{company_id}/` and include:

- `content.json`
- `assets.json`
- `metadata.json`
- `page.tsx`
- `generation-result.json`
- `validation-report.json`

## Common Content Rules

- Use `company_name` exactly from the request.
- Prefer request-provided `one_line_intro`, `company_intro`, and `core_strengths`.
- If optional copy is missing, create only safe summaries from required request fields.
- Do not generate awards, certifications, customers, revenue, ranking, patents, delivery records, years of experience, products, history, or portfolio unless present in the request.
- Do not use unsupported high-risk phrases such as `업계 1위`, `국내 최고`, `압도적`, `인증받은`, `수상 경력`, `다수의 고객사`, `10년 이상`, `매출`, `납품 실적`, or `특허`.

## Company Intro Homepage

Use `company_intro_basic`.

Required visible sections:

- `hero`
- `company_intro`
- `core_strengths`
- `contact_cta`

Optional sections:

- `business_summary`
- `history`
- `portfolio`
- `gallery`

Rules:

- Hide `history` when `history` is empty.
- Hide `portfolio` when `portfolio` is empty.
- Do not create fake timeline entries or portfolio examples.

## Product Homepage

Use `product_basic`.

Required visible sections:

- `hero`
- `company_intro`
- `core_strengths`
- `product_area` or `product_registration_cta`
- `contact_cta`

Rules:

- If `products` has items, render only the product names/descriptions from the request.
- If `products` is empty, do not create product cards.
- If `products` is empty, render `product_registration_cta` instead.

## Asset Rules

- Choose `asset_theme` from the template config by industry when possible.
- Use fallback assets when no specific asset is available.
- Do not imply facilities, certifications, clients, products, or team size through asset metadata.

## Success Result

When validation and build checks pass, `generation-result.json` may use:

- `generated`
- `published`

## Failure Result

After retry exhaustion, write:

- `manual_required`

`manual_required` is not an approval state. It means automation failed and the existing manual production process must handle the case.
