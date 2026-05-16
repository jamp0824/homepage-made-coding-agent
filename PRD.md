# PRD: Goose 기반 Coding Agent 홈페이지 자동 제작 시스템

## 0. 문서 목적

이 문서는 고객이 홈페이지 만들기 프로세스에서 입력을 완료한 뒤, 기존에 회사 내부 사람이 수동으로 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent가 자동 수행하도록 만들기 위한 제품 요구사항 문서다.

이 문서는 Codex에게 시스템 개발을 지시할 때 최상위 컨텍스트로 사용한다. Codex는 이 문서와 `docs/pics/pic1~pic8` 이미지를 함께 참고하여 요구사항, 기존 플로우, UI/결과물 스타일, 자동화 대상, Harness 검증 방식을 이해해야 한다.

---

## 1. 핵심 정의

### 1.1 이 프로젝트의 본질

본 프로젝트는 고객용 AI 채팅 빌더나 단순 AI 문구 생성기가 아니다.

고객이 기존 홈페이지 만들기 STEP을 완료하면, 회사 내부 담당자가 신청 정보를 확인하고 홈페이지를 수동 제작하던 업무가 있었다. 본 프로젝트는 그 수동 제작 업무를 Goose 기반 Coding Agent가 자동 수행하도록 만드는 시스템이다.

```text
고객 입력 완료
→ 홈페이지 제작 요청 데이터 생성
→ Goose Homepage Builder Coding Agent 실행
→ 홈페이지 파일/콘텐츠/에셋 자동 생성
→ 자동 검증 및 빌드
→ 성공 시 홈페이지 생성 완료
→ 실패 시 재시도 또는 manual_required 전환
```

### 1.2 한 줄 정의

고객의 홈페이지 신청 데이터를 기반으로 Goose Coding Agent가 홈페이지 템플릿/컴포넌트/콘텐츠/이미지를 자동 조합하고, 자동 Harness 검증을 통과하면 홈페이지를 생성 완료 상태로 전환하는 내부 제작 자동화 시스템.

### 1.3 반드시 지켜야 할 전제

- 고객 입력 화면 자체를 새로 발명하지 않는다.
- 외부 서비스의 템플릿을 복제하지 않는다.
- 고객이 Goose/Codex를 직접 쓰지 않는다.
- 내부 담당자 승인 플로우를 만들지 않는다.
- Agent 생성 결과는 자동 검증을 통과하면 완료 처리한다.
- 자동화 실패 건만 `manual_required` 상태로 넘긴다.
- Agent는 완전 자유롭게 새 사이트를 창작하지 않고, 정해진 템플릿/컴포넌트/디자인 규칙 안에서 홈페이지를 만든다.

---

## 2. 배경

현재 고객은 홈페이지 만들기 프로세스에서 홈페이지 형식, 기업 정보, 주요 사업 내용 등을 입력한다. 기존에는 고객이 입력한 내용을 바탕으로 회사 내부 담당자가 기업 홈페이지를 수동으로 제작한다.

수동 제작자는 일반적으로 다음 작업을 수행한다.

1. 신청 데이터 확인
2. 상품중심형/회사소개중심형 구분
3. 업종/업태/사업 설명 확인
4. 적절한 홈페이지 구조 선택
5. 회사 소개 문구 정리
6. 핵심 강점 구성
7. 이미지/아이콘/배경 방향 선택
8. 상품형이면 상품 영역 또는 상품 등록 유도 영역 구성
9. 회사소개형이면 회사 소개/연혁/포트폴리오 방향 구성
10. 홈페이지 파일 또는 페이지 생성
11. 빌드/오류 확인
12. 생성 완료 처리

본 프로젝트는 위 업무를 Coding Agent가 자동 수행하도록 만든다.

---

## 3. 목표

### 3.1 제품 목표

- 기존 수동 제작 업무를 자동화한다.
- 고객 입력 완료 후 홈페이지 제작 속도를 높인다.
- 사람 승인 없이 자동 검증 기반으로 홈페이지 생성 완료 처리를 한다.
- Goose를 무료/오픈소스 Coding Agent 실행기로 사용한다.
- ChatGPT/Claude/Gemini API 또는 구독 연동을 통해 모델 품질을 확보한다.
- Codex를 통해 Goose 시스템, Harness, 템플릿, 검증 스크립트, 실행 파이프라인을 구현한다.

### 3.2 성공 기준

MVP 성공 기준은 다음과 같다.

