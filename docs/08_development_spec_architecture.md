# Development Spec And Architecture

이 문서는 현재 repo의 개발 스펙을 PRD 기준으로 확인하고, 구현 구조를 한눈에 볼 수 있도록 정리한 전체 구조도다.

## 결론

현재 구조는 PRD의 핵심 방향과 일치한다.

```text
request JSON
-> Goose recipe 또는 local generator
-> constrained template generator
-> generated-sites/{company_id}/
-> validation harness
-> npm run build
-> generation-result.json
-> generated 또는 manual_required
```

이 프로젝트는 고객용 AI 채팅 빌더가 아니다. 고객 입력 완료 뒤 내부 담당자가 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent와 Harness로 자동화하는 시스템이다.

사람 승인 단계는 만들지 않는다. 자동 validation/build를 통과하면 `generated` 또는 `published`로 기록하고, 실패하면 retry 후 `manual_required`로 넘긴다.

## 전체 구조도

```mermaid
flowchart TD
  A[Customer STEP completed] --> B[Homepage request JSON]
  B --> C[Homepage generation job]
  C --> D[scripts/run-homepage-builder.sh]
  D --> E[scripts/validate-request.mjs]
  E --> F{GOOSE_MODE}
  F -->|required or auto with Goose| G[Goose recipe]
  F -->|local or Goose unavailable in auto| H[Local deterministic generator]
  G --> I[scripts/generate-static-site.mjs]
  H --> I
  I --> J[templates/company_intro_basic or product_basic]
  J --> K[generated-sites/{company_id}]
  K --> L[harness generated-site validation]
  L --> M[npm run build]
  M --> N[scripts/update-generation-result.mjs]
  N --> O{final status}
  O -->|passed| P[generated or published]
  O -->|retry exhausted| Q[manual_required]
```

## 주요 모듈 책임

| 영역 | 경로 | 책임 |
| --- | --- | --- |
| 제품 스펙 | `PRD.md`, `docs/01_project_intent.md` | 고객 입력 이후 내부 제작 자동화라는 범위 고정 |
| 참고 흐름 | `docs/02_reference_images.md`, `docs/pics/` | 기존 입력 STEP과 결과 맥락 이해, 디자인 복제 금지 |
| Harness 전략 | `docs/03_harness_strategy.md`, `harness/validation-rules.md` | 승인 없는 자동 생성의 검증 기준 정의 |
| 실행 진입점 | `scripts/run-homepage-builder.sh` | request 검증, Goose/local 실행, retry, build, final result 갱신 |
| Goose 실행 | `recipes/homepage-builder.recipe.yaml`, `prompts/goose_homepage_builder.md` | Agent가 지켜야 할 읽기 순서, 금지사항, 생성 계약 정의 |
| deterministic generator | `scripts/generate-static-site.mjs` | request 기반 파일 생성, template 선택, output 격리 |
| 템플릿 | `templates/company_intro_basic/`, `templates/product_basic/` | 자유 디자인 방지, 허용 섹션과 layout control 제한 |
| 스키마 | `schemas/*.json` | request, generation-result, template config 계약 문서화 |
| request 검증 | `scripts/validate-request.mjs` | 필수 필드, enum, company_id path safety, fixed draft controls 검증 |
| output 검증 | `harness/validators/validate-generated-site.mjs` | 필수 파일, template compliance, no fake claims, request-bound content 검증 |
| report 갱신 | `scripts/update-generation-result.mjs` | `generation-result.json`, `agent-run-report.*` 최종 상태 기록 |
| preview app | `frontend/` | 생성 결과 목록, 테스트 입력 화면, `/homepage/{company_id}` preview |
| batch queue | `jobs/`, `scripts/run-pending-homepage-jobs.mjs` | pending job 처리, completed/failed 이동, batch report 생성 |

## 데이터 계약

현재 가장 중요한 정리 원칙은 `confirmed request JSON`을 builder의 공식 입력 계약으로 고정하는 것이다. draft/session/conversation 데이터는 고객 입력 보조 또는 테스트 UI 계층의 데이터이며, core builder contract를 직접 오염시키지 않는 편이 안전하다.

### Input: homepage request

필수 필드는 다음이다.

```text
request_id
company_id
homepage_type
company_name
industry
business_type
main_business_description
```

