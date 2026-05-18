"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type GenerateResult = {
  ok: boolean;
  requestId: string;
  companyId: string;
  modelProvider: string;
  modelName: string;
  status: string;
  homepageUrl: string;
  generatedPath: string;
  validationPassed: boolean;
  buildPassed: boolean;
  previewAvailable: boolean;
  retryCount: number;
  exitCode: number | null;
  failureCategory?: string | null;
  failureTitle?: string | null;
  failureMessage?: string | null;
  nextAction?: string | null;
  errorSummary?: string;
};

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
  { key: "ai", label: "설정", progressLabel: "Step 3 / 4", progress: 75 },
  { key: "done", label: "완료", progressLabel: "Step 4 (완료)", progress: 100 },
];

const initialForm = {
  homepageType: "company_intro",
  companyName: "주식회사 테스트홈",
  industry: "IT·소프트웨어",
  businessType: "업무 자동화 솔루션 개발 및 공급",
  mainBusinessDescription: "기업의 반복 업무를 줄이는 업무 자동화 솔루션을 개발하고 공급합니다.",
  oneLineIntro: "반복 업무를 줄이는 자동화 솔루션",
  companyIntro: "주식회사 테스트홈은 기업의 업무 흐름을 분석하고 자동화 시스템을 구축하는 회사입니다.",
  coreStrengths: "업무 자동화\n데이터 관리\n기업 맞춤 구축\n빠른 도입 지원",
  tags: "업무 자동화\n데이터 관리\n기업 맞춤",
  coverImageUrl: "",
  contactAddress: "서울특별시 강남구 테스트로 10",
  contactPhone: "02-1234-5678",
  contactEmail: "hello@testhome.example",
  contactWebsiteUrl: "https://example.com",
  productName: "업무 자동화 대시보드",
  productDescription: "반복 업무 현황을 한눈에 보고 자동화 상태를 관리하는 대시보드입니다.",
  productImageUrl: "",
  portfolioItems: "업무 자동화 포털 구축 | 반복 업무 신청과 승인 상태를 한 화면에서 관리하는 포털을 구축했습니다.",
  historyItems: "2026 | 업무 자동화 솔루션 테스트 서비스를 시작했습니다.",
  generationMode: "goose",
};

