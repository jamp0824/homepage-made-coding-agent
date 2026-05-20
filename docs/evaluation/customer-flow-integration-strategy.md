# Customer Flow Integration Strategy

## Summary

`docs/evaluation/client-request.md`는 고객이 보는 홈페이지 만들기 화면 요구사항을 포함한다.
하지만 이 repo의 원래 목적은 고객 입력 UI 전체를 새로 만드는 것이 아니라, 고객 입력 완료 후 기존 수동 제작 업무를 Goose 기반 자동화로 대체하는 것이다.

따라서 현재 gap은 두 가지로 분리해서 봐야 한다.

1. **고객 입력 플로우 gap**
   - 실제 서비스에 이미 고객 입력 플로우가 있다면 이 repo가 전부 재구현할 대상이 아니다.
   - 이 repo는 해당 플로우가 완료된 뒤 생성되는 request JSON을 받아 자동 제작을 수행하면 된다.

2. **자동화 처리 gap**
   - request JSON 수신
   - Goose 실행
   - constrained template 생성
   - validation/build
   - generated 또는 manual_required 상태 기록
   - 결과 조회 API/report 제공

즉, 이 repo의 핵심 책임은 다음 경계 이후다.

```text
기존 고객 입력 플로우 완료
-> homepage_generation_request JSON 생성
-> Goose automation pipeline
-> generated-sites/{company_id}
-> validation/build
-> generation-result.json
-> 고객 서비스가 결과 화면/완료 화면에 반영
```

## Recommended Responsibility Split

### Existing Customer Service Owns

실제 고객이 보는 제품 UX는 기존 고객 서비스 또는 프론트 프로젝트가 소유하는 것이 맞다.

포함 범위:

- 홈페이지 만들기 진입
- 정회원/기업인증 분기
- STEP progress UI
- 홈페이지 형식 선택
- 기업 정보 입력
- 연혁/포트폴리오 입력
- AI 초안 확인 화면
- 내용 수정 화면
- 완료 화면
- 주소 복사, 공유하기, 홈페이지 관리 이동
- 브라우저 이탈 방지
- 고객용 toast/modal

이유:

- 고객 입력 UI는 이미 서비스 맥락, 인증, 라우팅, 디자인 시스템, 회원 상태와 강하게 연결되어 있다.
- 이 repo가 별도 고객 화면을 전부 만들면 실제 서비스와 중복 구현이 된다.
- PRD의 비목표에도 “고객 입력 화면 자체를 새로 발명하지 않는다”가 포함되어 있다.

### Goose Automation Repo Owns

이 repo는 고객 입력 완료 후 자동 제작 업무를 담당한다.

포함 범위:

- request schema 정의
- request JSON validation
- Goose recipe/prompt
- template/config/component rule
- static/generated homepage output
- fake claim validation
- build validation
- retry/manual_required 처리
- generation-result/report 작성
- generated homepage preview
- 운영/개발 확인용 harness UI
- E2E 실행 증거 report

이유:

- 기존 수동 제작자가 하던 “홈페이지 파일 제작 + 검증 + 완료 처리”가 자동화 대상이다.
- 고객은 Goose/Codex/build/validation을 직접 볼 필요가 없다.
- 자동화 실패만 `manual_required`로 남기고, 사람 승인 대기 플로우를 만들지 않는다.

## Flow Option A: Existing Customer Flow Already Exists

이 경우 가장 적절한 구조다.

```text
1. 고객이 기존 홈페이지 만들기 STEP 완료
2. 기존 서비스가 request JSON 생성
3. 기존 서비스가 automation API 또는 job queue에 request 전달
4. Goose automation repo가 request validation
5. Goose runner 실행
6. generated-sites/{company_id} 생성
7. validation/build 실행
8. 성공 시 status=generated 또는 published
9. 실패 시 retry 후 manual_required
10. 기존 서비스가 status/result를 조회해 완료 화면 표시
```

### Required Contract

기존 고객 플로우가 이 repo로 넘겨야 하는 최소 contract:

```json
{
  "request_id": "REQ_...",
  "company_id": "COMPANY_...",
  "homepage_type": "company_intro",
  "company_name": "...",
  "industry": "...",
  "business_type": "...",
  "main_business_description": "...",
  "one_line_intro": "...",
  "company_intro": "...",
  "core_strengths": ["..."],
  "tags": ["..."],
  "contact": {
    "address": "...",
    "phone": "...",
    "email": "...",
    "website_url": "..."
  },
  "cover_image_url": "...",
  "history": [
    { "year": "2026", "text": "..." }
  ],
  "portfolio": [
    { "title": "...", "description": "..." }
  ],
  "products": []
}
```

중요:

