# Role-based Harness Task Plan for Codex

이 문서는 Codex에 역할별로 작업을 시킬 때 사용하는 Task Harness다. Codex CLI의 subagent 기능 또는 순차 프롬프트로 실행할 수 있다.

## Role 0. Workflow Orchestrator

### Mission

전체 프로젝트의 순서, 산출물, 의존성을 관리한다.

### Inputs

- PRD.md
- AGENTS.md
- docs/pics/pic1~pic8

### Tasks

1. PRD와 이미지를 읽고 범위 오해를 제거한다.
2. 고객 입력 UI 구현이 핵심이 아니라 신청 완료 후 홈페이지 제작 자동화가 핵심임을 문서화한다.
3. 작업 순서를 확정한다.
4. 각 역할 산출물을 연결한다.

### Outputs

- docs/execution-plan.md
- docs/task-dependency-map.md

### Acceptance Criteria

- 승인 플로우가 포함되지 않아야 한다.
- generated/published 자동 완료 흐름이 있어야 한다.
- manual_required는 실패 예외로만 정의되어야 한다.

---

## Role 1. Reference Flow Analyst

### Mission

제공 이미지와 기존 프로세스 설명을 분석해 자동 제작에 필요한 입력/출력 맥락을 정리한다.

### Inputs

- docs/pics/pic1~pic8
- PRD.md

### Tasks

1. STEP 0~4 흐름 분석.
2. 각 STEP에서 최종 request JSON에 들어갈 수 있는 데이터 추출.
3. 상품중심형/회사소개중심형 차이 정리.
4. 기존 사람이 수동으로 제작할 때 필요했던 후속 작업 정리.

### Outputs

- docs/reference-flow-analysis.md
- docs/manual-production-flow.md

### Acceptance Criteria

- STEP 화면 자체 구현 요구로 흐르지 않아야 한다.
- 신청 완료 이후 수동 제작 업무가 명확해야 한다.

---

## Role 2. Product/Domain Analyst

### Mission

고객 신청 데이터와 홈페이지 결과물 사이의 도메인 규칙을 정의한다.

### Tasks

1. homepage_type enum 정의.
2. 회사소개형/상품형 필수 섹션 정의.
3. 상품 정보가 없을 때 처리 규칙 정의.
4. 연혁/포트폴리오 정보가 없을 때 처리 규칙 정의.
5. 금지된 허위 정보 유형 정의.

### Outputs

- docs/homepage-output-requirements.md
- docs/domain-rules.md

### Acceptance Criteria

- 입력에 없는 상품/연혁/인증/수상이 생성되지 않도록 규칙화되어야 한다.

---

## Role 3. Schema Engineer

### Mission

Agent 입력/출력 계약을 JSON Schema로 고정한다.

### Tasks

1. `schemas/homepage-request.schema.json` 작성.
2. `schemas/generation-result.schema.json` 작성.
3. `schemas/template-config.schema.json` 작성.
4. sample request 3개 작성.

### Outputs

- schemas/homepage-request.schema.json
- schemas/generation-result.schema.json
- schemas/template-config.schema.json
- requests/sample-company-intro.json
- requests/sample-product-empty.json
- requests/sample-product-with-items.json

### Acceptance Criteria

- 필수 필드 누락 시 validation 실패해야 한다.
- status enum이 requested/queued/agent_running/site_generating/validating/generated/published/agent_failed/validation_failed/build_failed/manual_required 범위로 제한되어야 한다.

---

## Role 4. Template System Engineer

### Mission

Goose Agent가 사용할 제한된 템플릿 구조를 만든다.

### Tasks

1. `templates/company_intro_basic/template.config.json` 작성.
2. `templates/product_basic/template.config.json` 작성.
3. 각 템플릿의 필수 섹션/선택 섹션/숨김 규칙 정의.
4. page template 초안 작성.
5. asset category 기본값 정의.

### Outputs

- templates/company_intro_basic/template.config.json
- templates/company_intro_basic/page.template.tsx
- templates/company_intro_basic/assets.json
- templates/product_basic/template.config.json
- templates/product_basic/page.template.tsx
- templates/product_basic/assets.json

### Acceptance Criteria

- Agent가 완전 자유 생성하지 않고 템플릿 규칙 안에서 생성하도록 제한해야 한다.

---

## Role 5. Goose Agent Engineer

### Mission

Goose로 실행 가능한 Homepage Builder Coding Agent recipe와 prompt를 만든다.

### Tasks

