# Goose Homepage Builder Harness Starter

이 패키지는 고객이 홈페이지 만들기 입력을 완료한 뒤, 기존에 회사 내부 사람이 수동으로 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent가 자동 수행하도록 만들기 위한 PRD/Harness/Codex 작업 지시서입니다.

## 핵심 전제

- 고객 입력 STEP 화면 자체를 새로 만드는 프로젝트가 아니다.
- 고객 입력 완료 이후의 내부 제작 업무를 자동화한다.
- 결과 승인 단계는 없다.
- 대신 자동 validation/build harness를 통과해야 generated/published 상태로 전환한다.
- Goose는 무료/오픈소스 Coding Agent 실행기로 사용한다.
- 모델은 기존 ChatGPT/Claude/Gemini API 또는 구독 연동을 사용한다.
- Codex는 이 시스템을 구현하는 개발 Agent로 사용한다.

## 사용 순서

1. `PRD.md`를 Codex에 최상위 요구사항으로 제공한다.
2. `AGENTS.md`를 repo root에 둔다.
3. 제공 이미지 8개를 `docs/pics/`에 둔다. 이 패키지는 이미 pic1~pic8 이름으로 복사해두었다.
4. `prompts/codex_master_prompt.md`를 Codex 첫 프롬프트로 사용한다.
5. `docs/04_role_task_harness.md` 기준으로 역할별 subagent 또는 순차 작업을 실행한다.
6. `recipes/homepage-builder.recipe.yaml`을 Goose recipe 초안으로 사용한다.
7. `harness/validation-rules.md`와 schemas를 기준으로 자동 검증 스크립트를 구현한다.

## 주요 산출물

- `PRD.md`: 전체 제품 요구사항
- `AGENTS.md`: Codex 프로젝트 지침
- `docs/04_role_task_harness.md`: 역할별 Harness 태스크
- `prompts/codex_master_prompt.md`: Codex 첫 실행 지시문
- `prompts/goose_homepage_builder.md`: Goose Agent 실행 프롬프트
- `schemas/*.json`: 입력/출력/템플릿 스키마
- `recipes/homepage-builder.recipe.yaml`: Goose recipe 초안
- `harness/validation-rules.md`: 검증 규칙

## MVP 실행

Goose가 설치되어 있으면 `scripts/run-homepage-builder.sh`가 Goose recipe 실행을 시도합니다. 아직 Goose가 없는 로컬 환경에서는 임의 패키지 설치 없이 deterministic placeholder generator를 사용해 sample request에서 생성 결과와 validation report를 만듭니다.

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
bash scripts/validate-generated-site.sh generated-sites/COMPANY_001 requests/sample-company-intro.json
npm run build
```

`scripts/run-homepage-builder.sh`는 request schema validation, generated-site validation, Next.js production build, `generation-result.json` 상태 갱신을 순서대로 실행합니다. validation/build가 통과해야 `status=generated`가 기록됩니다. 실패하면 retry 후 `manual_required`로 전환됩니다.

Goose recipe와 prompt는 이 동일한 harness contract를 따릅니다.

- `recipes/homepage-builder.recipe.yaml`
- `prompts/goose_homepage_builder.md`

Goose CLI 확인:

```bash
npm run goose:check
```

실행 모드:

```bash
GOOSE_MODE=auto bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
GOOSE_MODE=local bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

`npm run build`는 Next.js production build를 실행합니다. dev server와 build가 서로 `.next` 파일을 덮어쓰지 않도록 production build는 `.next-build/`를 사용합니다. 패키지를 설치하지 않은 초기 환경에서는 먼저 `npm install`이 필요합니다.

생성된 홈페이지는 현재 정적 HTML 결과물로 바로 확인할 수 있습니다.

```text
generated-sites/COMPANY_001/index.html
```

Next.js dev server를 실행하면 앱 URL에서도 확인할 수 있습니다.

```bash
npm run dev
```

```text
http://localhost:3000/homepage/COMPANY_001
http://localhost:3000/homepage/COMPANY_002
http://localhost:3000/homepage/COMPANY_003
```

각 회사 디렉토리에는 React/Next 통합을 위한 `page.tsx`와, 즉시 브라우저 확인이 가능한 `index.html`/`styles.css`가 함께 생성됩니다.

각 실행은 회사별 디렉토리에 job telemetry도 남깁니다.

```text
generated-sites/COMPANY_001/agent-run-report.json
generated-sites/COMPANY_001/agent-run-report.md
```

`agent-run-report.json`은 시스템이 읽기 좋은 실행 이벤트와 최종 상태를 담고, `agent-run-report.md`는 사람이 확인하기 좋은 요약 보고서입니다.

## Harness 테스트

정상 request 3개, invalid request, fake claim으로 인한 `manual_required` 전환을 한 번에 확인합니다.

```bash
npm run test:harness
```

## Pending Job Batch Runner

여러 request JSON을 큐처럼 처리하려면 `jobs/pending/`에 request 파일을 넣고 실행합니다.

request JSON을 직접 쓰지 않고 pending job을 만들 수도 있습니다.

```bash
npm run jobs:create -- \
  --request-id REQ_100 \
  --company-id COMPANY_100 \
  --homepage-type company_intro \
  --company-name "주식회사 테스트" \
  --industry "IT·소프트웨어" \
  --business-type "소프트웨어 개발 및 공급" \
  --main-business-description "업무 자동화 솔루션을 개발하고 기업에 공급합니다." \
  --core-strengths "업무 자동화|데이터 관리|기업 맞춤"
```

그러면 아래 파일이 생성됩니다.

```text
jobs/pending/REQ_100.json
```

```bash
npm run jobs:run
```

처리 중에는 `jobs/processing/`으로 이동하고, 결과에 따라 아래로 이동합니다.

```text
jobs/completed/
jobs/failed/
```

batch 실행 결과는 아래에 남습니다.

```text
jobs/batch-run-report.json
jobs/batch-run-report.md
```
