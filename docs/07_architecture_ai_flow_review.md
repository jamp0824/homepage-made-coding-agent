# Goose Homepage Builder Architecture Review

## 한 줄 요약

이 프로젝트는 고객용 AI 채팅 빌더가 아니라, 고객이 홈페이지 만들기 입력을 끝낸 뒤 내부 담당자가 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent와 validation harness로 자동화하는 시스템이다.

핵심 설계는 다음과 같다.

```text
request JSON
-> Goose runner 또는 local generator
-> constrained template generator
-> generated-sites/{company_id}/
-> generated-site validation
-> Next.js build
-> generation-result.json
-> generated 또는 manual_required
```

AI는 "매번 새로운 홈페이지를 마음대로 디자인하는 역할"이 아니다. AI는 정해진 request schema, template, generator, validation 규칙 안에서 생성 작업을 수행하거나 보조한다. 자동 검증을 통과하면 사람 승인 없이 `generated` 상태가 되고, 실패하면 retry 후 `manual_required`로 빠진다.

## 왜 이런 구조인가

홈페이지 자동 생성에서 가장 위험한 지점은 AI가 그럴듯한 정보를 만들어내는 것이다. 회사 홈페이지는 신뢰 자산이기 때문에 입력에 없는 수상, 인증, 고객사, 매출, 납품 실적, 연혁, 상품명을 만들면 바로 운영 리스크가 된다.

그래서 이 repo는 AI를 자유 생성기처럼 열어두지 않고, 아래 세 가지로 감싼다.

- 계약: `schemas/`, request 필수 필드, 결과 상태 enum
- 템플릿: `templates/company_intro_basic`, `templates/product_basic`
- 검증: `harness/validators/validate-generated-site.mjs`

이 구조의 제품적 의미는 단순하다. "AI가 예쁜 랜딩페이지를 즉흥적으로 만들어준다"가 아니라, "입력 완료 후 내부 제작자가 하던 반복 제작 업무를 자동화하고, 검증 가능한 결과만 완료 처리한다"이다.

## 전체 실행 흐름

### 1. 고객 입력은 request JSON이 된다

입력 완료 후 시스템이 다루는 기본 단위는 `requests/*.json`이다. 필수 필드는 `request_id`, `company_id`, `homepage_type`, `company_name`, `industry`, `business_type`, `main_business_description`이다.

예시는 `requests/sample-company-intro.json`, `requests/sample-product-empty.json`, `requests/sample-product-with-items.json`에 있다.

### 2. Runner가 request를 검증하고 generation mode를 고른다

메인 실행 진입점은 `scripts/run-homepage-builder.sh`이다.

이 스크립트는 먼저 `scripts/validate-request.mjs`로 request를 검증한다. 이후 `GOOSE_MODE`에 따라 실행 방식을 고른다.

- `required`: Goose가 반드시 있어야 한다. 없으면 실패한다.
- `auto`: Goose가 있으면 Goose recipe를 실행하고, 없으면 local generator로 fallback한다.
- `local`: deterministic local generator만 사용한다.

성공 경로는 `validate-generated-site.sh`와 `npm run build`까지 통과해야 한다. 실패하면 retry하고, retry를 다 쓰면 `manual_required`를 기록한다.

관련 코드:

- `scripts/run-homepage-builder.sh`
- `scripts/run-goose-homepage-recipe.sh`
- `scripts/update-generation-result.mjs`

### 3. Goose recipe는 AI를 constrained executor로 사용한다

Goose recipe는 `recipes/homepage-builder.recipe.yaml`에 있다.

여기서 중요한 점은 Goose에게 "알아서 홈페이지를 새로 만들어"라고 하지 않는다는 것이다. recipe는 PRD, AGENTS, validation rules를 읽게 한 뒤, 정해진 명령으로 constrained generator를 실행하게 한다.

