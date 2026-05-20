# Client Flow Gap Analysis

## Summary

현재 구현은 `request JSON -> Goose 실행 -> generated-sites/{company_id} -> validation/build -> preview` 흐름을 검증하는 harness로는 동작한다.

하지만 `docs/evaluation/client-request.md` 기준의 고객용 홈페이지 만들기 플로우로 보면 아직 완성도가 부족하다. 특히 현재 `/test-builder`는 실제 고객 플로우 전체가 아니라, Goose 생성과 결과 확인을 빠르게 검증하기 위한 축약형 테스트 UI에 가깝다.

현재 적합도는 다음과 같이 본다.

| 영역 | 적합도 | 판단 |
| --- | ---: | --- |
| Goose 기반 자동 생성 | 높음 | 실제 생성, validation, build, generated 상태 확인 가능 |
| 입력값 기반 콘텐츠 반영 | 높음 | 회사 정보, 소개, 강점, 태그, 연락처, 연혁, 포트폴리오 반영 |
| fake claim 방지 | 높음 | 입력에 없는 인증/수상/매출/고객사 등을 만들지 않음 |
| 고객 입력 플로우 | 낮음 | `client-request.md`의 STEP 구조와 다름 |
| AI 초안/내용 수정 UX | 낮음 | 초안 확인 단계와 수정/배포 단계가 분리되어 있지 않음 |
| 완료 화면 UX | 낮음 | 주소 복사, 공유, 관리 이동 등 고객용 완료 액션 부족 |
| 최종 홈페이지 UI polish | 중간 | result-style 구조는 있으나 실제 서비스 화면으로는 추가 정리가 필요 |

## Current Implementation Snapshot

현재 고객 테스트용 화면은 `frontend/app/test-builder/TestBuilderForm.tsx`에 있다.

현재 step 구조:

```text
start
-> type
-> info
-> ai
-> done
```

현재 생성 흐름:

```text
/test-builder 입력
-> /api/test-generate 호출
-> request JSON 구성
-> Goose required 실행
-> generated-sites/{company_id} 생성
-> validation/build 통과 시 preview 링크 표시
```

생성된 홈페이지 예시는 `generated-sites/UI_COMPANY_1779122735840` 기준으로 확인했다.

이 예시는 다음 조건을 만족한다.

- `generation-result.json` status가 `generated`
- `validation-report.json` passed가 `true`
- build passed가 `true`
- 회사소개형 `template_variant = result_style_v1`
- 입력된 회사 소개, 핵심 강점, 태그, 연락처, 연혁, 포트폴리오가 결과 페이지에 반영됨

## Gap 1. STEP 구조가 client-request와 다름

`client-request.md`는 고객 플로우를 다음처럼 정의한다.

```text
STEP 0 시작 화면
STEP 1 홈페이지 형식 선택
STEP 2 기업 정보 입력
STEP 3 기업 소개 정보 입력
STEP 4 AI 초안 생성
STEP 5 내용 수정 및 배포
STEP 6 완료 화면
```

현재 `/test-builder`는 다음처럼 축약되어 있다.

```text
start
type
info
ai
done
```

문제:

- `STEP 3 기업 소개 정보 입력`이 독립된 단계로 존재하지 않는다.
- `STEP 4 AI 초안 생성`이 실제 초안 preview 단계로 분리되어 있지 않다.
- `STEP 5 내용 수정 및 배포`가 별도 단계가 아니라 `ai` 단계에 섞여 있다.
- `STEP 6 완료 화면`이 단순 결과 표시 수준이다.

영향:

- 사용자가 “AI가 먼저 초안을 만들고, 다음 단계에서 수정한다”는 제품 경험을 하지 못한다.
- 현재 UX는 “입력 후 바로 생성”에 가깝다.
- client-request가 요구하는 수정 가능성, 섹션 표시/숨김, 최종 배포 확인 흐름이 약하다.

필요 작업:

- `/test-builder` step을 client-request 기준으로 재구성한다.
- 최소한 다음 단계 분리가 필요하다.

```text
start
type
business-info
company-profile
ai-draft
edit-publish
done
```

## Gap 2. 기업 소개 정보 입력 단계가 부족함

`client-request.md`의 STEP 3은 회사소개형에서 중요한 단계다.

요구사항:

