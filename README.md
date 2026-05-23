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
- `frontend/`: 생성 결과 미리보기와 `docs/pics` 레퍼런스 재현용 Next.js 화면
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
npm run goose:preflight
```

실행 모드:

```bash
GOOSE_MODE=auto bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
GOOSE_MODE=local bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

`GOOSE_MODE=required`는 실제 Goose recipe만 사용합니다. 이 repo의 runner 모드 이름과 Goose CLI의 tool mode 환경변수 이름이 겹치므로, 실제 Goose 호출은 `scripts/run-goose-homepage-recipe.sh`가 담당합니다. Goose 내부 tool mode는 기본 `auto`이며 필요하면 `GOOSE_TOOL_MODE`로 바꿀 수 있습니다.

Goose provider/model 설정이 없으면 preflight에서 멈춥니다.

```bash
goose configure
```

또는 실행 시 환경변수로 지정합니다.

```bash
GOOSE_PROVIDER=openai GOOSE_MODEL=gpt-4.1 GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

Provider 설정이 끝난 뒤에는 아래 한 명령으로 Goose-only end-to-end를 실행할 수 있습니다.

```bash
npm run goose:e2e -- requests/sample-company-intro.json
```

E2E 실행 증거는 생성 사이트 결과와 분리해 아래에 남깁니다.

```text
reports/e2e/latest.json
reports/e2e/latest.md
reports/e2e/{timestamp}-{request_id}.json
reports/e2e/{timestamp}-{request_id}.md
```

보고서에는 provider/model, 실행 시간, 최종 상태, validation/build 결과만 기록하며 API key나 OAuth token은 저장하지 않습니다.

`npm run build`는 Next.js production build를 실행합니다. dev server와 build가 서로 `.next` 파일을 덮어쓰지 않도록 production build는 `.next-build/`를 사용합니다. build wrapper는 `.next-build.lock`으로 동시 실행을 막고, 중단된 빌드가 남긴 오래된 lock은 기본 10분 뒤 stale로 판단해 자동 복구합니다. 필요하면 `NEXT_BUILD_LOCK_STALE_MS`로 조정할 수 있습니다. build 자체도 기본 10분 timeout을 두며 `NEXT_BUILD_TIMEOUT_MS`로 조정 가능합니다. 패키지를 설치하지 않은 초기 환경에서는 먼저 `npm install`이 필요합니다.

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

`docs/pics`의 입력 STEP 화면을 확인하는 테스트 전용 route도 분리되어 있습니다.

```text
http://localhost:3000/reference-flow
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

## Fixed Template Draft API

대화형 고도화는 자유 템플릿 생성이 아니라 `result_template.png` 구조 안의 draft를 수정하는 방식으로 분리되어 있습니다.

```text
conversation
-> content.draft.json
-> user-confirmed request JSON
-> scripts/run-homepage-builder.sh
-> generated-sites/{company_id}
```

추가된 API:

```text
POST  /api/homepage-drafts                         # initial_prompt + 기업 정보로 초안 생성
GET   /api/homepage-drafts/{draft_id}
PATCH /api/homepage-drafts/{draft_id}
POST  /api/homepage-drafts/{draft_id}/messages     # 대화 요청을 허용된 draft patch로 반영
POST  /api/homepage-generation-jobs                # draft_id 확정 후 기존 생성 파이프라인 실행
GET   /api/homepage-generation-jobs/{job_id}
```

Goose draft/edit agent는 새 디자인을 만들지 않고 아래 값만 조정합니다.

```text
one_line_intro
company_intro
core_strengths
section_visibility
section_layout
content_density
```

`/test-builder`는 아래 UX로 연결되어 있습니다.

```text
start -> prompt -> draft-preview -> chat-edit -> confirm-generate -> done
```

`initial_prompt`는 draft/session 메타데이터에만 보관하고, 최종 공개 request JSON에는 포함하지 않습니다.

Draft 검증:

```bash
npm run draft:validate -- harness/tmp/homepage-drafts/{draft_id}/content.draft.json
npm run goose:draft -- harness/tmp/homepage-drafts/{draft_id}/content.draft.json "핵심 강점을 카드형으로 보여줘"
```

최종 생성은 여전히 기존 검증 명령을 통과해야 합니다.

## Pending Job Batch Runner

여러 request JSON을 큐처럼 처리하려면 `jobs/pending/`에 request 파일을 넣고 실행합니다.

웹 테스트 빌더의 `생성` 버튼도 같은 async queue를 사용합니다. API는 job을 `queued`로 넣고 바로 반환하므로, 로컬에서 실제 처리를 보려면 개발 서버와 worker를 별도 터미널에서 실행합니다.

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run jobs:run
```

`jobs:run`은 상시 daemon이 아니라 one-shot worker입니다. 실행 시점에 `jobs/pending/`에 있는 작업을 처리하고 종료합니다. `/test-builder`에서 생성 작업이 오래 `queued` 상태로 남아 있으면 다시 `npm run jobs:run`을 실행해 pending 작업을 처리하세요.

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

개별 작업의 상태는 queue 디렉토리와 per-job report에서 확인할 수 있습니다.

```text
jobs/pending/{job_id}.json
jobs/processing/{job_id}.json
jobs/completed/{job_id}.json
jobs/completed/{job_id}.json.job-report.json
jobs/failed/{job_id}.json
jobs/failed/{job_id}.json.job-report.json
generated-sites/{company_id}/generation-result.json
generated-sites/{company_id}/agent-run-report.json
```
