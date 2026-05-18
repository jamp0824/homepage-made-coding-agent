# UI to Generated Homepage Flow

이 문서는 `/test-builder` 화면에서 사용자가 회사 정보를 입력한 뒤 실제 홈페이지가 생성되는 코드 흐름을 설명한다.

## 실제로 홈페이지를 만드는가?

만든다.

다만 이 시스템은 AI가 매번 완전히 자유롭게 새 홈페이지 코드를 창작하는 방식이 아니다. 제품 요구사항에 따라 Goose 기반 Coding Agent가 정해진 request schema, template, generator, validation harness 안에서 홈페이지 산출물을 생성한다.

성공 시 생성되는 실제 파일 위치는 다음과 같다.

```text
generated-sites/{company_id}/
```

대표 생성 파일:

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

Next.js preview route는 이 산출물을 읽어 아래 URL로 보여준다.

```text
/homepage/{company_id}
```

예시 성공 응답:

```json
{
  "generationMode": "required",
  "modelProvider": "goose_agent",
  "status": "generated",
  "homepageUrl": "/homepage/UI_COMPANY_1779005338510",
  "validationPassed": true,
  "buildPassed": true,
  "previewAvailable": true
}
```

## 사용자 화면 흐름

사용자는 로컬 dev server에서 아래 화면에 들어간다.

```text
/test-builder
```

구현 파일:

```text
frontend/app/test-builder/page.tsx
frontend/app/test-builder/TestBuilderForm.tsx
```

화면에서 입력하는 정보:

- 홈페이지 유형
- 회사명
- 업종: 등록된 기업 정보에서 가져온 값이며 화면에서 수정 가능
- 업태 (`business_type`): 등록된 기업 정보에서 가져온 값이며 화면에서 수정 가능
- 주요 사업 설명
- 한 줄 소개
- 회사 소개
- 핵심 강점
- 상품 정보
- 생성 방식

현재 사용자가 실제 AI 생성 체험을 하려면 생성 방식은 `Goose 필수`를 사용한다.

`Goose 필수`는 API에서 `GOOSE_MODE=required`로 변환된다. 이 모드에서는 Goose가 실패해도 local generator로 fallback하지 않는다.

## API 흐름

화면은 완료 버튼 클릭 시 아래 API를 호출한다.

```text
POST /api/test-generate
```

구현 파일:

```text
frontend/app/api/test-generate/route.ts
```

API가 하는 일:

1. 화면 payload를 받는다.
2. 필수값을 검증한다.
3. 내부 request JSON 형식으로 변환한다.
4. request JSON을 `harness/tmp/ui-requests/{request_id}.json`에 저장한다.
5. 실행 로그 파일을 `harness/tmp/ui-runs/{request_id}.log`에 만든다.
6. `scripts/run-homepage-builder.sh`를 실행한다.
7. 생성 결과 파일 `generated-sites/{company_id}/generation-result.json`을 읽는다.
8. 화면에 status, preview URL, validation/build 결과를 반환한다.

API가 만드는 request JSON 예시:

```json
{
  "request_id": "REQ_UI_...",
  "company_id": "UI_COMPANY_...",
  "homepage_type": "company_intro",
  "company_name": "주식회사 넥스트오토",
  "industry": "제조 자동화",
  "business_type": "스마트팩토리 설비 모니터링 솔루션 개발 및 공급",
  "main_business_description": "공장 설비 데이터를 실시간으로 수집하고 이상 징후를 빠르게 감지하는 스마트팩토리 모니터링 솔루션을 개발하고 공급합니다.",
  "one_line_intro": "공장 설비 상태를 실시간으로 확인하는 스마트팩토리 모니터링 솔루션",
  "company_intro": "주식회사 넥스트오토는 제조 현장의 설비 데이터를 수집하고 운영자가 빠르게 의사결정할 수 있도록 모니터링 화면과 알림 기능을 제공하는 회사입니다.",
  "core_strengths": [
    "실시간 설비 모니터링",
    "이상 징후 알림",
    "제조 현장 맞춤 구축"
  ],
  "products": [],
  "portfolio": [],
  "history": [],
  "preferred_style": "clean"
}
```

## Builder Runner 흐름

API는 아래 스크립트를 실행한다.

```bash
GOOSE_MODE=required bash scripts/run-homepage-builder.sh {request_path}
```

구현 파일:

```text
scripts/run-homepage-builder.sh
```

runner가 하는 일:

1. request JSON 존재 여부 확인
2. request schema 검증
3. `GOOSE_MODE` 확인
4. Goose 실행
5. 필수 생성 파일 존재 확인
6. generated-site validation 실행
7. Next.js build 실행
8. 성공 시 `status=generated`
9. 실패 시 retry
10. retry 이후 실패하면 `status=manual_required`

`manual_required`는 승인 대기가 아니다. 자동화 실패 예외 상태다.

## Goose Recipe 흐름

Goose는 아래 recipe를 실행한다.

```text
recipes/homepage-builder.recipe.yaml
```

중요한 점:

Goose recipe 안에서는 `scripts/run-homepage-builder.sh`를 다시 실행하지 않는다. 그 스크립트는 outer runner이며 retry, final status, build validation을 담당한다.

Goose agent가 실제로 수행하는 핵심 명령은 다음이다.

```bash
HOMEPAGE_GENERATOR_PROVIDER=goose_agent \
HOMEPAGE_GENERATOR_MODEL="${GOOSE_MODEL:-configured-goose-model}" \
node scripts/generate-static-site.mjs {request_path}
```