- 연혁 최소 1개 필수
- 연도는 4자리 숫자
- 연혁 내용 필수
- 포트폴리오는 선택
- 포트폴리오 입력 시 프로젝트명 필수
- 포트폴리오 파일 첨부 UI 고려

현재 구현:

- 연혁/포트폴리오는 `ai` 단계의 `details` 안에 추가 정보로 들어가 있다.
- 연혁 최소 1개 필수 검증이 없다.
- 연도 4자리 검증이 없다.
- 포트폴리오 입력 구조가 반복 카드가 아니라 textarea 한 덩어리다.
- 파일 첨부 UI가 없다.

영향:

- 회사소개중심형의 핵심인 연혁/포트폴리오 입력 경험이 약하다.
- 사용자가 이 정보가 홈페이지 품질에 중요하다는 신호를 받지 못한다.
- result template은 연혁/포트폴리오 섹션을 지원하지만, 입력 UI가 그 중요도를 충분히 반영하지 못한다.

필요 작업:

- STEP 3을 독립 화면으로 만든다.
- 연혁은 반복 row UI로 구성한다.
- 연혁 최소 1개를 필수로 검증한다.
- 포트폴리오는 반복 카드 UI로 구성한다.
- 파일 첨부는 실제 업로드까지 구현하지 않더라도, 테스트 harness에서는 disabled 또는 placeholder 정책을 명확히 둔다.

## Gap 3. AI 초안 생성 단계가 실제 초안 확인 UX가 아님

`client-request.md`의 STEP 4는 AI 초안 생성 결과를 보여주는 단계다.

요구사항:

- “AI가 초안을 만들었어요! 다음 단계에서 내용을 수정할 수 있습니다” 상태 표시
- 기업 소개 초안 카드
- 핵심 강점 초안 bullet list
- 직접 편집은 다음 단계에서 수행
- AI 생성 실패 시 에러 메시지와 재시도 제공

현재 구현:

- 현재 `ai` 단계에서 사용자가 바로 한 줄 소개, 기업 소개, 핵심 강점을 편집한다.
- 완료 버튼을 누르면 실제 Goose 생성까지 진행된다.
- AI 초안 생성과 최종 홈페이지 생성이 분리되어 있지 않다.

영향:

- “AI가 초안을 만들었다”는 사용자 경험이 없다.
- 초안 검토 후 수정한다는 제품 흐름이 구현되어 있지 않다.
- 실패 시 재시도 UX가 final generation 실패와 섞인다.

필요 작업:

- `ai-draft` 단계를 새로 만든다.
- 이 단계에서는 초안 카드만 보여준다.
- 초안은 request 기반으로 만든 preview content이거나, Goose 생성 전 lightweight draft로 분리한다.
- 실패 상태는 `retry` 버튼과 함께 이 단계에 머물게 한다.

## Gap 4. 내용 수정 및 배포 단계가 부족함

`client-request.md`의 STEP 5는 고객이 AI 초안을 수정하고 최종 생성/배포하는 단계다.

요구사항:

- 한 줄 소개 수정
- 기업 소개 수정
- 핵심 강점 다건 수정
- 섹션 표시/숨김 토글
- 기업 소개는 필수, 숨김 불가
- 빈 핵심 강점 저장 방지
- 최대 개수 제한
- “생성 완료” CTA

현재 구현:

- 한 줄 소개, 기업 소개, 핵심 강점 수정 UI는 존재한다.
- 하지만 이것이 STEP 5가 아니라 `ai` 단계 안에 있다.
- 표시/숨김 토글은 실제 토글이 아니라 정적 `표시` 문구다.
- 기업 소개 필수/숨김 불가 정책이 UI와 validation으로 드러나지 않는다.
- 핵심 강점 빈 값 방지나 최대 개수 제한 UX가 약하다.

영향:

- 고객이 “최종 배포 전에 내용을 확인하고 조정한다”는 느낌이 부족하다.
- section manifest 기반 생성 구조는 있지만, UI에서 표시/숨김 제어가 아직 연결되어 있지 않다.

필요 작업:

- `edit-publish` 단계를 추가한다.
- section visibility state를 form state에 포함한다.
- `content.sections` 또는 `section_manifest`와 연결한다.
- 기업 소개는 항상 visible, required로 고정한다.
- 핵심 강점은 빈 값 제거/저장 방지 정책을 둔다.

## Gap 5. 완료 화면이 client-request보다 단순함

`client-request.md`의 STEP 6은 고객용 완료 화면이다.