```bash
HOMEPAGE_GENERATOR_PROVIDER=goose_agent \
HOMEPAGE_GENERATOR_MODEL="${GOOSE_MODEL:-configured-goose-model}" \
node scripts/generate-static-site.mjs {{ request_path }}
```

즉 현재 구현에서 Goose의 역할은 자유 창작자가 아니라, harness 계약을 따르는 coding agent runner에 가깝다. 실제 산출물 생성은 같은 generator를 통과하므로 local mode와 Goose mode가 동일한 결과 계약을 공유한다.

이건 의도적으로 보수적인 설계다. 운영 자동화를 먼저 안정화하고, AI의 판단 범위는 나중에 schema로 제한된 planning/copy 단계로 확장하기 좋다.

### 4. Generator가 템플릿을 선택하고 파일을 만든다

실제 파일 생성은 `scripts/generate-static-site.mjs`가 담당한다.

템플릿 선택은 고정 규칙이다.

```text
company_intro -> company_intro_basic
product       -> product_basic
```

generator는 request에 있는 정보만 사용해 아래 파일을 `generated-sites/{company_id}/`에 만든다.

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

상품형인데 `products`가 비어 있으면 상품 카드를 만들지 않고 `product_registration_cta`를 만든다. 회사소개형에서 `history`, `portfolio`, `products`, `contact`, `tags`가 있으면 렌더링하고, 없으면 섹션 자체를 숨긴다.

### 5. Validation harness가 AI의 결과를 막아선다

`harness/validators/validate-generated-site.mjs`는 생성 결과의 최종 방어선이다.

검증하는 것:

- 필수 파일 존재
- `content.json`, `assets.json`, `metadata.json`, `generation-result.json` 기본 구조
- `homepage_type`에 맞는 `template_id`
- 필수 섹션 존재
- 상품, 연혁, 포트폴리오가 request와 정확히 대응되는지
- request에 없는 연락처, 태그, 커버 이미지, 상품이 생성되지 않았는지
- 고위험 문구 사용 여부
- `generation-result.json` status enum
- `agent-run-report.json`과 최종 status 일치
- `page.tsx`, `index.html`에 section marker가 실제로 있는지

이 검증 덕분에 "AI가 넣어도 될 법한 말"이 아니라 "request로 증명 가능한 말"만 통과한다.

### 6. Build와 report가 완료 상태를 만든다

validation이 통과하면 runner는 `npm run build`를 실행한다. 실제 build wrapper는 `scripts/build-next-with-lock.mjs`이고, Next.js production build 충돌을 줄이기 위해 `.next-build.lock`을 사용한다.

마지막으로 `scripts/update-generation-result.mjs`가 `generation-result.json`과 `agent-run-report.*`를 갱신한다.

성공 시:

```text
status=generated
validation_result.passed=true
build_result.passed=true
```

실패 시:

```text
status=manual_required
error_type=agent_failed | validation_failed | build_failed
```

`manual_required`는 승인 대기가 아니다. 자동 생성이 실패했으므로 기존 수동 제작 프로세스로 넘기는 예외 상태다.

## AI가 정확히 해주는 일

현재 코드 기준으로 AI가 맡는 역할은 세 층으로 나뉜다.

첫째, Goose는 실행 agent다. `GOOSE_MODE=required`에서는 Goose가 recipe를 읽고 request 기반 생성 명령을 수행한다.

둘째, AI는 harness가 허용한 범위 안에서만 작업한다. recipe와 prompt는 템플릿 선택, 파일 위치, fake claim 금지, build/validation 명령을 강제한다.

셋째, 현재 MVP에서는 AI의 자유 판단이 매우 작다. generator가 deterministic하게 동작하기 때문에 Goose가 있어도 결과는 local generator 계약을 크게 벗어나지 않는다. 이것은 단점이라기보다 안정적인 MVP를 위한 선택이다.

다만 기술 블로그에서 솔직하게 말해야 할 지점은 이것이다.