```text
sample homepage request JSON 1개를 넣었을 때,
Goose Agent가 generated-sites/{company_id}/ 아래에 홈페이지 결과물을 생성하고,
validation/build를 통과하여 generation-result.json을 status=published 또는 generated로 만든다.
```

---

## 4. 비목표

MVP에서는 아래를 하지 않는다.

- 고객과 AI가 대화하면서 사이트를 만드는 채팅형 빌더
- 고객 실시간 편집 기능 신규 구현
- 운영자 승인/검수 UI
- 외부 서비스 템플릿 복제
- 매번 완전히 새로운 디자인을 자유 생성
- 이미지 생성 AI 연동
- 외부 홈페이지 크롤링
- 도메인 연결 자동화
- 운영 배포 인프라 전체 교체
- SEO 고도화 자동화
- A/B 테스트 자동화

---

## 5. 사용자 및 시스템 행위자

### 5.1 고객 사용자

고객은 기존처럼 홈페이지 만들기 STEP을 완료한다.

고객이 하는 일:

- 홈페이지 만들기 진입
- 홈페이지 유형 선택
- 기업 정보 입력
- 주요 사업 내용 입력
- 신청 완료

고객이 하지 않는 일:

- Goose 실행
- Codex 실행
- 템플릿 직접 수정
- 코드 수정
- 빌드 확인
- Agent 승인

### 5.2 Goose Homepage Builder Coding Agent

Goose Agent는 고객 신청 데이터를 읽고 홈페이지를 제작한다.

주요 역할:

- request JSON 분석
- homepage_type에 맞는 템플릿 선택
- 콘텐츠 정리
- 템플릿/컴포넌트 기반 파일 생성
- 이미지/에셋 매핑
- 빌드 및 검증 실행
- 결과 리포트 생성
- 성공 시 generated/published 상태 출력

### 5.3 Codex

Codex는 Goose 기반 자동 제작 시스템을 개발하는 도구로 사용한다.

Codex가 구현할 것:

- PRD 기반 repo scaffold
- Goose recipe
- Agent prompts
- schemas
- templates
- generated site 구조
- validation harness
- runner scripts
- job runner skeleton
- retry/manual_required 처리

### 5.4 Harness

Harness는 사람 승인 없이 자동화를 안정적으로 운영하기 위한 제약/검증/반복 실행 장치다.

Harness 역할:

- 입력 스키마 검증
- 출력 스키마 검증
- 템플릿 규칙 검증
- 금지된 허위 정보 생성 검증
- 빌드 검증
- 실패 시 repair loop 유도
- generation report 기록

---

## 6. 기존 고객 입력 프로세스 요약

제공된 이미지와 프로세스 설명을 기준으로 기존 고객 입력 흐름은 다음과 같다.

```text
STEP 0. 시작 화면
STEP 1. 홈페이지 형식 선택
STEP 2. 기업 정보 입력
STEP 3. AI 생성/내용 수정 또는 기업 정보 기반 내용 정리
STEP 4. 신청 완료
```

대상 사용자는 BOX 가입 및 기업인증을 완료한 정회원이다. 정회원이 아닌 경우 기업 인증 공통 플로우로 유도한다.

상품중심형과 회사소개중심형은 고객 입력 절차는 거의 동일하되, 완료 후 유도 메시지와 이후 보강 항목이 다르다.

- 상품중심형: 상품 등록 유도
- 회사소개중심형: 연혁/포트폴리오 보강 유도

중요한 점은 본 시스템이 STEP 화면 자체의 대체가 아니라, STEP 완료 후 발생하는 수동 홈페이지 제작 업무의 자동화라는 것이다.

---

## 7. 자동화 대상 업무

### 7.1 기존 수동 제작 업무

```text
신청 정보 확인
→ 홈페이지 유형 확인
→ 템플릿/구조 선택
→ 회사 소개 문구 정리
→ 핵심 강점 정리
→ 이미지 방향 선택
→ 상품/연혁/포트폴리오 유무에 따라 섹션 구성
→ 홈페이지 파일 제작
→ 오류 확인
→ 완료 처리
```

### 7.2 Agent 자동화 업무

```text
request JSON 로드
→ 스키마 검증
→ 홈페이지 유형별 제작 계획 수립
→ 템플릿 선택
→ content.json 생성
→ assets.json 생성
→ page/component 파일 생성
→ metadata.json 생성
→ build/validation 실행
→ generation-result.json 생성
→ 상태 업데이트
```