요구사항:

- “홈페이지가 생성되었습니다!”
- “지금 바로 공유하고 고객을 만나보세요.”
- 홈페이지 주소 노출
- 주소 복사 버튼
- 복사 완료 toast
- 홈페이지 보기
- 공유하기
- 홈페이지 관리 이동
- 상품 등록하기 또는 회사소개형 후속 액션

현재 구현:

- 생성 성공 여부 표시
- company_id, status, validation, build 표시
- “생성된 홈페이지 보기” 링크 제공

문제:

- `company_id`, `validation`, `build`는 고객용 정보가 아니라 내부 운영 정보다.
- 홈페이지 주소 복사 기능이 없다.
- 공유하기가 없다.
- 홈페이지 관리 이동이 없다.
- 회사소개형 후속 액션인 연혁/포트폴리오 관리 안내가 약하다.

영향:

- 고객에게는 생성이 끝난 후 무엇을 해야 하는지 명확하지 않다.
- 내부 harness report처럼 보인다.

필요 작업:

- 완료 화면을 고객용 화면과 내부 debug 영역으로 분리한다.
- 기본 화면에는 homepage URL, 복사, 보기, 공유, 관리 액션만 보여준다.
- 내부 정보는 접힌 debug panel 또는 운영 report에서만 확인한다.

## Gap 6. 업종/업태 정책이 문서와 다름

`client-request.md`는 업종/업태를 정회원 가입 시 수집된 정보로 보고 read-only로 정의한다.

요구사항:

- 업종 read-only
- 업태 read-only
- “등록된 기업 정보에서 가져온 정보입니다” 문구

현재 구현:

- 업종/업태는 수정 가능하다.
- helper 문구도 “수정할 수 있습니다”로 되어 있다.

문제:

- 현재 UI는 client-request와 정책이 다르다.
- 다만 테스트 과정에서는 업종/업태를 직접 바꿔 생성 결과를 확인하려는 목적이 있었다.

권장 방향:

- 실제 고객 플로우에서는 read-only로 맞춘다.
- 테스트 harness에서는 별도 debug mode나 sample preset으로 값 변경을 허용한다.

필요 작업:

- `/test-builder`가 고객용 flow 역할을 한다면 read-only로 변경한다.
- 입력값 변경 테스트는 별도 developer-only fixture 또는 query flag로 분리한다.

## Gap 7. 회사소개형인데 상품 기본값이 들어감

현재 `initialForm`에는 상품 기본값이 있다.

```text
productName = 업무 자동화 대시보드
productDescription = 반복 업무 현황을 한눈에 보고 자동화 상태를 관리하는 대시보드입니다.
```

문제:

- 현재 테스트 사용자가 상품 입력을 명시하지 않아도 결과 홈페이지에 `주요 상품` 섹션이 생긴다.
- `client-request.md` 기준 회사소개중심형은 회사 스토리, 포트폴리오, 연혁 중심이다.
- 상품 등록 유도는 상품중심형 또는 완료 후 후속 액션에 더 가깝다.

영향:

- 회사소개형 테스트에서 사용자가 “왜 상품이 생겼지?”라고 느낄 수 있다.
- 입력에 없는 상품이 생성된 것처럼 보일 수 있다.

필요 작업:

- 회사소개형 기본값에서는 `productName`, `productDescription`을 비운다.
- 상품 섹션은 사용자가 상품 정보를 명시했을 때만 노출한다.
- 완료 화면에서 “상품 등록하기” 후속 액션을 제공하는 쪽이 더 적절하다.

## Gap 8. 이탈 방지 정책이 없음

`client-request.md`는 입력값이 있을 때 브라우저 뒤로가기, 탭 이동, 닫기 시 확인을 요구한다.

요구사항:

```text
작성 중인 내용이 사라져요. 종료할까요?
취소 / 종료
```

현재 구현:

- browser unload/back guard가 없다.
- 입력값이 있어도 바로 이탈 가능하다.

영향:

- 고객이 입력 중 실수로 이탈하면 작성 내용이 사라질 수 있다.

필요 작업:

- `beforeunload` guard를 추가한다.
- app 내부 step 이동과 브라우저 이탈을 구분한다.
- 입력 변경 여부를 dirty state로 관리한다.

## Gap 9. 정회원/기업인증 진입 조건이 없음