export default function TestBuilderForm() {
  const [activeStep, setActiveStep] = useState<StepKey>("start");
  const [form, setForm] = useState(initialForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo(
    () => steps.find((step) => step.key === activeStep) ?? steps[0],
    [activeStep],
  );

  function updateField(field: keyof typeof form, value: string) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function updateCoreStrength(index: number, value: string) {
    const strengths = form.coreStrengths.split("\n");
    strengths[index] = value;
    updateField("coreStrengths", strengths.join("\n"));
  }

  async function generateHomepage() {
    setActiveStep("done");
    setIsGenerating(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/test-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ? `${body.error}: ${(body.fields || []).join(", ")}` : "요청 처리 실패");
        setResult(body);
        return;
      }
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청 실패");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="ref-shell test-builder-flow">
      <header className="ref-header">
        <div className="ref-brand">
          <span className="ref-brand-icon">▣</span>
          <span>IBK BOX</span>
        </div>
        <nav className="ref-nav" aria-label="builder navigation">
          <button>홈</button>
          <button>기업</button>
          <button>상품</button>
          <button>이벤트</button>
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

      <main className="ref-main">
        {activeStep === "start" ? <StartStep setActiveStep={setActiveStep} /> : null}
        {activeStep === "type" ? <TypeStep setActiveStep={setActiveStep} /> : null}
        {activeStep === "info" ? (
          <InfoStep form={form} setActiveStep={setActiveStep} updateField={updateField} />
        ) : null}
        {activeStep === "ai" ? (
          <AiStep
            form={form}
            generateHomepage={generateHomepage}
            setActiveStep={setActiveStep}
            updateCoreStrength={updateCoreStrength}
            updateField={updateField}
          />
        ) : null}
        {activeStep === "done" ? (
          <DoneStep
            error={error}
            isGenerating={isGenerating}
            result={result}
            restart={() => {
              setResult(null);
              setError(null);
              setActiveStep("type");
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
function StartStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-center ref-start">
      <div className="ref-hero-icon">✧</div>
      <h1>무료로 기업 홈페이지를 만들어보세요</h1>
      <p>AI가 도와주는 간단한 단계로 전문적인 기업 홈페이지를 만들 수 있습니다.</p>
      <p>마지막 완료 버튼을 누르면 실제 Goose 생성과 검증이 실행됩니다.</p>

      <div className="ref-benefits">
        <Benefit icon="◷" title="자동 생성" text="입력 완료 후 request JSON을 만들고 Goose를 실행합니다" />
        <Benefit icon="✦" title="템플릿 기반" text="회사소개중심형 result-style 템플릿 안에서 생성합니다" />
        <Benefit icon="✓" title="검증 후 공개" text="validation/build 통과 시 생성된 홈페이지를 바로 확인합니다" />
      </div>

      <button className="ref-primary-button" onClick={() => setActiveStep("type")}>
        시작하기
      </button>
      <p className="ref-footnote">테스트 환경에서는 Goose provider 설정과 quota 상태에 따라 실패할 수 있습니다</p>
    </section>
  );
}

function TypeStep({ setActiveStep }: { setActiveStep: (step: StepKey) => void }) {
  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>홈페이지 형식을 선택해주세요</h1>
        <p>현재 테스트 생성은 회사소개중심형으로 고정되어 있습니다</p>
      </div>

      <div className="ref-choice-list">
        <button className="ref-choice-card ref-choice-card-disabled" disabled>
          <span className="ref-choice-icon">◇</span>
          <span>
            <strong>상품중심형</strong>
            <small>등록한 상품을 중심으로 보여주는 홈페이지입니다.</small>
            <em>
              <span>상품 갤러리</span>
              <span>견적/구매 강조</span>
              <span>추후 지원</span>
            </em>
          </span>
        </button>
        <button className="ref-choice-card ref-choice-card-selected" disabled>
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

function InfoStep({
  form,
  setActiveStep,
  updateField,
}: {
  form: typeof initialForm;
  setActiveStep: (step: StepKey) => void;
  updateField: (field: keyof typeof initialForm, value: string) => void;
}) {
  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>기업 정보를 입력해주세요</h1>
        <p>AI가 이 정보를 바탕으로 홈페이지를 만듭니다</p>
      </div>

      <div className="ref-form">
        <Field
          label="회사명"
          value={form.companyName}
          onChange={(value) => updateField("companyName", value)}
        />
        <Field
          helper="등록된 기업 정보에서 가져온 정보이며 수정할 수 있습니다"
          label="업종"
          value={form.industry}
          onChange={(value) => updateField("industry", value)}
        />
        <Field
          helper="등록된 기업 정보에서 가져온 정보이며 수정할 수 있습니다"
          label="업태"
          value={form.businessType}
          onChange={(value) => updateField("businessType", value)}
        />
        <label className="ref-field">
          <span>
            주요 사업 내용 <b>*</b>
          </span>
          <textarea
            value={form.mainBusinessDescription}
            onChange={(event) => updateField("mainBusinessDescription", event.target.value)}
          />
          <small>최소 10자 이상 입력해주세요 ({Math.min(form.mainBusinessDescription.length, 10)}/10)</small>
        </label>
      </div>

      <p className="ref-blue-note">
        입력하신 정보는 AI가 홈페이지 내용을 생성할 때 참고됩니다. 생성 후 결과 화면에서 바로 확인할 수 있습니다.
      </p>

      <StepButtons back={() => setActiveStep("type")} next={() => setActiveStep("ai")} />
    </section>
  );
}

function AiStep({
  form,
  generateHomepage,
  setActiveStep,
  updateCoreStrength,
  updateField,
}: {
  form: typeof initialForm;
  generateHomepage: () => void;
  setActiveStep: (step: StepKey) => void;
  updateCoreStrength: (index: number, value: string) => void;
  updateField: (field: keyof typeof initialForm, value: string) => void;
}) {
  const strengths = form.coreStrengths.split("\n");

  return (
    <section className="ref-panel">
      <div className="ref-title">
        <h1>홈페이지 내용을 설정해주세요</h1>
        <p>입력한 내용만 템플릿에 반영되고, 없는 정보는 만들어내지 않습니다</p>
      </div>

      <div className="ref-section-card">
        <div className="ref-section-head">
          <span>한 줄 소개</span>
          <small>표시</small>
        </div>
        <input
          aria-label="한 줄 소개"
          value={form.oneLineIntro}
          onChange={(event) => updateField("oneLineIntro", event.target.value)}
        />
      </div>

      <div className="ref-section-card">
        <span>기업 소개</span>
        <textarea
          aria-label="기업 소개"
          value={form.companyIntro}
          onChange={(event) => updateField("companyIntro", event.target.value)}
        />
      </div>

      <div className="ref-section-card">
        <div className="ref-section-head">
          <span>핵심 강점</span>
          <small>표시</small>
        </div>
        <ul className="ref-strength-fields">
          {[0, 1, 2, 3].map((index) => (
            <li key={index}>
              <input
                aria-label={`핵심 강점 ${index + 1}`}
                value={strengths[index] ?? ""}
                onChange={(event) => updateCoreStrength(index, event.target.value)}
              />
            </li>
          ))}
        </ul>
      </div>

      <details className="ref-section-card">
        <summary>추가 정보</summary>
        <div className="ref-form ref-extra-form">
          <Field label="태그" value={form.tags} onChange={(value) => updateField("tags", value)} />
          <Field
            label="커버 이미지 URL"
            value={form.coverImageUrl}
            onChange={(value) => updateField("coverImageUrl", value)}
          />
          <Field
            label="연락처"
            value={form.contactPhone}
            onChange={(value) => updateField("contactPhone", value)}
          />
          <Field
            label="이메일"
            value={form.contactEmail}
            onChange={(value) => updateField("contactEmail", value)}
          />
          <label className="ref-field">
            <span>포트폴리오</span>
            <textarea
              value={form.portfolioItems}
              onChange={(event) => updateField("portfolioItems", event.target.value)}
            />
            <small>형식: 프로젝트명 | 설명</small>
          </label>
          <label className="ref-field">
            <span>연혁</span>
            <textarea
              value={form.historyItems}
              onChange={(event) => updateField("historyItems", event.target.value)}
            />
            <small>형식: 연도 | 내용</small>
          </label>
        </div>
      </details>

      <p className="ref-yellow-note">
        완료하면 실제 Goose agent가 실행됩니다. validation/build를 통과하면 생성된 홈페이지 링크가 표시됩니다.
      </p>

      <StepButtons
        back={() => setActiveStep("info")}
        next={generateHomepage}
        nextLabel="완료하고 홈페이지 생성"
      />
    </section>
  );
}

function DoneStep({
  error,
  isGenerating,
  restart,
  result,
}: {
  error: string | null;
  isGenerating: boolean;
  restart: () => void;
  result: GenerateResult | null;
}) {
  if (isGenerating) {
    return (
      <section className="ref-center ref-done">
        <div className="ref-hero-icon">✦</div>
        <h1>AI가 홈페이지를 생성하고 있습니다.</h1>
        <p>request JSON 생성, Goose 실행, validation/build 검증을 순서대로 처리합니다.</p>
      </section>
    );
  }

  if (result?.previewAvailable) {
    return (
      <section className="ref-center ref-done">
        <div className="ref-done-icon">✓</div>
        <h1>홈페이지 생성이 완료되었습니다.</h1>
        <p>자동 검증과 build를 통과했습니다.</p>

        <div className="ref-result-box">
          <dl className="meta-list">
            <div>
              <dt>company_id</dt>
              <dd>{result.companyId}</dd>
            </div>
            <div>
              <dt>status</dt>
              <dd>{result.status}</dd>
            </div>
            <div>
              <dt>validation</dt>
              <dd>{result.validationPassed ? "pass" : "fail"}</dd>
            </div>
            <div>
              <dt>build</dt>
              <dd>{result.buildPassed ? "pass" : "fail"}</dd>
            </div>
          </dl>
          <Link className="ref-primary-button ref-result-link" href={result.homepageUrl}>
            생성된 홈페이지 보기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="ref-center ref-done">
      <div className="ref-done-icon ref-done-icon-failed">!</div>
      <h1>{result?.failureTitle || "자동 생성이 완료되지 않았습니다."}</h1>
      <p>{result?.failureMessage || error || "Goose 실행 또는 검증 단계에서 실패했습니다."}</p>
      {result?.nextAction ? <p>{result.nextAction}</p> : null}
      {result?.errorSummary ? <pre className="ref-error-summary">{result.errorSummary}</pre> : null}
      <button className="ref-ghost-button" onClick={restart}>
        다시 입력하기
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

function Field({
  helper,
  label,
  onChange,
  value,
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="ref-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {helper ? <small>{helper}</small> : null}
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
      <button className="ref-secondary-button" onClick={back} type="button">
        이전
      </button>
      <button className="ref-primary-button" onClick={next} type="button">
        {nextLabel}
      </button>
    </div>
  );
}
