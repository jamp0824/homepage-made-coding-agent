# Codex Master Prompt

이 프로젝트는 고객용 AI 채팅 빌더가 아니다.

고객이 홈페이지 만들기 STEP을 완료하면, 기존에는 회사 담당자가 그 입력 정보를 보고 홈페이지를 수동 제작했다. 이번 목표는 그 수동 제작 업무를 Goose 기반 무료/오픈소스 Coding Agent로 자동화하는 것이다.

사용할 조합:

- Goose as free/open-source coding agent runner
- ChatGPT / Claude / Gemini API 또는 구독 연동
- Harness validation
- React 또는 Next.js 기반 홈페이지 템플릿
- 고객 입력 완료 후 생성되는 request JSON

중요 전제:

- 승인 단계는 없다.
- Agent 생성 결과는 자동 validation/build를 통과하면 generated/published 상태가 된다.
- 실패하면 retry 후 manual_required 상태가 된다.
- manual_required는 승인 대기가 아니라 자동화 실패 예외 상태다.
- 외부 서비스 템플릿을 복제하지 않는다.
- Agent가 완전히 자유롭게 홈페이지 코드를 새로 만들게 하지 않는다.
- 정해진 template/config/component/design rule 안에서 생성하게 한다.

먼저 다음 문서를 읽어라.

1. PRD.md
2. AGENTS.md
3. docs/01_project_intent.md
4. docs/02_reference_images.md
5. docs/03_harness_strategy.md
6. docs/04_role_task_harness.md
7. harness/validation-rules.md
8. docs/pics/pic1~pic8

처음에는 실제 코드를 크게 구현하지 말고, Plan부터 작성해라.

출력 형식:

1. Understanding
   - 이 프로젝트가 무엇인지
   - 무엇이 아닌지

2. Development Plan
   - 단계별 구현 계획

3. Files to Create/Modify
   - 파일 목록
   - 각 파일의 역할

4. Harness Plan
   - schema 검증
   - 생성 결과 검증
   - fake claims 검증
   - build 검증
   - retry/manual_required 처리

5. First Implementation Step
   - 가장 먼저 만들 파일 5개
   - 왜 그 파일부터 만들어야 하는지

주의:

- 고객 입력 UI 전체 재구현으로 가지 마라.
- 내부 승인 화면 만들지 마라.
- 사람 검수 플로우 만들지 마라.
- 입력에 없는 회사 정보를 만들어내지 마라.
- 임의 패키지 설치하지 마라.
- 우선 sample request → generated site → validation report 흐름을 만드는 데 집중해라.
