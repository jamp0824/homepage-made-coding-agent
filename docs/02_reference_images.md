# Reference Images Guide

Codex는 `docs/pics/pic1~pic8` 이미지를 요구사항의 시각적 참고 자료로 사용해야 한다.

## Image Mapping

- `pic1_cover.png`: 기능 소개/표지 맥락
- `pic2_step0.png`: 시작 화면
- `pic3_step1.png`: 홈페이지 형식 선택
- `pic4_step2.png`: 기업 정보 입력
- `pic5_step3.png`: AI 생성/내용 수정 단계
- `pic6_full_flow.png`: 전체 STEP 흐름
- `pic7_company_type.png`: 회사소개형 결과/맥락 참고
- `pic8_container.png`: 레이아웃 컨테이너 참고

## How to Use These Images

이미지는 고객이 입력하는 기존 프로세스를 이해하기 위한 자료다.

Codex는 이미지를 보고 다음을 추출해야 한다.

1. 고객 입력 완료 후 어떤 데이터가 생기는지
2. 상품중심형/회사소개중심형 차이
3. 홈페이지 결과물에 필요한 기본 섹션
4. 기존 서비스가 기대하는 톤과 간결함
5. 자동 제작 결과가 어떤 종류의 콘텐츠를 포함해야 하는지

## How Not to Use These Images

- 디자인을 픽셀 단위로 복제하지 않는다.
- 외부 서비스 템플릿처럼 그대로 구현하지 않는다.
- 고객 입력 UI를 MVP 핵심으로 삼지 않는다.
- 승인 화면을 만들기 위한 근거로 사용하지 않는다.

## Required Output From Image Analysis Task

Codex의 첫 분석 태스크에서는 아래 문서를 만들어야 한다.

- `docs/reference-flow-analysis.md`
- `docs/homepage-output-requirements.md`

`reference-flow-analysis.md`에는 STEP 0~4의 입력/출력/상태를 정리한다.

`homepage-output-requirements.md`에는 Agent가 실제 홈페이지를 만들 때 필요한 섹션, 데이터, 에셋, 템플릿 조건을 정리한다.
