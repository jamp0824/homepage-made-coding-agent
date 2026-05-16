# Harness Strategy

## Why Harness Matters

이 프로젝트에는 사람 승인 단계가 없다. 따라서 Harness가 자동 검수자 역할을 해야 한다.

Agent가 홈페이지를 생성한 뒤 다음이 자동으로 확인되어야 한다.

- 입력 데이터가 유효한가
- 올바른 템플릿을 선택했는가
- 필수 파일이 생성되었는가
- 필수 콘텐츠가 반영되었는가
- 입력에 없는 사실을 만들지 않았는가
- 빌드가 되는가
- 생성 결과가 report로 남는가

## Harness Layers

### 1. Context Harness

Agent가 길을 잃지 않게 하는 문서/이미지 묶음.

- PRD.md
- AGENTS.md
- docs/pics/pic1~pic8
- docs/reference-flow-analysis.md
- docs/homepage-output-requirements.md

### 2. Contract Harness

입력/출력 구조를 고정한다.

- schemas/homepage-request.schema.json
- schemas/generation-result.schema.json
- schemas/template-config.schema.json

### 3. Prompt Harness

Goose Agent가 지켜야 할 역할과 금지사항을 고정한다.

- prompts/goose_homepage_builder.md
- prompts/content_rules.md
- prompts/no_fake_claims.md

### 4. Execution Harness

반복 실행 가능한 workflow.

- recipes/homepage-builder.recipe.yaml
- scripts/run-homepage-builder.sh
- generated-sites/{company_id}/ isolation

### 5. Validation Harness

자동 검증.

- validate-request
- validate-generated-site
- check-no-fake-claims
- check-template-compliance
- check-build-result

### 6. Repair Harness

실패 시 자기수정/재시도.

- retry max 3
- same provider repair
- fallback provider option
- manual_required fallback

### 7. Telemetry Harness

결과 기록.

- generation-result.json
- validation-report.json
- agent-run-report.md

## Harness Completion Criteria

Harness가 완성되었다고 보려면 다음 조건을 만족해야 한다.

1. sample request 3개가 있다.
2. 각 sample request가 schema를 통과한다.
3. Goose recipe가 request path를 parameter로 받을 수 있다.
4. generated-sites/{company_id}/가 생성된다.
5. validation script가 generated site를 검사한다.
6. 실패 사유가 validation-report.json에 기록된다.
7. generation-result.json이 성공/실패 상태를 명확히 기록한다.