`homepage_type`은 `company_intro` 또는 `product`만 허용한다.

선택 필드는 `one_line_intro`, `company_intro`, `core_strengths`, `products`, `portfolio`, `history`, `preferred_style`, draft control 필드 등이다. 생성기는 request에 있는 사실만 사용할 수 있다.

Copy 우선순위는 다음처럼 고정한다.

```text
1. request에 one_line_intro/company_intro/core_strengths가 있으면 exact copy
2. 없으면 main_business_description에서 safe summary만 허용
3. 상품/연혁/포트폴리오/연락처/태그/이미지는 request에 있는 항목만 렌더링
4. request에 없는 사업 성과, 인증, 수상, 고객사, 수치, 상품명은 생성 금지
```

따라서 "문구 생성/보정"은 새로운 사실을 추가하는 의미가 아니라, request 근거 안에서 안전하게 요약하거나 표현을 정돈하는 의미로 제한한다.

### Output: generated site

회사별 산출물은 반드시 아래에 격리된다.

```text
generated-sites/{company_id}/
```

현재 필수 산출물은 다음이다.

```text
content.json
assets.json
metadata.json
page.tsx
index.html
styles.css
generation-result.json
validation-report.json
agent-run-report.json
agent-run-report.md
```

PRD 필수 파일보다 실제 구현이 더 많은 운영/preview 파일을 생성한다. 이는 정적 확인과 실행 telemetry를 위해 추가된 형태다.

## Template 선택 규칙

```text
homepage_type=company_intro -> company_intro_basic
homepage_type=product        -> product_basic
```

`company_intro_basic` 필수 섹션:

```text
hero
company_intro
core_strengths
contact_cta
```

`product_basic` 필수 섹션:

```text
hero
company_intro
core_strengths
product_area 또는 product_registration_cta
contact_cta
```

상품 정보가 없으면 상품 카드를 만들지 않고 `product_registration_cta`를 생성한다. 연혁, 포트폴리오, 상품, 연락처, 태그는 request에 있을 때만 렌더링한다.

## 상태 전이

상태는 두 층으로 나누어 이해해야 한다.

- `job_status`: queue와 runner 내부 진행 상태. `requested`, `queued`, `agent_running`, `validating` 같은 lifecycle 상태를 포함할 수 있다.
- `generation_result.status`: 산출물의 terminal 결과. `generation-result.json`에 기록되고 validator가 검사하는 상태다.

```mermaid
stateDiagram-v2
  [*] --> requested
  requested --> validating_request
  validating_request --> agent_running
  agent_running --> validating_output
  validating_output --> building
  building --> generated
  building --> published
  agent_running --> agent_failed
  validating_output --> validation_failed
  building --> build_failed
  agent_failed --> manual_required
  validation_failed --> manual_required
  build_failed --> manual_required
```

MVP의 `generation-result.json` terminal status enum은 다음만 허용한다.

```text
generated
published
agent_failed
validation_failed
build_failed
manual_required
```

`ready_for_review`, `approved`, `reviewing`, `review_rejected`는 금지 상태다.

현재 문서와 코드에서 `generated`와 `published`의 경계는 아직 충분히 닫혀 있지 않다. MVP 기본 성공 상태는 `generated`이며, `published`는 별도 공개/배포 규칙이 생긴 뒤 명시적으로 전환하는 상태로 정의하는 것이 안전하다.

## No Fake Claims 방어선

현재 검증은 단순 금칙어 이상을 수행한다.

- `company_name`은 request와 exact match
- `one_line_intro`, `company_intro`, `core_strengths`는 제공 시 request와 exact match
- `products`, `history`, `portfolio`는 request 항목만 허용
- `tags`, `contact`, `cover_image_url`도 request-bound로 검증
- 고위험 문구는 request 근거 없으면 실패
- `products`가 비어 있으면 product card 생성 실패 처리

금지 대표 항목:

```text
업력, 설립연도, 인증, 수상, 고객사, 납품 실적, 매출, 순위, 특허,
입력에 없는 상품, 입력에 없는 연혁, 입력에 없는 포트폴리오
```

## 실행 모드