---

## 8. 전체 시스템 흐름

```text
[고객 STEP 입력 완료]
        ↓
[Homepage Request DB 또는 request JSON 생성]
        ↓
[Homepage Generation Job 생성]
        ↓
[Goose Agent Runner 실행]
        ↓
[Homepage Builder Coding Agent]
        ↓
[generated-sites/{company_id}/ 생성]
        ↓
[Harness validation + build]
        ↓
[성공: generated/published]
[실패: retry]
[재시도 실패: manual_required]
```

---

## 9. 상태 정의

### 9.1 정상 상태

```text
requested
→ queued
→ agent_running
→ site_generating
→ validating
→ generated
→ published
```

### 9.2 실패 상태

```text
agent_failed
validation_failed
build_failed
manual_required
```

### 9.3 제외 상태

MVP에서는 다음 상태를 만들지 않는다.

```text
ready_for_review
approved
reviewing
review_rejected
```

이 프로젝트에는 사람 승인 단계가 없기 때문이다.

---

## 10. 입력 데이터 요구사항

Agent 입력은 고객이 홈페이지 만들기 완료 시 남긴 request 데이터다.

### 10.1 필수 필드

```json
{
  "request_id": "REQ_001",
  "company_id": "COMPANY_001",
  "homepage_type": "company_intro",
  "company_name": "주식회사 샘플",
  "industry": "IT·소프트웨어",
  "business_type": "소프트웨어 개발 및 공급",
  "main_business_description": "AI 기반 재고관리 솔루션을 개발하고 중소기업에 공급합니다.",
  "created_at": "2026-05-16T10:00:00+09:00"
}
```

### 10.2 선택 필드

```json
{
  "one_line_intro": "중소기업을 위한 AI 재고관리 솔루션",
  "company_intro": "AI 기반 재고관리 솔루션을 통해 입출고와 발주 업무를 효율화합니다.",
  "core_strengths": [
    "AI 기반 재고 예측",
    "입출고 통합 관리",
    "중소기업 맞춤형 사용성"
  ],
  "products": [],
  "portfolio": [],
  "history": [],
  "preferred_style": "clean"
}
```

### 10.3 데이터 생성 정책

입력에 없는 사실은 생성하지 않는다.

금지:

- 입력에 없는 업력
- 입력에 없는 인증/수상
- 입력에 없는 고객사/납품처
- 입력에 없는 매출/성과 수치
- 입력에 없는 연혁
- 입력에 없는 상품
- 입력에 없는 포트폴리오

---

## 11. Agent 출력 데이터 요구사항

Agent는 `generation-result.json`을 생성해야 한다.

### 11.1 성공 예시

```json
{
  "request_id": "REQ_001",
  "company_id": "COMPANY_001",
  "status": "published",
  "homepage_type": "company_intro",
  "template_id": "company_intro_basic",
  "generated_path": "generated-sites/COMPANY_001",
  "homepage_url": "/homepage/COMPANY_001",
  "model_provider": "google_gemini",
  "model_name": "gemini",
  "generated_files": [
    "content.json",
    "assets.json",
    "page.tsx",
    "metadata.json"
  ],
  "build_result": {
    "passed": true,
    "command": "npm run build"
  },
  "validation_result": {
    "passed": true,
    "errors": [],
    "warnings": []
  },
  "retry_count": 0,
  "completed_at": "2026-05-16T10:05:00+09:00"
}
```

### 11.2 실패 예시

```json
{
  "request_id": "REQ_001",
  "company_id": "COMPANY_001",
  "status": "manual_required",
  "error_type": "validation_failed",
  "errors": [
    "company_intro section is missing",
    "build failed"
  ],
  "retry_count": 3
}
```

---

## 12. 템플릿/컴포넌트 전략

### 12.1 왜 제한된 템플릿 기반인가

승인 없이 자동 생성하려면 Agent가 매번 완전히 새로운 디자인과 코드를 자유 생성하면 안 된다. 안정적인 자동화를 위해 Agent는 정해진 템플릿/컴포넌트/디자인 토큰 안에서만 홈페이지를 만들어야 한다.

### 12.2 MVP 템플릿

MVP에서는 최소 2개 템플릿만 사용한다.

1. `company_intro_basic`
2. `product_basic`

### 12.3 company_intro_basic 필수 섹션