1. `prompts/goose_homepage_builder.md` 작성.
2. `recipes/homepage-builder.recipe.yaml` 작성.
3. request_path parameter 정의.
4. generated output path 규칙 정의.
5. validation script 호출 포함.
6. generation-result.json 작성 지시 포함.

### Outputs

- prompts/goose_homepage_builder.md
- recipes/homepage-builder.recipe.yaml
- scripts/run-homepage-builder.sh

### Acceptance Criteria

- Goose recipe 하나로 sample request → generated site 생성 흐름을 실행할 수 있어야 한다.
- provider는 Gemini/ChatGPT/Claude 전환 가능하게 문서화한다.

---

## Role 6. Homepage Builder Engineer

### Mission

Agent가 실제 생성할 파일 구조와 생성 로직을 구현한다.

### Tasks

1. generated-sites/{company_id}/ 생성 규칙 구현.
2. content.json 생성.
3. assets.json 생성.
4. metadata.json 생성.
5. page.tsx 생성.
6. template config를 기준으로 필수 섹션 반영.

### Outputs

- scripts/build-generated-site.sh 또는 equivalent
- generated-sites sample output

### Acceptance Criteria

- sample-company-intro.json으로 생성한 결과가 필수 파일을 포함해야 한다.

---

## Role 7. Validation Harness Engineer

### Mission

사람 승인 없이 자동화하기 위한 검증 스크립트를 만든다.

### Tasks

1. request schema validator 구현.
2. generated site validator 구현.
3. no fake claims checker 구현.
4. template compliance checker 구현.
5. build result checker 구현.
6. validation-report.json 생성.

### Outputs

- harness/validators/validate-request.ts 또는 .js
- harness/validators/validate-generated-site.ts 또는 .js
- harness/validators/check-no-fake-claims.ts 또는 .js
- scripts/validate-generated-site.sh

### Acceptance Criteria

- 상품 정보가 없는데 상품 카드가 생성되면 실패해야 한다.
- 입력에 없는 인증/수상/연혁/고객사/매출이 나타나면 실패해야 한다.

---

## Role 8. Repair Loop Engineer

### Mission

실패한 생성 결과를 자동 재시도하고, 끝까지 실패하면 manual_required로 전환한다.

### Tasks

1. retry_count 관리.
2. max retry 3 설정.
3. validation 실패 시 repair prompt 생성.
4. fallback provider 실행 가능성 문서화.
5. manual_required result 작성.

### Outputs

- docs/repair-loop.md
- scripts/run-homepage-builder.sh retry logic

### Acceptance Criteria

- 실패를 조용히 무시하지 않는다.
- 3회 실패 시 manual_required를 명확히 기록한다.

---

## Role 9. Security/Safety Engineer

### Mission

Agent가 운영 위험 행동을 하지 못하게 한다.

### Tasks

1. workspace boundary 규칙 정의.
2. 임의 패키지 설치 금지 규칙 정의.
3. API key logging 금지 규칙 정의.
4. 외부 배포 명령 금지 규칙 정의.
5. 민감정보 마스킹 규칙 정의.

### Outputs

- docs/security-rules.md
- prompts/security_constraints.md

### Acceptance Criteria

- Goose prompt와 AGENTS.md에 보안 금지사항이 반영되어야 한다.

---

## Role 10. Documentation Engineer

### Mission

개발자가 바로 실행할 수 있도록 문서를 정리한다.

### Tasks

1. README 작성.
2. Goose configure 방법 작성.
3. provider별 설정 방법 문서화.
4. sample 실행 방법 작성.
5. troubleshooting 작성.

### Outputs

- README.md
- docs/setup-goose.md
- docs/troubleshooting.md

### Acceptance Criteria

- 새 개발자가 README만 보고 sample request 실행까지 갈 수 있어야 한다.

---

# Recommended Codex Execution Order

```text
1. Workflow Orchestrator
2. Reference Flow Analyst
3. Product/Domain Analyst
4. Schema Engineer
5. Template System Engineer
6. Goose Agent Engineer
7. Validation Harness Engineer
8. Homepage Builder Engineer
9. Repair Loop Engineer
10. Security/Safety Engineer
11. Documentation Engineer
```

# Master Acceptance Test

최종적으로 Codex는 아래 명령이 동작하도록 만들어야 한다.

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
bash scripts/validate-generated-site.sh generated-sites/COMPANY_001
```

성공 시:

```text
generated-sites/COMPANY_001/generation-result.json
status = generated 또는 published
validation_result.passed = true
```
