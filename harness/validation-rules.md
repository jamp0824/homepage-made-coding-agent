# Validation Rules

## 1. Request Validation

The request must include:

- request_id
- company_id
- homepage_type
- company_name
- industry
- business_type
- main_business_description

homepage_type must be one of:

- company_intro
- product

## 2. Generated File Validation

For every generated site, the following files must exist:

- content.json
- assets.json
- metadata.json
- page.tsx
- generation-result.json

## 3. Content Validation

Generated content must include:

- company_name
- company_intro or safe summary from main_business_description
- at least one visible core strength or business summary
- homepage_type
- template_id

## 4. Template Compliance

If homepage_type is `company_intro`, template_id must be `company_intro_basic`.

If homepage_type is `product`, template_id must be `product_basic`.

Company intro template must include:

- hero
- company_intro
- core_strengths
- contact_cta

Product template must include:

- hero
- company_intro
- core_strengths
- product_area or product_registration_cta
- contact_cta

## 5. No Fake Claims

Generated content must not include information that was not present in the request.

Forbidden invented claims:

- years of experience
- established year
- awards
- certifications
- client/customer names
- delivery records
- sales/revenue numbers
- market ranking
- patents
- product names not present in products
- portfolio items not present in portfolio
- history items not present in history

High-risk Korean phrases to flag unless supported:

- 업계 1위
- 국내 최고
- 압도적
- 인증받은
- 수상 경력
- 다수의 고객사
- 10년 이상
- 풍부한 연혁
- 매출
- 납품 실적
- 특허

## 6. Product Rules

If `products` is empty:

- Do not create product cards.
- Do create product registration CTA if homepage_type is product.
- Do not invent product names.

If `products` has items:

- Use only product names and descriptions present in request.

## 7. History/Portfolio Rules

If `history` is empty:

- Do not create fake history.

If `portfolio` is empty:

- Do not create fake portfolio items.

## 8. Build Validation

The generated site must be buildable by the configured command.

Default expected commands:

```bash
npm run build
```

If build is not available in the MVP scaffold, a placeholder build check must still verify that generated files are syntactically valid enough for handoff.

## 9. Result Validation

`generation-result.json` must include:

- request_id
- company_id
- status
- homepage_type
- template_id
- generated_path
- generated_files
- validation_result
- retry_count

status must be one of:

- generated
- published
- agent_failed
- validation_failed
- build_failed
- manual_required

## 10. Manual Required Rule

manual_required is not an approval state.

It means:

- automatic generation failed
- retry limit reached
- existing human manual process should handle the case