> 지금 버전은 "AI가 완전히 새 홈페이지를 만든다"보다 "AI agent를 운영 자동화 runner 안에 넣고, 결과는 deterministic harness가 통제한다"에 가깝다.

고도화하려면 AI의 역할을 generator 전체 자유화가 아니라, schema로 검증 가능한 작은 결정으로 넓혀야 한다.

예를 들면:

- `site-plan.json`: 어떤 섹션을 쓸지, 왜 숨겼는지 생성
- `copy-variants.json`: request 근거가 있는 문장 후보만 생성
- `asset-plan.json`: 업종 기반 asset theme 선택 이유 기록
- `validation-repair-plan.json`: 실패한 항목을 어떻게 고칠지 제안

이렇게 하면 AI가 "판단"은 하지만, 최종 파일은 여전히 template/config/component 규칙 안에서만 생성된다.

## 코드리뷰 결과

### 잘 설계된 부분

1. 제품 범위가 흔들리지 않는다

PRD와 AGENTS에서 고객용 채팅 빌더, 승인 UI, 자유 디자인 생성을 명확히 제외한다. 이 덕분에 구현도 `request -> generation -> validation -> result` 축으로 유지된다.

2. Goose와 local generator가 같은 harness 계약을 공유한다

Goose가 없어도 local mode로 deterministic하게 테스트할 수 있고, Goose mode도 동일한 validator/build/report를 통과해야 한다. AI provider 상태와 무관하게 harness 개발을 계속할 수 있는 구조다.

3. fake claim 방어가 꽤 구체적이다

상품, 연혁, 포트폴리오, 연락처, 태그, 커버 이미지가 request와 exact-match되는지 확인한다. 단순 금칙어 검사보다 한 단계 더 강하다.

4. 결과 보고가 운영 친화적이다

`generation-result.json`, `validation-report.json`, `agent-run-report.json`, `agent-run-report.md`가 분리되어 있어 시스템 처리와 사람 확인을 둘 다 지원한다.

5. 실패 상태가 승인 플로우로 오해되지 않는다

`approved`, `ready_for_review`, `reviewing` 같은 상태를 validation에서 거부하고, 실패는 `manual_required`로만 예외 처리한다.

### 보완하면 좋은 부분

1. preview route가 최종 공개 gate를 강제하지 않는다

목록 화면은 성공한 결과에만 preview link를 보여주는 쪽으로 동작하지만, `/homepage/{company_id}` route 자체는 `generated-sites/{company_id}`를 읽을 수 있으면 렌더링한다. 따라서 `manual_required`, `validation_failed`, `build_failed` 결과도 파일이 존재하면 직접 URL로 접근 가능하다.

제품 설명이 "validation/build 통과 시 generated/published 처리"라면, preview route도 `status=generated|published`, `validation_result.passed=true`, `build_result.passed=true`를 확인한 뒤 렌더링해야 한다. 아니면 preview는 운영 공개면이 아니라 내부 artifact viewer라고 명확히 분리해야 한다.

2. JSON Schema와 실제 validator가 이중 관리된다

`schemas/homepage-request.schema.json`이 있지만 `scripts/validate-request.mjs`는 별도 수동 로직으로 검증한다. 필드가 늘어날수록 drift가 생길 수 있다. 다음 단계에서는 schema를 source of truth로 삼고 validator가 schema를 실행하도록 바꾸는 편이 좋다.

이미 drift도 일부 보인다. 예를 들어 role task 문서는 lifecycle status까지 넓게 언급하지만 `generation-result.schema.json`은 terminal status 중심이고, product template config는 `product_area_or_registration_cta`라고 표현하지만 validator는 실제 section id인 `product_area` 또는 `product_registration_cta`를 검사한다.

3. `generation-result.schema.json` 검증이 부분적이다