- 고객이 입력하지 않은 인증, 수상, 매출, 고객사, 성과 수치, 상품은 넘기지 않는다.
- 회사소개형에서 상품 입력이 없다면 `products`는 빈 배열이어야 한다.
- 표시/숨김 정책이 있다면 `section_visibility` 또는 `section_manifest_input` 같은 명시 필드로 넘겨야 한다.

### Automation API Shape

MVP에서는 파일 기반 job runner를 유지하되, 실제 서비스 연동을 위해 다음 API 형태를 목표로 둔다.

```text
POST /api/homepage-generation-requests
GET  /api/homepage-generation-requests/{request_id}
GET  /api/generated-sites/{company_id}
```

`POST` 응답 예:

```json
{
  "request_id": "REQ_...",
  "company_id": "COMPANY_...",
  "status": "queued"
}
```

상태 조회 응답 예:

```json
{
  "request_id": "REQ_...",
  "company_id": "COMPANY_...",
  "status": "generated",
  "homepage_url": "/homepage/COMPANY_...",
  "validation_passed": true,
  "build_passed": true,
  "retry_count": 0
}
```

고객 서비스는 이 결과를 받아 자체 완료 화면에 표시한다.

## Flow Option B: This Repo Temporarily Simulates Customer Flow

실제 고객 플로우와 아직 연결할 수 없다면 `/test-builder`는 simulation 역할만 한다.

이때 원칙:

- `/test-builder`는 실제 서비스 UI가 아니라 integration harness다.
- client-request 전체 UI를 pixel-perfect로 복제하지 않는다.
- 실제 고객 플로우가 어떤 request JSON을 넘겨야 하는지 확인하는 용도로 유지한다.
- 완료 화면도 고객용 production 화면이 아니라 “생성 성공/실패를 확인하는 test result”로 둔다.

다만 사용자 테스트를 쉽게 하기 위해 다음 정도는 맞출 수 있다.

- STEP 이름을 client-request와 유사하게 정리
- 회사소개형 기본 상품값 제거
- 연혁/포트폴리오 입력을 더 명확히 노출
- 결과 URL 복사 버튼 추가
- 내부 debug 정보는 접힘 영역으로 이동

## AI Draft/Edit/Publish Handling

`client-request.md`의 AI 초안/내용 수정/완료 화면은 두 방식 중 하나로 처리해야 한다.

### Recommended: Customer Service Owns Draft/Edit UX

가장 권장하는 방식이다.

```text
고객 입력
-> 고객 서비스가 AI 초안 생성/수정 UX 제공
-> 고객이 최종 내용 확정
-> 확정된 request JSON을 automation repo로 전달
-> Goose는 최종 홈페이지 파일 생성/검증만 수행
```

장점:

- 고객 화면과 서비스 디자인 시스템이 한 곳에 남는다.
- 수정/토글/복사/공유 같은 UX를 기존 앱에서 자연스럽게 처리할 수 있다.
- 이 repo는 자동 제작 안정성에 집중할 수 있다.

주의:

- 고객 서비스가 최종 확정한 내용과 automation request schema가 정확히 맞아야 한다.
- 수정 단계에서 숨긴 섹션은 request에 포함하지 않거나 visibility flag로 넘겨야 한다.

### Alternative: Automation Repo Provides Draft API Only

고객 서비스가 초안 생성 로직도 외부화하고 싶다면 이 repo가 draft API를 제공할 수 있다.

```text
POST /api/homepage-drafts
-> request-bound draft content 반환
-> 고객 서비스에서 편집
-> POST /api/homepage-generation-requests
```

이 경우에도 고객 편집 UI는 기존 서비스가 소유한다.

draft API 책임:

- 입력 기반 한 줄 소개 후보
- 기업 소개 후보
- 핵심 강점 후보
- section suggestion

draft API가 하지 말아야 할 것:

- 입력에 없는 회사 사실 생성
- 고객사, 인증, 수상, 매출, 성과 수치 생성
- 완성 홈페이지 파일 생성

### Not Recommended: This Repo Owns Full Client Flow

이 repo가 `client-request.md`의 STEP 0~6 전체를 production 수준으로 구현하는 것은 권장하지 않는다.

이유:

- 원래 프로젝트 목표와 다르다.
- 인증, 회원, 라우팅, 디자인 시스템, 완료 후 관리 화면까지 모두 중복된다.
- 자동 제작 harness와 고객용 앱 책임이 섞인다.

예외:

- 실제 고객 서비스가 없고 MVP demo만 필요할 때
- 투자/내부 시연용으로 단일 repo demo가 필요할 때
- 이 경우에도 production 소유권은 나중에 고객 서비스로 이동해야 한다.

## How To Handle Completion Screen

완료 화면은 고객 서비스가 status API를 보고 렌더링하는 것이 맞다.

### Generated Case

automation result:

```json
{
  "status": "generated",
  "homepage_url": "/homepage/COMPANY_001",
  "validation_passed": true,
  "build_passed": true
}
```