즉 Goose가 완전히 자유롭게 파일을 만드는 것이 아니라, 정해진 generator를 실행하고 산출물을 검증한다.

이 구조를 선택한 이유:

- 입력에 없는 회사 정보를 만들지 않기 위해
- 외부 템플릿을 복제하지 않기 위해
- 생성 결과를 항상 같은 schema와 harness로 검증하기 위해
- 고객용 AI 채팅 빌더가 아니라 내부 제작 자동화 시스템으로 유지하기 위해

## Template Generator 흐름

실제 홈페이지 파일 생성은 아래 스크립트가 담당한다.

```text
scripts/generate-static-site.mjs
```

이 스크립트는 request JSON을 읽고 homepage type에 따라 하나의 MVP template을 선택한다.

```text
company_intro -> templates/company_intro_basic
product       -> templates/product_basic
```

`company_intro`는 같은 `template_id`를 유지하면서 `metadata.template_variant=result_style_v1`을 기록하고, `result_template.png`의 정보 구조를 반영한 결과형 레이아웃으로 생성한다.

생성되는 내용은 request에 있는 사실만 사용한다.

허용:

- 회사명
- 업종
- 업태 (`business_type`)
- 주요 사업 설명
- 한 줄 소개
- 회사 소개
- 핵심 강점
- 입력된 상품
- 입력된 연혁
- 입력된 포트폴리오

금지:

- 수상
- 인증
- 고객사
- 매출
- 납품 실적
- 업계 순위
- 특허
- 입력에 없는 연혁
- 입력에 없는 상품명

## Validation 흐름

생성 후 runner는 아래 검증을 실행한다.

```bash
bash scripts/validate-generated-site.sh generated-sites/{company_id} {request_path}
```

검증 기준:

- 필수 파일 존재 여부
- `generation-result.json` schema
- request와 생성 content의 일치 여부
- fake claim 금지어
- 입력에 없는 상품/연혁/포트폴리오 생성 금지
- status 값 제한

허용 final status:

```text
generated
published
manual_required
validation_failed
build_failed
agent_failed
```

금지 status:

```text
approved
ready_for_review
reviewing
review_rejected
```

## Build 흐름

validation이 통과하면 runner는 Next.js production build를 실행한다.

```bash
npm run build
```

실제 build wrapper:

```text
scripts/build-next-with-lock.mjs
```

이 wrapper는 다음을 처리한다.

- frontend app을 build한다.
- build output은 `frontend/.next-build`를 사용한다.
- 동시 build 충돌을 막기 위해 `.next-build.lock`을 사용한다.
- API/dev server 환경에서 build가 깨지지 않도록 `NODE_ENV=production`을 명시한다.
- `NEXT_BUILD_TIMEOUT_MS`로 build timeout을 제어한다.

## Preview 흐름

생성 성공 후 화면은 `homepageUrl`을 받는다.

```text
/homepage/{company_id}
```

구현 파일:

```text
frontend/app/homepage/[companyId]/page.tsx
frontend/lib/generated-sites.ts
```

preview route는 `generated-sites/{company_id}`의 산출물을 읽어서 화면으로 보여준다.

성공 조건:

- `status=generated` 또는 `status=published`
- `validation_result.passed=true`
- `build_result.passed=true`
- `previewAvailable=true`

실패 시에는 `생성된 홈페이지 보기` 버튼을 보여주지 않는다.

## 실패 처리

실패할 수 있는 대표 경우:

- Goose CLI 없음
- Goose provider 설정 없음
- Gemini/OpenAI/Claude quota 또는 rate limit
- Goose agent 실행 실패
- 필수 파일 미생성
- fake claim validation 실패
- Next.js build 실패

실패 시 runner는 retry 후 `manual_required`를 기록한다.

결과 파일:

```text
generated-sites/{company_id}/generation-result.json
generated-sites/{company_id}/agent-run-report.json
generated-sites/{company_id}/agent-run-report.md
```

화면은 실패 시 preview link를 숨기고 실패 요약을 보여준다.

## E2E Evidence Report

Goose/Gemini 실제 실행 증거는 생성 사이트 결과와 분리해서 저장한다.

```text
reports/e2e/latest.json
reports/e2e/latest.md
reports/e2e/{timestamp}-{request_id}.json
reports/e2e/{timestamp}-{request_id}.md
```

보고서에는 다음만 저장한다.

- request path
- request id
- company id
- Goose CLI version
- provider/model 표시값
- start/end time
- duration
- exit code
- generated site path
- final status
- validation/build pass 여부
- retry count
- quota/rate-limit warning 여부
- preview URL

API key, OAuth token, 전체 Goose 원문 로그는 저장하지 않는다.

## 전체 흐름 요약

```text
사용자 입력 화면
-> POST /api/test-generate
-> request JSON 생성
-> GOOSE_MODE=required scripts/run-homepage-builder.sh
-> Goose recipe 실행
-> constrained template generator 실행
-> generated-sites/{company_id}/ 파일 생성
-> generated-site validation
-> Next.js build
-> generation-result.json status=generated
-> /homepage/{company_id} preview URL 반환
```

## 검증 명령

Goose 설정 확인:

```bash
npm run goose:preflight
```

화면 서버 실행:

```bash
npm run dev
```

브라우저에서:

```text
http://localhost:{port}/test-builder
```

전체 harness test:

```bash
npm run test:harness
```

production build:

```bash
npm run build
```