generated-site validator는 required field와 status enum은 보지만 JSON Schema 전체를 실행하지는 않는다. report 품질을 더 믿으려면 result schema validation을 harness에 포함하는 편이 좋다.

4. AI의 실질 기여가 아직 얇다

현재 Goose recipe는 constrained generator 실행을 중심으로 한다. 안정성은 좋지만 "AI가 어떤 판단을 했는가"가 산출물에 남지 않는다. `site-plan.json` 같은 plan artifact를 추가하면 AI 사용의 설명 가능성과 고도화 여지가 커진다.

5. validator가 생성 텍스트 전체를 완전히 이해하지는 않는다

금칙어와 request-bound exact match는 좋지만, paraphrase된 허위 주장을 모두 잡지는 못한다. 예를 들어 "많은 기업이 선택한" 같은 표현은 현재 forbidden phrase 목록에 없으면 통과할 수 있다. 금칙어 확장보다 좋은 방향은 claim taxonomy와 evidence mapping이다.

6. build가 전체 Next.js 앱 기준이다

`npm run build`는 실제 preview app까지 검증하므로 신뢰도는 높다. 대신 batch 처리에서는 비용이 커질 수 있다. 미래에는 per-site static validation과 full app build를 분리하는 전략도 고려할 만하다.

7. 테스트 UI 문구는 데모용임을 더 분명히 해야 한다

`/test-builder`는 실제 고객용 핵심 화면이 아니라 harness demo다. README와 화면 일부는 이를 설명하지만, 외부 공유 시에는 "고객 입력 UI를 새로 만드는 프로젝트가 아니다"를 계속 강조해야 한다.

## 공유용 설명 문장

이 프로젝트를 사람에게 설명할 때는 이렇게 말하는 편이 정확하다.

> 고객이 홈페이지 만들기 정보를 입력하면, 시스템은 그 입력을 request JSON으로 만들고 Goose 기반 Coding Agent를 실행한다. Agent는 정해진 템플릿과 generator 규칙 안에서 홈페이지 파일을 생성한다. 이후 harness가 입력에 없는 사실이 만들어졌는지, 필수 섹션과 파일이 있는지, build가 되는지를 자동 검증한다. 통과하면 사람 승인 없이 generated 상태가 되고, 실패하면 retry 후 manual_required로 기록된다.

짧게 말하면:

> AI가 홈페이지를 "마음대로 창작"하는 시스템이 아니라, AI agent와 validation harness로 내부 홈페이지 제작 업무를 자동화하는 시스템이다.

## 기술 블로그용 제목 후보

- AI에게 홈페이지를 맡기되, 마음대로 만들게 하지 않기
- Goose와 Harness로 만든 내부 홈페이지 제작 자동화
- AI 홈페이지 빌더가 아니라 AI 제작 파이프라인을 만든 이유
- hallucination을 막는 홈페이지 생성 시스템 설계

## 실행과 검증

기본 sample 생성:

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

생성 결과 검증:

```bash
bash scripts/validate-generated-site.sh generated-sites/COMPANY_001 requests/sample-company-intro.json
```

전체 build:

```bash
npm run build
```

Harness 테스트:

```bash
npm run test:harness
```

Goose 필수 모드:

```bash
GOOSE_MODE=required bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

Goose 없이 deterministic local mode:

```bash
GOOSE_MODE=local bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
```

## 다음 고도화 방향

1. schema 기반 validator 통합
2. preview/public route에서 generated/published gate 강제
3. `site-plan.json` 추가로 AI 판단 기록
4. copy generation을 request evidence와 연결
5. fake claim taxonomy와 evidence mapping 도입
6. template variant 확대
7. batch runner의 build 비용 최적화
8. 실패 repair artifact 추가
9. Goose provider별 품질/실패 리포트 축적

방향성은 AI 자유도를 키우는 것이 아니라, AI가 판단할 수 있는 영역을 작게 열고 그 판단을 schema와 harness로 검증하는 것이다.