- hero
- company_intro
- core_strengths
- service_summary 또는 business_summary
- contact_cta

선택 섹션:

- history
- portfolio
- gallery

정보가 없으면 history/portfolio는 숨기거나 placeholder를 사용한다. 단, 허위 연혁/포트폴리오를 만들면 안 된다.

### 12.4 product_basic 필수 섹션

- hero
- company_intro
- core_strengths
- product_area 또는 product_registration_cta
- contact_cta

상품 정보가 없으면 상품 카드를 만들지 않는다. 대신 상품 등록 유도 영역을 구성한다.

---

## 13. 생성 파일 구조

Agent는 회사별 생성 결과를 아래에 만든다.

```text
generated-sites/{company_id}/
  content.json
  assets.json
  metadata.json
  page.tsx
  generation-result.json
  validation-report.json
```

### 13.1 content.json

홈페이지 콘텐츠 데이터.

필수:

- company_name
- hero_title 또는 one_line_intro
- company_intro
- core_strengths
- sections

### 13.2 assets.json

이미지/아이콘/배경 매핑 데이터.

필수:

- asset_theme
- hero_image
- section_images
- fallback_used 여부

### 13.3 metadata.json

생성 메타데이터.

필수:

- request_id
- company_id
- homepage_type
- template_id
- generated_at
- generator
- model_provider
- model_name

### 13.4 page.tsx

템플릿/컴포넌트 기반 홈페이지 페이지 파일.

정책:

- 임의 라이브러리 설치 금지
- 기존 디자인 시스템 사용
- content.json/assets.json 기반 렌더링 가능
- 빌드 가능해야 함

---

## 14. Agent 구성

MVP에서는 하나의 Goose recipe로 실행하되, 내부적으로 아래 역할을 순차 수행하게 한다.

### 14.1 Orchestrator 역할

- request path 확인
- 작업 디렉토리 생성
- 실행 순서 관리
- 실패 시 retry 판단
- 결과 파일 작성

### 14.2 Planning 역할

- homepage_type 판별
- template_id 선택
- 섹션 구성 결정
- 상품/연혁/포트폴리오 유무에 따른 분기

### 14.3 Content 역할

- 기업 소개 정리
- hero 문구 생성 또는 보정
- 핵심 강점 정리
- CTA 문구 생성

### 14.4 Asset 역할

- 업종 기반 asset_theme 결정
- 기본 이미지/아이콘 매핑
- 없으면 fallback 사용

### 14.5 Builder 역할

- generated-sites/{company_id}/ 생성
- content.json/assets.json/metadata.json/page.tsx 작성
- 템플릿 규칙 반영

### 14.6 Validation 역할

- schema validation
- no fake claims check
- required sections check
- template compliance check
- build check

### 14.7 Publish 역할

- validation/build 성공 시 status를 generated 또는 published로 설정
- 실패 시 retry 또는 manual_required 설정

---

## 15. Goose 사용 전략

Goose는 무료/오픈소스 Coding Agent 실행기로 사용한다.

MVP 실행 방식:

```text
Goose recipe 실행
→ request JSON 입력
→ generated-sites/{company_id}/ 생성
→ validation script 실행
→ build script 실행
→ generation-result.json 출력
```

모델 조합:

- 1차 PoC: Goose + Gemini API
- 품질 개선: Goose + ChatGPT 또는 Claude API/구독 연동
- fallback: Gemini 실패 시 ChatGPT/Claude로 재실행

---

## 16. Codex 사용 전략

Codex는 Goose Agent 시스템을 구현하는 개발 Agent다.

Codex에게 맡길 구현 범위:

- repo scaffold
- AGENTS.md 적용
- schemas 작성
- sample request 작성
- templates 작성
- prompts 작성
- Goose recipe 작성
- validation harness 작성
- run script 작성
- generation-result 작성 로직
- retry/manual_required 처리
- README 및 사용법 작성

Codex는 `docs/pics/pic1~pic8` 이미지를 참고해야 한다. 이미지는 고객 입력 흐름과 기대되는 홈페이지 제작 맥락을 이해하기 위한 참고 자료다. 단, 이미지를 그대로 복제하지 않고 우리 서비스의 자동 홈페이지 제작 요구사항으로 추상화해야 한다.

---

## 17. Harness 전략

승인 단계가 없기 때문에 Harness가 자동 검수자 역할을 한다.

### 17.1 Harness 구성요소

