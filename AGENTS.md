# AGENTS.md — Goose Homepage Builder System

## Project Mission

이 repo의 목표는 고객이 홈페이지 만들기 입력을 완료한 뒤, 기존 회사 내부 담당자가 수동으로 하던 홈페이지 제작 업무를 Goose 기반 Coding Agent가 자동 수행하도록 만드는 것이다.

고객용 AI 채팅 빌더가 아니다. 고객 입력 화면 재구현이 핵심이 아니다. 입력 완료 후 홈페이지 파일을 자동 생성하는 시스템이 핵심이다.

## Non-negotiable Rules

1. 사람 승인 플로우를 만들지 않는다.
2. 자동 validation/build를 통과하면 generated/published 상태로 처리한다.
3. 실패하면 retry 후 manual_required로 전환한다.
4. 외부 서비스 템플릿을 복제하지 않는다.
5. Agent가 완전히 새로운 자유 디자인을 매번 만들게 하지 않는다.
6. 정해진 template/config/component 규칙 안에서만 홈페이지를 생성한다.
7. 입력에 없는 사실을 만들지 않는다.
8. 입력에 없는 상품/연혁/인증/수상/고객사/매출/성과 수치를 생성하지 않는다.
9. 지정된 generated-sites/{company_id}/ 외부 파일을 임의 수정하지 않는다.
10. 임의 패키지 설치를 하지 않는다.

## Required Reading Order

Before coding, read:

1. `PRD.md`
2. `docs/01_project_intent.md`
3. `docs/02_reference_images.md`
4. `docs/03_harness_strategy.md`
5. `docs/04_role_task_harness.md`
6. `harness/validation-rules.md`

## Reference Images

Images are under `docs/pics/`.

- pic1_cover.png
- pic2_step0.png
- pic3_step1.png
- pic4_step2.png
- pic5_step3.png
- pic6_full_flow.png
- pic7_company_type.png
- pic8_container.png

Use these images to understand the original customer input process and expected business context. Do not copy the visual design blindly.

## Architecture Direction

Build toward this flow:

```text
request JSON
→ Goose recipe
→ homepage builder agent
→ generated-sites/{company_id}/
→ validation harness
→ generation-result.json
```

## Expected Directory Structure

```text
requests/
templates/
generated-sites/
prompts/
recipes/
schemas/
harness/
scripts/
docs/
```

## Verification Commands

When implemented, provide and run these commands:

```bash
bash scripts/run-homepage-builder.sh requests/sample-company-intro.json
bash scripts/validate-generated-site.sh generated-sites/COMPANY_001
npm run build
```

If the project is not Node-based yet, create placeholder validation scripts first and document the future build command.

## Done Definition

A task is done only when:

- It matches `PRD.md`.
- It includes schema or validation coverage where relevant.
- It does not introduce approval flow.
- It does not invent company facts.
- It produces or preserves a clear generation report.
- It documents how to run and verify.
