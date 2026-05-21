"use client";

import Link from "next/link";
import { type KeyboardEvent, useState } from "react";

type DraftStatus = "needs_input" | "drafted" | "edited" | "confirmed" | "validation_failed";
type HomepageType = "company_intro" | "product";
type StepKey = "compose" | "builder";

type Draft = {
  draft_id: string;
  draft_status: DraftStatus;
  homepage_type: HomepageType;
  company_name: string;
  industry: string;
  business_type: string;
  main_business_description: string;
  initial_prompt?: string;
  one_line_intro: string;
  company_intro: string;
  core_strengths: string[];
  tags: string[];
  contact: Record<string, string>;
  products: Array<{ name: string; description?: string; image_url?: string }>;
  history: Array<{ year: string; text: string }>;
  portfolio: Array<{ title?: string; description?: string }>;
  section_visibility: Record<string, boolean>;
  section_layout: Record<string, string>;
  content_density: "compact" | "standard" | "rich";
  validation_result: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type Session = {
  draft_id: string;
  current_step: string;
  last_assistant_message: string;
  pending_questions: string[];
  messages: ChatMessage[];
};

type GenerationJob = {
  job_id: string;
  request_id: string;
  company_id: string;
  status: string;
  homepage_url: string;
  generated_path: string;
  exit_code: number | null;
  result?: {
    validation_result?: { passed?: boolean };
    build_result?: { passed?: boolean };
    retry_count?: number;
  };
};

type DraftResponse = {
  ok: boolean;
  draft_id: string;
  assistant_message?: string;
  draft_provider?: string;
  draft_provider_status?: string;
  draft: Draft;
  session: Session;
};

type MessageResponse = {
  ok: boolean;
  assistant_message: string;
  patch: Record<string, unknown>;
  draft: Draft;
  session: Session;
  error?: string;
};

type GenerationResponse = {
  ok: boolean;
  job: GenerationJob;
  error?: string;
  stdout?: string;
  stderr?: string;
};

type BuilderForm = {
  homepageType: HomepageType;
  initialPrompt: string;
  companyName: string;
  industry: string;
  businessType: string;
  mainBusinessDescription: string;
  contactPhone: string;
  contactEmail: string;
  historyItems: string;
  portfolioItems: string;
};

const homepageTypeOptions: Array<{
  value: HomepageType;
  title: string;
  description: string;
  icon: string;
  chips: string[];
  disabled?: boolean;
}> = [
  {
    value: "company_intro",
    title: "회사 소개 중심",
    description: "result_template 안에서 회사 소개, 강점, 연혁, 포트폴리오를 강조합니다.",
    icon: "▤",
    chips: ["회사 소개", "강점", "연혁/포트폴리오"],
  },
  {
    value: "product",
    title: "상품 정보 중심",
    description: "상품 중심 구성은 별도 기준 템플릿 확정 후 지원합니다.",
    icon: "◇",
    chips: ["준비 중", "템플릿 확정 필요"],
    disabled: true,
  },
];

const quickActions = [
  "내용을 더 풍부하게 해줘",
  "핵심 강점을 카드형으로 보여줘",
  "연혁은 간단하게 보여줘",
  "포트폴리오는 숨겨줘",
];

const initialForm: BuilderForm = {
  homepageType: "company_intro",
  initialPrompt:
    "AI 기반 재고관리 솔루션 회사 홈페이지 초안을 전문적이고 신뢰감 있게 만들어줘. 중소기업의 입출고와 발주 업무 자동화를 강조해줘.",
  companyName: "주식회사 샘플AI",
  industry: "IT·소프트웨어",
  businessType: "소프트웨어 개발 및 공급",
  mainBusinessDescription: "AI 기반 재고관리 솔루션을 개발하고 중소기업에 공급합니다.",
  contactPhone: "02-1234-5678",
  contactEmail: "hello@example.com",
  historyItems: "2026 | AI 재고관리 솔루션 서비스를 시작했습니다.",
  portfolioItems: "재고관리 업무 자동화 구축 | 입출고와 발주 상태를 한 화면에서 관리하는 업무 환경을 구성했습니다.",
};

export default function TestBuilderForm() {
  const [activeStep, setActiveStep] = useState<StepKey>("compose");
  const [form, setForm] = useState<BuilderForm>(initialForm);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chatInput, setChatInput] = useState("핵심 강점을 카드형으로 더 풍부하게 보여줘");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generation, setGeneration] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof BuilderForm>(field: K, value: BuilderForm[K]) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function createDraft() {
    setIsDrafting(true);
    setError(null);
    setGeneration(null);

    try {
      const response = await fetch("/api/homepage-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload(form)),
      });
      const body = await readJsonResponse<DraftResponse & { error?: string }>(response);
      if (!response.ok) {
        setError(body.error || "초안 생성 실패");
        return;
      }
      setDraft(body.draft);
      setSession(body.session);
      setActiveStep("builder");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "초안 생성 요청 실패");
    } finally {
      setIsDrafting(false);
    }
  }

  async function sendMessage() {
    if (!draft || !chatInput.trim()) return;
    setIsSending(true);
    setError(null);
    setGeneration(null);

    try {
      const response = await fetch(`/api/homepage-drafts/${draft.draft_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput }),
      });
      const body = await readJsonResponse<MessageResponse>(response);
      if (!response.ok) {
        setError(body.error || "대화 수정 실패");
        return;
      }
      setDraft(body.draft);
      setSession(body.session);
      setChatInput("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "대화 수정 요청 실패");
    } finally {
      setIsSending(false);
    }
  }

  async function generateFromDraft() {
    if (!draft) return;
    setIsGenerating(true);
    setError(null);
    setGeneration(null);

    try {
      const response = await fetch("/api/homepage-generation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_id: draft.draft_id,
          generation_mode: "auto",
        }),
      });
      const body = await readJsonResponse<GenerationResponse>(response);
      setGeneration(body);
      if (!response.ok) {
        setError(body.error || "최종 생성 실패");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "최종 생성 요청 실패");
    } finally {
      setIsGenerating(false);
    }
  }

  function restart() {
    setDraft(null);
    setSession(null);
    setGeneration(null);
    setError(null);
    setChatInput("핵심 강점을 카드형으로 더 풍부하게 보여줘");
    setActiveStep("compose");
  }

  return (
    <div className={`ref-shell test-builder-flow test-builder-step-${activeStep}`}>
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

      <main className="ref-main">
        {activeStep === "compose" ? (
          <ComposeStep
            createDraft={createDraft}
            error={error}
            form={form}
            isDrafting={isDrafting}
            updateField={updateField}
          />
        ) : null}
        {activeStep === "builder" && draft ? (
          <BuilderStep
            chatInput={chatInput}
            draft={draft}
            error={error}
            generateFromDraft={generateFromDraft}
            generation={generation}
            isGenerating={isGenerating}
            isSending={isSending}
            restart={restart}
            sendMessage={sendMessage}
            session={session}
            setChatInput={setChatInput}
          />
        ) : null}
      </main>
    </div>
  );
}

function ComposeStep({
  createDraft,
  error,
  form,
  isDrafting,
  updateField,
}: {
  createDraft: () => void;
  error: string | null;
  form: BuilderForm;
  isDrafting: boolean;
  updateField: <K extends keyof BuilderForm>(field: K, value: BuilderForm[K]) => void;
}) {
  const canCreateDraft = Boolean(form.initialPrompt.trim());

  return (
    <section className="make-compose">
      <div className="make-compose-heading">
        <h1>어떤 홈페이지를 만들까요?</h1>
        <p>요청을 입력하면 Goose가 고정 템플릿 슬롯에 맞춰 초안 홈페이지를 구성합니다.</p>
      </div>

      <div className="make-composer-card">
        <label className="make-prompt-field">
          <span>초기 prompt</span>
          <textarea
            aria-label="초기 홈페이지 생성 요청"
            disabled={isDrafting}
            value={form.initialPrompt}
            onChange={(event) => updateField("initialPrompt", event.target.value)}
          />
        </label>
        <div className="make-composer-footer">
          <span>Goose fixed template draft</span>
          <button
            className="ref-primary-button"
            disabled={isDrafting || !canCreateDraft}
            onClick={createDraft}
            type="button"
          >
            {isDrafting ? "초안 구성 중..." : "초안 만들기"}
          </button>
        </div>
      </div>

      {error ? <div className="draft-error-banner">{error}</div> : null}

      <section className="make-homepage-types" aria-label="홈페이지 형식 선택">
        <div className="make-section-title">
          <h2>고정 템플릿 구성 방향</h2>
          <p>템플릿은 result_template 하나로 고정하고, 초안에서 강조할 콘텐츠만 선택합니다.</p>
        </div>
        <div className="make-type-card-grid" role="radiogroup" aria-label="홈페이지 형식">
          {homepageTypeOptions.map((option) => {
            const selected = form.homepageType === option.value;
            return (
              <button
                aria-checked={selected}
                className={`make-type-card${selected ? " make-type-card-selected" : ""}${
                  option.disabled ? " make-type-card-disabled" : ""
                }`}
                disabled={isDrafting || option.disabled}
                key={option.value}
                onClick={() => {
                  if (!option.disabled) updateField("homepageType", option.value);
                }}
                role="radio"
                type="button"
              >
                <span className="make-type-icon">{option.icon}</span>
                <span>
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                  <em>
                    {option.chips.map((chip) => (
                      <b key={chip}>{chip}</b>
                    ))}
                  </em>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <details className="make-additional-info">
        <summary>선택 정보</summary>
        <div className="make-info-grid">
          <Field
            disabled={isDrafting}
            label="회사명"
            value={form.companyName}
            onChange={(value) => updateField("companyName", value)}
          />
          <Field
            disabled={isDrafting}
            label="업종"
            value={form.industry}
            onChange={(value) => updateField("industry", value)}
          />
          <Field
            disabled={isDrafting}
            label="업태"
            value={form.businessType}
            onChange={(value) => updateField("businessType", value)}
          />
          <label className="ref-field">
            <span>주요 사업 내용</span>
            <textarea
              disabled={isDrafting}
              value={form.mainBusinessDescription}
              onChange={(event) => updateField("mainBusinessDescription", event.target.value)}
            />
          </label>
          <Field
            disabled={isDrafting}
            label="연락처"
            value={form.contactPhone}
            onChange={(value) => updateField("contactPhone", value)}
          />
          <Field
            disabled={isDrafting}
            label="이메일"
            value={form.contactEmail}
            onChange={(value) => updateField("contactEmail", value)}
          />
          <label className="ref-field">
            <span>연혁</span>
            <textarea
              disabled={isDrafting}
              value={form.historyItems}
              onChange={(event) => updateField("historyItems", event.target.value)}
            />
            <small>형식: 연도 | 내용</small>
          </label>
          <label className="ref-field">
            <span>포트폴리오</span>
            <textarea
              disabled={isDrafting}
              value={form.portfolioItems}
              onChange={(event) => updateField("portfolioItems", event.target.value)}
            />
            <small>형식: 프로젝트명 | 설명</small>
          </label>
        </div>
      </details>
    </section>
  );
}

function BuilderStep({
  chatInput,
  draft,
  error,
  generateFromDraft,
  generation,
  isGenerating,
  isSending,
  restart,
  sendMessage,
  session,
  setChatInput,
}: {
  chatInput: string;
  draft: Draft;
  error: string | null;
  generateFromDraft: () => void;
  generation: GenerationResponse | null;
  isGenerating: boolean;
  isSending: boolean;
  restart: () => void;
  sendMessage: () => void;
  session: Session | null;
  setChatInput: (value: string) => void;
}) {
  const generated = generation?.ok && generation.job;
  const canSend = Boolean(chatInput.trim()) && !isSending;

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) sendMessage();
    }
  }

  return (
    <section className="builder-workspace" aria-live="polite">
      <header className="make-builder-appbar">
        <div className="make-appbar-left">
          <button className="builder-back-button" onClick={restart} type="button" aria-label="첫 화면으로 돌아가기">
            ‹
          </button>
          <div>
            <strong>{draft.company_name}</strong>
            <span>Goose fixed template draft</span>
          </div>
        </div>
        <div className="make-appbar-center" aria-label="작업 보기">
          <span className="make-appbar-tab make-appbar-tab-active">Preview</span>
          <span className="make-appbar-tab">Template</span>
        </div>
        <div className="make-appbar-right">
          <span className="make-template-badge">
            {draft.homepage_type === "company_intro" ? "회사소개형" : "상품형"}
          </span>
          <button
            className="ref-primary-button"
            disabled={isGenerating || !draft.validation_result.passed}
            onClick={generateFromDraft}
            type="button"
          >
            {isGenerating ? "생성 중..." : "생성"}
          </button>
        </div>
      </header>

      <aside className="builder-chat-panel">
        {error ? <div className="draft-error-banner">{error}</div> : null}
        {isGenerating ? <StatusBanner title="홈페이지 생성 중" text="확정 draft를 request JSON으로 변환하고 검증을 실행합니다." /> : null}
        {!draft.validation_result.passed ? (
          <StatusBanner
            tone="warning"
            title="초안 검증 필요"
            text={draft.validation_result.errors[0] || "초안 검증을 통과해야 생성할 수 있습니다."}
          />
        ) : null}
        {generated ? <GenerationResult job={generation.job} /> : null}

        <div className="builder-panel-body">
          <div className="draft-message-list">
            {(session?.messages || []).map((message, index) => (
              <div className={`draft-message draft-message-${message.role}`} key={`${message.created_at}-${index}`}>
                <strong>{message.role === "user" ? "고객" : "AI"}</strong>
                <p>{message.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="builder-composer">
          <div className="draft-quick-actions">
            {quickActions.map((item) => (
              <button key={item} onClick={() => setChatInput(item)} type="button">
                {item}
              </button>
            ))}
          </div>
          <div className="make-chat-input">
            <textarea
              aria-label="초안 수정 요청"
              placeholder="수정 요청을 입력하세요"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <button aria-label="요청 반영" disabled={!canSend} onClick={sendMessage} type="button">
              {isSending ? "..." : "↑"}
            </button>
          </div>
        </div>
      </aside>

      <section className="builder-preview-panel">
        <div className="builder-preview-frame">
          <DraftPreview draft={draft} />
        </div>
      </section>
    </section>
  );
}

function StatusBanner({
  text,
  title,
  tone = "info",
}: {
  text: string;
  title: string;
  tone?: "info" | "warning";
}) {
  return (
    <div className={`builder-status-banner builder-status-${tone}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function GenerationResult({ job }: { job: GenerationJob }) {
  return (
    <div className="builder-result-card">
      <div>
        <strong>홈페이지 생성 완료</strong>
        <p>validation/build를 통과했습니다.</p>
      </div>
      <dl>
        <div>
          <dt>status</dt>
          <dd>{job.status}</dd>
        </div>
        <div>
          <dt>company_id</dt>
          <dd>{job.company_id}</dd>
        </div>
      </dl>
      <Link className="ref-primary-button ref-result-link" href={job.homepage_url}>
        생성된 홈페이지 보기
      </Link>
    </div>
  );
}

function DraftPreview({ draft }: { draft: Draft }) {
  const visible = draft.section_visibility || {};
  const layout = draft.section_layout || {};
  const contactEntries = Object.entries(draft.contact || {}).filter(([, value]) => Boolean(value));
  const tags = [...(draft.tags || []), draft.business_type].filter(Boolean);
  const strengthClassName =
    layout.core_strengths === "list" ? "draft-strength-list draft-strength-list-single" : "draft-strength-list";
  const historyClassName =
    layout.history === "compact" ? "draft-timeline draft-timeline-compact" : "draft-timeline";
  const portfolioClassName =
    layout.portfolio === "list" ? "draft-card-grid draft-card-list" : "draft-card-grid";

  return (
    <article className="draft-preview" data-content-density={draft.content_density}>
      <header className="draft-preview-nav">
        <span className="draft-preview-logo">H</span>
        <nav>
          <span>기업</span>
          <span>문의</span>
        </nav>
      </header>

      <section className="draft-cover" data-section="hero" />

      {visible.company_summary !== false ? (
        <section className="draft-summary" data-section="company_summary">
          <p className="eyebrow">{draft.industry}</p>
          <h1>{draft.company_name}</h1>
          <p>{draft.one_line_intro}</p>
          <div className="tag-row">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>
      ) : null}

      {contactEntries.length > 0 && visible.contact_info ? (
        <section className="draft-section" data-section="contact_info">
          <h2>기업 정보</h2>
          <dl className="draft-meta-list">
            {contactEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{contactLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="draft-section" data-section="company_intro">
        <h2>기업 소개</h2>
        <p>{draft.company_intro}</p>
      </section>

      <section className="draft-section" data-section="core_strengths">
        <h2>핵심 강점</h2>
        <ul className={strengthClassName}>
          {draft.core_strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {draft.history.length > 0 && visible.history ? (
        <section className="draft-section" data-section="history">
          <h2>연혁</h2>
          <ol className={historyClassName}>
            {draft.history.map((item) => (
              <li key={`${item.year}-${item.text}`}>
                <strong>{item.year}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {draft.portfolio.length > 0 && visible.portfolio ? (
        <section className="draft-section" data-section="portfolio">
          <h2>포트폴리오</h2>
          <div className={portfolioClassName}>
            {draft.portfolio.map((item) => (
              <article key={item.title || item.description}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="draft-contact" data-section="contact_cta">
        <h2>문의하기</h2>
        <p>{draft.company_name}의 사업과 서비스가 궁금하시다면 문의해 주세요.</p>
      </section>
    </article>
  );
}

function Field({
  disabled = false,
  helper,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="ref-field">
      <span>{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function buildDraftPayload(form: BuilderForm) {
  return {
    draft_mode: "auto",
    homepage_type: form.homepageType,
    initial_prompt: form.initialPrompt,
    company_name: form.companyName,
    industry: form.industry,
    business_type: form.businessType,
    main_business_description: form.mainBusinessDescription,
    contact: {
      phone: form.contactPhone,
      email: form.contactEmail,
    },
    history: parseHistory(form.historyItems),
    portfolio: parsePortfolio(form.portfolioItems),
  };
}

function parseHistory(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [year = "", ...textParts] = line.split("|").map((part) => part.trim());
      return { year, text: textParts.join(" | ") };
    })
    .filter((item) => item.year && item.text);
}

function parsePortfolio(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", ...descriptionParts] = line.split("|").map((part) => part.trim());
      return { title, description: descriptionParts.join(" | ") };
    })
    .filter((item) => item.title || item.description);
}

function contactLabel(key: string) {
  return (
    {
      address: "주소",
      phone: "전화",
      email: "이메일",
      website_url: "웹사이트",
    }[key] || key
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();
  const htmlError = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html");
  throw new Error(
    htmlError
      ? "서버가 JSON 대신 HTML 오류 페이지를 반환했습니다. 개발 서버를 새로고침한 뒤 다시 시도해 주세요."
      : text.slice(0, 240) || "서버 응답을 JSON으로 읽을 수 없습니다.",
  );
}