`client-request.md`는 대상 사용자를 BOX 가입 + 기업인증 정회원으로 정의한다.

요구사항:

- 비정회원은 기업인증 유도
- 인증 화면 공통 호출 후 홈페이지 만들기 진행

현재 구현:

- 로컬 harness라 인증 상태가 없다.
- 정회원/비정회원 분기 UI가 없다.

영향:

- 실제 서비스 진입 정책은 아직 검증할 수 없다.

필요 작업:

- harness에서는 mock membership state를 둔다.
- `verified_member = true/false`에 따라 시작 화면 CTA 동작을 다르게 한다.
- 실제 서비스 연동 시 인증 공통 호출 API와 연결한다.

## Gap 10. 최종 홈페이지 UI가 아직 test-result 느낌이 남음

현재 result-style 홈페이지는 `result_template.png`의 정보 구조를 일부 반영한다.

잘 된 점:

- 큰 cover 영역
- 회사 요약
- 태그
- 기업 정보
- 기업 소개
- 핵심 강점
- 연혁
- 포트폴리오
- CTA

부족한 점:

- 아직 일부 spacing이 넓고 정적인 느낌이 있다.
- `H` 브랜드 마크는 실제 서비스 브랜드/회사 로고와 다르다.
- 영어 section label(`Info`, `Company`, `Strengths`)이 고객용 한국어 서비스 톤과 다를 수 있다.
- 고객용 홈페이지라면 내부 preview/debug 느낌을 더 줄여야 한다.

필요 작업:

- result page typography와 spacing을 한 번 더 정리한다.
- section label을 한국어 또는 서비스 정책에 맞게 통일한다.
- 회사 로고/대표 이미지가 없을 때 fallback 정책을 명확히 한다.
- 모바일 화면에서 section 간 간격과 CTA 위치를 추가 확인한다.

## Implementation Priority

### P0. 고객 플로우 구조 맞추기

가장 먼저 `/test-builder`를 `client-request.md` 기준 step으로 나눈다.

```text
start
type
business-info
company-profile
ai-draft
edit-publish
done
```

이 작업이 먼저 필요한 이유:

- 지금 가장 큰 gap은 생성 엔진이 아니라 고객 여정이다.
- 이후 validation, UI polish, completion action도 이 구조 위에 붙어야 한다.

### P1. 회사소개형 기본 정책 정리

- 상품 기본값 제거
- 회사소개형은 연혁/포트폴리오 중심으로 구성
- 업종/업태 read-only 정책 결정
- 테스트용 수정 가능 모드는 별도 분리

### P2. AI 초안과 최종 생성 분리

- AI 초안 preview 단계 추가
- edit-publish 단계에서 최종 request 확정
- 최종 완료 버튼에서 Goose generation 실행

### P3. 완료 화면 고객용으로 전환

- 내부 status/debug 제거 또는 접기
- 홈페이지 URL
- 복사
- 공유
- 홈페이지 보기
- 홈페이지 관리
- 상품 등록/연혁 포트폴리오 관리 후속 액션

### P4. result-style 홈페이지 polish

- `result_template.png` 기준 spacing, section density, labels 정리
- 모바일/데스크톱 반응형 확인
- generated `index.html`과 Next preview가 같은 구조로 보이는지 유지

## Done Criteria For Client Flow

다음 조건을 만족해야 `client-request.md` 기준으로 고객용 플로우가 맞다고 볼 수 있다.

- STEP 0~6이 문서와 같은 역할로 분리되어 있다.
- STEP header, progress, current step label이 문서와 일치한다.
- 회사소개형에서 연혁 최소 1개 입력이 필수다.
- AI 초안 확인 단계와 내용 수정 단계가 분리되어 있다.
- 내용 수정 단계에서 한 줄 소개, 기업 소개, 핵심 강점 수정이 가능하다.
- 표시/숨김 정책이 section manifest에 반영된다.
- 완료 화면은 고객용 URL/복사/보기/공유/관리 액션을 제공한다.
- 회사소개형 기본 생성에서 입력하지 않은 상품이 노출되지 않는다.
- 업종/업태는 실제 고객 플로우에서 read-only 또는 정책 문서에 맞게 일관된다.
- Goose 실패 시 retry 후 `manual_required`로 처리되며, 고객 화면에는 이해 가능한 실패 안내가 나온다.
- 운영/검증 정보는 고객 화면이 아니라 report 또는 debug panel에 남는다.