| 모드 | 의미 |
| --- | --- |
| `GOOSE_MODE=local` | Goose 없이 deterministic generator만 실행 |
| `GOOSE_MODE=auto` | Goose가 있으면 recipe 실행, 없으면 local fallback |
| `GOOSE_MODE=required` | Goose recipe 필수. Goose/Provider 실패 시 실패로 기록 |

Goose recipe 내부에서는 outer runner인 `scripts/run-homepage-builder.sh`를 다시 호출하지 않는다. Goose는 constrained generator를 실행하고 validation을 확인하며, retry와 최종 status 갱신은 outer runner가 담당한다.

현재 MVP의 실제 builder 책임은 대부분 `scripts/generate-static-site.mjs`에 집중돼 있다. 즉 현재 구조는 "deterministic local builder + Goose executor"에 가깝다. PRD의 Orchestrator/Planning/Content/Asset/Builder 역할 분해는 다음 단계에서 모듈로 나누면 repair loop와 AI 판단 범위를 더 명확하게 만들 수 있다.

## Core 와 UI 경계

Core generation engine:

```text
confirmed request JSON
-> scripts/run-homepage-builder.sh
-> recipes/homepage-builder.recipe.yaml 또는 local generator
-> scripts/generate-static-site.mjs
-> generated-sites/{company_id}
-> validation/build/report
```

UI/demo/draft layer:

```text
frontend/app/test-builder
frontend/app/api/homepage-drafts
frontend/app/api/homepage-generation-jobs
frontend/lib/homepage-drafts.ts
```

이 계층은 request를 만들거나 draft를 확정하는 보조 계층이다. builder가 공식적으로 받아야 하는 것은 draft session이 아니라 확정된 request JSON이어야 한다.

현재 `homepage-generation-jobs` API는 job을 큐에 넣기만 하는 방식이 아니라 요청 처리 중 동기식으로 `scripts/run-homepage-builder.sh`를 실행하고, runner는 `npm run build`까지 수행한다. 이 구조는 MVP 데모에는 단순하지만 API 응답 지연, build lock 직렬화, Next 서버와 생성 실패의 결합을 만든다. 운영 구조에서는 API를 enqueue-only로 두고 `jobs/` batch runner 또는 별도 worker가 생성/빌드를 담당하는 구조가 더 안정적이다.

## 검증 명령