customer UI:

- “홈페이지가 생성되었습니다!”
- 홈페이지 주소
- 복사
- 홈페이지 보기
- 공유하기
- 홈페이지 관리
- 회사소개형이면 연혁/포트폴리오 관리 유도
- 상품중심형이면 상품 등록 유도

### Manual Required Case

automation result:

```json
{
  "status": "manual_required",
  "failure_category": "provider_quota_or_rate_limit",
  "next_action": "잠시 후 다시 시도하거나 관리자에게 문의해 주세요."
}
```

customer UI:

- “자동 생성이 지연되고 있습니다.”
- “입력하신 내용은 저장되었습니다.”
- “관리자가 확인 후 처리합니다.” 또는 서비스 정책에 맞는 안내

주의:

- `manual_required`는 승인 대기가 아니다.
- 자동화 실패 예외 상태다.
- 고객에게 Goose/provider/build 같은 내부 표현을 그대로 노출하지 않는다.

## Required Changes In This Repo

실제 고객 입력 플로우가 외부에 있다고 가정하면, 이 repo에서 우선 구현할 것은 다음이다.

### P0. Request Intake Contract

- 실제 고객 플로우가 넘길 request JSON contract 확정
- `schemas/homepage-request.schema.json`과 client-request 입력 항목 매핑 문서화
- 회사소개형에서 products 기본값 제거
- section visibility input이 필요한지 결정

### P1. Automation Job API/Runner

- 파일 기반 `jobs/pending` 구조를 유지하되 API로 request를 넣을 수 있게 한다.
- status 조회 API를 안정화한다.
- retry/manual_required 결과를 고객 서비스가 이해할 수 있는 형태로 반환한다.

### P2. Customer-Safe Result API

운영/debug 정보를 고객 화면에 그대로 주지 않도록 응답을 분리한다.

고객용:

```json
{
  "status": "generated",
  "homepage_url": "...",
  "preview_available": true
}
```

운영용:

```json
{
  "validation_report": "...",
  "agent_run_report": "...",
  "build_errors": []
}
```

### P3. Test Builder Repositioning

`/test-builder`는 production customer flow가 아니라 integration test UI로 명명한다.

가능한 변경:

- 화면 문구에서 “실제 고객 화면”처럼 보이는 표현 줄이기
- “입력 플로우 참고용, 실제 생성은 마지막 단계에서 API 호출” 명확화
- 고객 서비스가 보낼 request JSON preview 표시
- 내부 debug 정보 접기

### P4. Generated Homepage Polish

- result-style homepage를 고객용 결과물처럼 계속 개선한다.
- 단, 고객 입력 플로우 전체 구현보다 우선순위는 낮다.

## Proposed Integration Sequence

1. 실제 고객 플로우에서 생성 가능한 request JSON 샘플을 받는다.
2. 해당 JSON을 `requests/realistic-client-sample.json`로 저장한다.
3. schema가 통과하지 않으면 schema 또는 mapping을 조정한다.
4. `bash scripts/run-homepage-builder.sh requests/realistic-client-sample.json`로 생성한다.
5. validation/build를 통과시키고 result-style 홈페이지를 확인한다.
6. `POST /api/homepage-generation-requests` 형태의 intake API를 만든다.
7. 고객 서비스는 완료 버튼에서 이 API를 호출한다.
8. 고객 서비스는 status polling 또는 callback으로 결과를 받는다.
9. generated이면 완료 화면에서 홈페이지 URL을 보여준다.
10. manual_required이면 자동화 실패 안내를 보여준다.

## Decision

현재 방향은 다음이 가장 적절하다.

```text
고객 입력 플로우는 기존 서비스가 소유한다.
이 repo는 고객 입력 완료 후 자동 제작 파이프라인을 소유한다.
수정/배포/완료 화면은 고객 서비스가 소유하되,
이 repo는 그 화면이 필요로 하는 status/result API를 제공한다.
```

이렇게 가면 PRD의 핵심 목표와 충돌하지 않는다.

- 고객 입력 UI 전체 재구현으로 가지 않는다.
- 내부 승인 화면을 만들지 않는다.
- 사람 검수 플로우를 만들지 않는다.
- 입력에 없는 회사 정보를 만들지 않는다.
- Goose는 정해진 template/config/component/design rule 안에서만 생성한다.

## Next Implementation Target

이 전략 기준 다음 구현은 고객 플로우 전체 재구현이 아니다.

다음 구현 대상:

1. `requests/realistic-client-sample.json` 추가
2. request schema와 client-request 필드 매핑 보강
3. `POST /api/homepage-generation-requests` intake API 추가
4. `GET /api/homepage-generation-requests/{request_id}` status API 추가
5. `/test-builder`는 integration harness로 문구 정리
6. 회사소개형 기본 상품값 제거

