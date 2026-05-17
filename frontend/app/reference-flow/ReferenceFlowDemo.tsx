"use client";

import { useMemo, useState } from "react";

type StepKey = "start" | "type" | "info" | "ai" | "done";

const steps: Array<{
  key: StepKey;
  label: string;
  progressLabel: string;
  progress: number;
}> = [
  { key: "start", label: "시작", progressLabel: "", progress: 0 },
  { key: "type", label: "홈페이지 형식", progressLabel: "Step 1 / 4", progress: 25 },
  { key: "info", label: "기업 정보", progressLabel: "Step 2 / 4", progress: 50 },
  { key: "ai", label: "기업 정보", progressLabel: "Step 3 / 4", progress: 100 },
  { key: "done", label: "완료", progressLabel: "Step 4 (완료)", progress: 100 },
];

export default function ReferenceFlowDemo() {
  const [activeStep, setActiveStep] = useState<StepKey>("start");
  const current = useMemo(
    () => steps.find((step) => step.key === activeStep) ?? steps[0],
    [activeStep],
  );

  return (
    <div className="ref-shell">
      <header className="ref-header">
        <div className="ref-brand">
          <span className="ref-brand-icon">▣</span>
          <span>IBK BOX</span>
        </div>
        <nav className="ref-nav" aria-label="reference navigation">
          <button>홈</button>
          <button>기업</button>
          <button>상품</button>
          <button>이벤트</button>
          <button>설정</button>
        </nav>
        <button className="ref-menu" aria-label="menu">
          ☰
        </button>
      </header>

      {activeStep !== "start" ? (
        <div className="ref-progress-wrap">
          <div className="ref-progress-head">
            <span>{current.progressLabel}</span>
            <strong>{current.label}</strong>
          </div>
          <div className="ref-progress-track">
            <div className="ref-progress-bar" style={{ width: `${current.progress}%` }} />
          </div>
        </div>
      ) : null}

      <main className="ref-main">{renderStep(activeStep, setActiveStep)}</main>
    </div>
  );
}

function renderStep(activeStep: StepKey, setActiveStep: (step: StepKey) => void) {
  switch (activeStep) {
    case "type":
      return <TypeStep setActiveStep={setActiveStep} />;
    case "info":
      return <InfoStep setActiveStep={setActiveStep} />;
    case "ai":
      return <AiStep setActiveStep={setActiveStep} />;
    case "done":
      return <DoneStep setActiveStep={setActiveStep} />;
    case "start":
    default:
      return <StartStep setActiveStep={setActiveStep} />;
  }
}

function StartStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-center ref-start">
      <div className="ref-hero-icon">✧</div>
      <h1>무료로 기업 홈페이지를 만들어보세요</h1>
      <p>AI가 도와주는 간단한 단계로 전문적인 기업 홈페이지를 만들 수 있습니다.</p>
      <p>언제든 수정할 수 있으니 부담 없이 시작해보세요.</p>

      <div className="ref-benefits">
        <Benefit icon="◷" title="3일이면 완성" text="간단한 정보만 입력하면 홈페이지가 생성됩니다" />
        <Benefit icon="✦" title="AI가 자동 생성" text="기업 소개, 핵심 강점 등을 AI가 만들어줍니다" />
        <Benefit icon="♡" title="언제든 수정 가능" text="생성 후에도 자유롭게 수정하고 관리할 수 있습니다" />
      </div>

      <button className="ref-primary-button" onClick={() => setActiveStep("type")}>
        시작하기
      </button>
      <p className="ref-footnote">정회원 전용 무료 서비스입니다</p>
    </section>
  );
}

function TypeStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>홈페이지 형식을 선택해주세요</h1>
        <p>나중에 언제든 변경할 수 있습니다</p>
      </div>

      <div className="ref-choice-list">
        <button className="ref-choice-card">
          <span className="ref-choice-icon">◇</span>
          <span>
            <strong>상품중심형</strong>
            <small>등록한 상품을 중심으로 보여주는 홈페이지입니다.</small>
            <em>
              <span>상품 갤러리</span>
              <span>견적/구매 강조</span>
            </em>
          </span>
        </button>
        <button className="ref-choice-card">
          <span className="ref-choice-icon">▤</span>
          <span>
            <strong>회사소개중심형</strong>
            <small>회사 소개와 포트폴리오를 중심으로 보여주는 홈페이지입니다.</small>
            <em>
              <span>회사 스토리</span>
              <span>포트폴리오</span>
              <span>연혁</span>
            </em>
          </span>
        </button>
      </div>

      <StepButtons back={() => setActiveStep("start")} next={() => setActiveStep("info")} />
    </section>
  );
}

function InfoStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>기업 정보를 입력해주세요</h1>
        <p>AI가 이 정보를 바탕으로 홈페이지를 만듭니다</p>
      </div>

      <div className="ref-form">
        <Field label="업종" value="IT·소프트웨어" helper="등록된 기업 정보에서 가져온 정보입니다" />
        <Field label="업태" value="도매 및 소프트웨어 개발" helper="등록된 기업 정보에서 가져온 정보입니다" />
        <label className="ref-field">
          <span>
            주요 사업 내용 <b>*</b>
          </span>
          <textarea placeholder="어떤 사업을 하시나요? 간단하게 설명해주세요.&#10;예: AI 기반 재고관리 솔루션을 개발하고 공급합니다" />
          <small>최소 10자 이상 입력해주세요 (0/10)</small>
        </label>
      </div>

      <p className="ref-blue-note">
        입력하신 정보는 AI가 홈페이지 내용을 생성할 때 참고됩니다. 생성 후 자유롭게 수정할 수 있으니 부담 없이 작성해주세요.
      </p>

      <StepButtons back={() => setActiveStep("type")} next={() => setActiveStep("ai")} />
    </section>
  );
}

function AiStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>기업 정보를 입력해주세요</h1>
        <p>AI가 이 정보를 바탕으로 홈페이지를 만듭니다</p>
      </div>

      <div className="ref-section-card">
        <div className="ref-section-head">
          <span>한 줄 소개</span>
          <small>⊙ 표시</small>
        </div>
        <input aria-label="한 줄 소개" />
      </div>

      <div className="ref-section-card">
        <span>기업 소개</span>
        <textarea aria-label="기업 소개" />
      </div>

      <div className="ref-section-card">
        <div className="ref-section-head">
          <span>핵심 강점</span>
          <small>⊙ 표시</small>
        </div>
        <ul className="ref-strength-fields">
          <li>업계 10년 이상의 풍부한 경험과 노하우</li>
          <li>고객 맞춤형 솔루션 제공</li>
          <li>전문 인력을 통한 체계적인 서비스</li>
          <li>신속하고 정확한 A/S 지원</li>
        </ul>
      </div>

      <p className="ref-yellow-note">
        각 섹션의 표시/숨김을 조절할 수 있습니다. 생성 완료 후에도 마이기업 페이지에서 언제든 수정 가능합니다.
      </p>

      <StepButtons
        back={() => setActiveStep("info")}
        next={() => setActiveStep("done")}
        nextLabel="생성 완료"
      />
    </section>
  );
}

function DoneStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-center ref-done">
      <div className="ref-done-icon">✓</div>
      <h1>AI 홈페이지 만들기를 신청 하였습니다.</h1>
      <p>정확한 기업정보를 확인하기 위해 3일 후 홈페이지가 완성됩니다.</p>

      <div className="ref-more-box">
        <strong>더 많은 정보로<br />홈페이지를 꾸며보세요!</strong>
        <button className="ref-more-card">
          <span className="ref-choice-icon">◇</span>
          <span>
            <strong>상품 등록하기</strong>
            <small>홈페이지에 표시할 상품을 등록해보세요</small>
          </span>
        </button>
      </div>

      <button className="ref-ghost-button" onClick={() => setActiveStep("start")}>
        완료
      </button>
    </section>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="ref-benefit">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}

function Field({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <label className="ref-field">
      <span>{label}</span>
      <input value={value} readOnly />
      <small>{helper}</small>
    </label>
  );
}

function StepButtons({
  back,
  next,
  nextLabel = "다음",
}: {
  back: () => void;
  next: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="ref-actions">
      <button className="ref-secondary-button" onClick={back}>
        이전
      </button>
      <button className="ref-primary-button" onClick={next}>
        {nextLabel}
      </button>
    </div>
  );
}