필수 확인 명령:

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
bash scripts/validate-generated-site.sh generated-sites/COMPANY_001 requests/sample-company-intro.json
npm run build
```

Harness 전체 회귀 확인:

```bash
npm run test:harness
```

Goose 설정 확인:

```bash
npm run goose:check
npm run goose:preflight
```

## 현재 확인된 구현 갭

1. Canonical contract 문서가 아직 나뉘어 있다.

PRD, output requirements, validation rules, schema, validator가 각각 request/status/template/output 규칙을 일부씩 들고 있다. 구현 기준은 `request contract`, `status model`, `template contract`, `output contract`, `validation matrix`로 분리해 단일 출처를 정해야 한다.

2. JSON Schema와 수동 validator가 이중 관리된다.

`schemas/homepage-request.schema.json`과 `scripts/validate-request.mjs`가 같은 계약을 별도로 들고 있다. 필드가 늘어날수록 drift 위험이 있다. 다음 단계에서는 schema를 source of truth로 삼고 validator가 schema를 실행하는 구조가 좋다.

3. `schemas/template-config.schema.json`이 실제 template config보다 좁다.

실제 template config에는 `editable_slots`, `required_visible_sections`, `allowed_section_layout`, `default_section_layout`, `allowed_content_density`, `default_content_density`가 있다. 현재 schema는 이 필드를 정의하지 않아 template config schema validation을 본격 도입하면 실패할 수 있다.

4. 템플릿 필수 섹션 정의가 문서마다 다르다.

PRD는 `service_summary 또는 business_summary`를 회사소개형 필수에 가깝게 표현하지만, validator와 output requirements에서는 optional 또는 비필수로 다룬다. 템플릿별 필수/선택/empty-data hide 규칙을 단일 표로 고정해야 한다.

5. output artifact 경계가 문서마다 다르다.

PRD 필수 파일, telemetry 파일, static preview 파일이 섞여 있다. `generated source files`, `static preview artifacts`, `reports`, `build artifacts`를 나누고 각 단계별 required file을 명시해야 한다.

6. preview route gate가 최종 상태를 강제하지 않는다.

`frontend/app/api/test-generate/route.ts`는 `generated|published`, validation passed, build passed일 때만 preview를 노출한다. 그러나 `/homepage/{companyId}` route 자체는 `content.json`, `metadata.json`, `generation-result.json`만 읽히면 실패 상태도 렌더링할 수 있다. 운영 공개 route라면 route 레벨에서도 status/build/validation gate를 강제해야 한다. 내부 artifact viewer라면 문서와 UI에서 그 성격을 명확히 분리해야 한다.

7. generation API가 동기식 build까지 수행한다.

`frontend/app/api/homepage-generation-jobs/route.ts` 계층은 job 생성 API처럼 보이지만 실제로는 `spawnSync`로 runner를 실행한다. runner는 다시 validation과 `npm run build`까지 수행한다. 운영에서는 enqueue-only API와 worker/batch runner를 분리하는 편이 좋다.

8. draft/session 계층이 core request contract에 들어와 있다.

`draft_id`, `confirmed_at`, `content_source`, `section_visibility`, `section_layout` 같은 필드는 현재 request schema에 포함되어 있다. 이 중 확정된 생성 제어값은 유지할 수 있지만, draft/session 메타데이터는 별도 envelope 또는 draft schema에 두는 것이 core builder 경계를 더 선명하게 만든다.

9. AI 판단 산출물이 아직 명시적이지 않다.

현재 Goose는 안정성을 위해 constrained generator 실행 중심이다. 고도화 시에도 자유 디자인을 열기보다 `site-plan.json`, `copy-evidence.json`, `asset-plan.json`, `repair-plan.json`처럼 schema로 검증 가능한 작은 판단 산출물을 추가하는 방향이 맞다.

10. retry/repair contract가 운영 수준으로 충분히 닫혀 있지 않다.

현재 retry 횟수와 manual_required 전환은 구현되어 있지만, retryable/non-retryable 에러 분류, partial output 정리, provider fallback 조건, retry별 artifact 보존 규칙은 더 문서화해야 한다.

11. build 검증은 전체 Next.js app 기준이다.

신뢰도는 높지만 batch job이 늘면 비용이 커질 수 있다. 추후에는 per-site static validation과 full app build를 단계화할 수 있다.

## 다음 작업 권장 순서

1. `request contract`, `status model`, `template contract`, `output contract`, `validation matrix`를 canonical 문서로 분리한다.
2. `template-config.schema.json`을 실제 config 필드와 맞춘다.
3. request/result/template schema를 validator의 source of truth로 통합한다.
4. API를 enqueue-only로 두고 생성/빌드는 worker 또는 batch runner가 담당하게 분리한다.
5. `/homepage/{companyId}` route에 generated/published + validation/build gate를 추가한다.
6. retry/repair 문서에 retryable error, cleanup, fallback, manual_required 전환 기준을 닫는다.
7. Goose 실행 시 `site-plan.json` 같은 AI 판단 artifact를 추가하되, template/config/component 경계를 넘지 않게 검증한다.
8. batch runner에서 build 비용을 줄일 수 있는 단계별 검증 전략을 설계한다.

## Validation Matrix 초안

| 범주 | 검사 대상 | 실패 조건 |
| --- | --- | --- |
| request schema | `scripts/validate-request.mjs` | 필수값 누락, enum 오류, unsafe `company_id`, unsupported field |
| copy fidelity | `validate-generated-site.mjs` | request에 있는 copy/product/history/portfolio/contact/tag가 누락되거나 변형됨 |
| empty optional | `validate-generated-site.mjs` | 입력이 빈 optional 섹션에 허위 card/item 생성 |
| fake claim | `validate-generated-site.mjs` | 금지 문구 또는 request에 없는 구조적 데이터 생성 |
| template compliance | `validate-generated-site.mjs` | homepage_type과 template_id 불일치, 필수 섹션 누락 |
| result status | `validate-generated-site.mjs` | 금지 status 사용, report와 final status 불일치 |
| build | `npm run build` | Next.js production build 실패 |
| retry/manual_required | `scripts/run-homepage-builder.sh` | retry exhaustion 후 실패 원인 없이 종료하거나 `manual_required` 미기록 |