```text
Context Harness:
- PRD.md
- docs/reference-flow.md
- docs/pics/pic1~pic8
- docs/manual-production-flow.md

Schema Harness:
- homepage-request.schema.json
- generation-result.schema.json
- template-config.schema.json

Prompt Harness:
- prompts/goose_homepage_builder.md
- prompts/content_rules.md
- prompts/no_fake_claims.md

Execution Harness:
- recipes/homepage-builder.recipe.yaml
- scripts/run-homepage-builder.sh
- generated-sites/{company_id}/ isolation

Validation Harness:
- validate-request
- validate-generated-site
- check-no-fake-claims
- check-template-compliance
- check-build-result

Repair Harness:
- retry loop
- failure report
- manual_required fallback

Telemetry Harness:
- generation-result.json
- validation-report.json
- agent-run-report.md
```

### 17.2 검증 필수 항목

- request JSON schema 통과
- homepage_type에 맞는 template_id 선택
- generated-sites/{company_id}/ 생성
- content.json 생성
- assets.json 생성
- metadata.json 생성
- page.tsx 생성
- company_name 반영
- company_intro 반영
- core_strengths 반영
- 상품 정보 없을 때 상품 카드 미생성
- 입력에 없는 인증/수상/연혁/고객사/매출 미생성
- template config 필수 섹션 충족
- npm build 또는 대체 build command 통과
- generation-result.json 생성

---

## 18. 실패 처리

### 18.1 Retry 정책

```text
1차 실패: 같은 provider로 self-repair 1회
2차 실패: fallback provider로 재실행 가능
3차 실패: manual_required
```

### 18.2 manual_required 의미

manual_required는 승인 대기 상태가 아니다. 자동 생성이 실패했으므로 기존 수동 제작 프로세스로 넘겨야 하는 예외 상태다.

---

## 19. 보안/운영 제약

- Agent는 지정된 workspace 밖 파일을 수정하면 안 된다.
- 운영 배포 명령은 MVP에서 실행하지 않는다.
- API 키는 코드/로그에 기록하지 않는다.
- request JSON에 개인정보가 있으면 로그에 원문 전체를 남기지 않는다.
- 임의 패키지 설치 금지.
- 외부 네트워크 호출 금지. 단, 허용된 model provider 호출은 제외.
- 생성 결과는 회사별 디렉토리에 격리한다.
- 실패 시 실패 사유를 기록하되 민감정보를 마스킹한다.

---

## 20. MVP 개발 순서

1. repo scaffold 생성
2. PRD/AGENTS/Harness 문서 배치
3. docs/pics/pic1~pic8 반영
4. schemas 작성
5. sample requests 작성
6. templates/company_intro_basic 작성
7. templates/product_basic 작성
8. Goose prompt 작성
9. Goose recipe 작성
10. validator 작성
11. run script 작성
12. sample request로 Goose 실행
13. generated site 생성 확인
14. validation/build 확인
15. generation-result.json 확인
16. retry/manual_required 처리

---

## 21. Acceptance Criteria

### 21.1 기능 기준

- sample request JSON을 입력으로 Goose Agent 실행 가능
- homepage_type에 따라 company/product 템플릿 분기 가능
- generated-sites/{company_id}/ 생성 가능
- content.json/assets.json/metadata.json/page.tsx 생성 가능
- generation-result.json 생성 가능
- validation 통과 시 status generated/published 출력
- validation 실패 시 retry/manual_required 출력

### 21.2 품질 기준

- 입력에 없는 사실을 생성하지 않음
- 상품 정보가 없으면 상품 카드 생성하지 않음
- 회사명/기업소개/핵심강점이 누락되지 않음
- 템플릿 규칙을 벗어나지 않음
- 빌드 가능
- 재실행 가능

### 21.3 Harness 기준

- schema validation 존재
- no fake claims check 존재
- template compliance check 존재
- build check 존재
- generation report 존재
- golden case 최소 3개 존재

---

## 22. 최종 요약

이 시스템은 고객용 AI 입력 보조 기능이 아니다.

고객이 홈페이지 만들기 입력을 완료한 뒤, 기존에 회사 사람이 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent가 자동으로 수행하는 시스템이다.

사람 승인 단계는 없다. 대신 Harness가 자동 검증자로 동작한다.

핵심 산출물은 다음이다.

```text
homepage request JSON
→ Goose Homepage Builder Coding Agent
→ generated site files
→ validation/build result
→ generation-result.json
→ generated/published status
```
