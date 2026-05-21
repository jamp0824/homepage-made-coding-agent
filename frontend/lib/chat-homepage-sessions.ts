import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ChatSessionStatus =
  | "empty"
  | "collecting"
  | "draft_ready"
  | "previewing"
  | "generating"
  | "generated"
  | "manual_required"
  | "failed";
export type ChatActionType =
  | "ask_missing_info"
  | "patch_request"
  | "patch_draft"
  | "toggle_section"
  | "run_generation"
  | "show_preview";
export type HomepageType = "company_intro" | "product";
export type ContentDensity = "compact" | "standard" | "rich";
export type GenerationMode = "local" | "auto" | "required";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  action?: ChatAction;
  created_at: string;
};

export type ChatHomepageRequest = {
  request_id?: string;
  company_id?: string;
  homepage_type?: HomepageType;
  company_name?: string;
  industry?: string;
  business_type?: string;
  main_business_description?: string;
  tags?: string[];
  contact?: Record<string, string>;
  products?: Array<{ name: string; description?: string; image_url?: string }>;
  history?: Array<{ year: string; text: string }>;
  portfolio?: Array<{ title?: string; description?: string }>;
};

export type ContentDraft = {
  hero_title?: string;
  one_line_intro?: string;
  company_intro?: string;
  business_summary?: string;
  core_strengths?: string[];
  tags?: string[];
  section_visibility?: Record<string, boolean>;
  section_layout?: Record<string, string>;
  content_density?: ContentDensity;
  hero_image_theme?: string;
  hero_image_keywords?: string[];
  cta_text?: string;
};

export type ChatAction = {
  type: ChatActionType;
  assistant_message: string;
  request_patch?: Partial<ChatHomepageRequest>;
  content_draft_patch?: ContentDraft;
  warnings?: string[];
};

export type ChatGenerationJob = {
  job_id: string;
  request_id: string;
  company_id: string;
  status: "generating" | "generated" | "published" | "manual_required" | "failed";
  request_path: string;
  generated_path: string;
  homepage_url: string;
  generation_mode: GenerationMode;
  exit_code: number | null;
  result?: unknown;
  created_at: string;
  updated_at: string;
};

export type ChatHomepageSession = {
  session_id: string;
  status: ChatSessionStatus;
  messages: ChatMessage[];
  homepage_request: ChatHomepageRequest;
  content_draft: ContentDraft;
  last_assistant_message: string;
  generation_job?: ChatGenerationJob;
  created_at: string;
  updated_at: string;
};

const sessionsRoot = path.join(process.cwd(), "harness", "tmp", "chat-sessions");
const requestRoot = path.join(process.cwd(), "harness", "tmp", "chat-session-requests");
const sessionIdPattern = /^[A-Za-z0-9_-]+$/;
const requiredRequestFields = [
  "company_name",
  "industry",
  "business_type",
  "main_business_description",
] as const;
const forbiddenPhrases = [
  "업계 1위",
  "국내 최고",
  "압도적",
  "인증받은",
  "수상 경력",
  "다수의 고객사",
  "10년 이상",
  "풍부한 연혁",
  "매출",
  "납품 실적",
  "특허",
];
const requiredVisibleSections = new Set(["company_intro", "core_strengths", "contact_cta"]);
const allowedVisibilitySections = new Set([
  "company_summary",
  "contact_info",
  "company_intro",
  "core_strengths",
  "history",
  "portfolio",
  "featured_products",
  "product_area",
  "product_registration_cta",
  "contact_cta",
]);
const allowedLayouts: Record<string, Set<string>> = {
  core_strengths: new Set(["list", "grid_2"]),
  history: new Set(["timeline", "compact"]),
  portfolio: new Set(["list", "grid_2"]),
  featured_products: new Set(["grid_2", "grid_3"]),
  product_area: new Set(["grid_2", "grid_3"]),
};
const allowedDensities = new Set<ContentDensity>(["compact", "standard", "rich"]);

export function createChatHomepageSession(payload: unknown = {}) {
  const now = new Date().toISOString();
  const sessionId = buildSessionId();
  const requestPatch = normalizeRequestPatch(payload);
  const homepageRequest: ChatHomepageRequest = {
    homepage_type: "company_intro",
    ...requestPatch,
  };
  const contentDraft = Object.keys(requestPatch).length > 0 ? deriveContentDraft(homepageRequest, {}) : {};
  const session: ChatHomepageSession = {
    session_id: sessionId,
    status: Object.keys(requestPatch).length > 0 ? resolveSessionStatus(homepageRequest, contentDraft) : "empty",
    messages: [],
    homepage_request: homepageRequest,
    content_draft: contentDraft,
    last_assistant_message: "",
    created_at: now,
    updated_at: now,
  };
  writeSession(session);
  return session;
}

export function readChatHomepageSession(sessionId: string) {
  assertSessionId(sessionId);
  const sessionPath = getSessionPath(sessionId);
  if (!fs.existsSync(sessionPath)) return null;
  return JSON.parse(fs.readFileSync(sessionPath, "utf8")) as ChatHomepageSession;
}

export function applyChatHomepageMessage(sessionId: string, message: string) {
  const session = readChatHomepageSession(sessionId);
  if (!session) return null;

  const now = new Date().toISOString();
  const trimmedMessage = cleanText(message);
  const parsed = parseMessageIntent(session, trimmedMessage);
  const nextRequest = mergeHomepageRequest(session.homepage_request, parsed.requestPatch);
  const inferredDraft = parsed.blocked
    ? session.content_draft
    : deriveContentDraft(nextRequest, session.content_draft, trimmedMessage);
  const nextDraft = parsed.blocked
    ? session.content_draft
    : mergeContentDraft(inferredDraft, parsed.contentDraftPatch);
  const draftValidation = validateContentDraft(nextDraft, nextRequest);
  const requestDiff = diffObject(session.homepage_request, nextRequest) as Partial<ChatHomepageRequest>;
  const draftDiff = diffObject(session.content_draft, nextDraft) as ContentDraft;
  const warnings = [...parsed.warnings, ...draftValidation.warnings];
  const actionType = resolveActionType({ parsed, requestDiff, draftDiff });
  const assistantMessage = buildAssistantMessage({
    actionType,
    parsed,
    nextRequest,
    draftValidation,
    requestDiff,
    draftDiff,
  });
  const action: ChatAction = removeUndefined({
    type: actionType,
    assistant_message: assistantMessage,
    request_patch: Object.keys(requestDiff).length > 0 ? requestDiff : undefined,
    content_draft_patch: Object.keys(draftDiff).length > 0 ? draftDiff : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  });

  const nextSession: ChatHomepageSession = {
    ...session,
    status: resolveSessionStatus(nextRequest, nextDraft),
    messages: [
      ...session.messages,
      { role: "user", content: trimmedMessage, created_at: now },
      { role: "assistant", content: assistantMessage, action, created_at: now },
    ],
    homepage_request: nextRequest,
    content_draft: nextDraft,
    last_assistant_message: assistantMessage,
    updated_at: now,
  };
  writeSession(nextSession);
  return { session: nextSession, action, preview_state: buildPreviewState(nextSession) };
}

export function generateChatHomepageSession(sessionId: string, generationMode: unknown = "local") {
  const session = readChatHomepageSession(sessionId);
  if (!session) return null;

  const generationModeValue = normalizeGenerationMode(generationMode);
  const requestBody = buildConfirmedRequest(session);
  const missing = validateConfirmedRequestBody(requestBody);
  if (missing.length > 0) {
    const failed = {
      ...session,
      status: "failed" as ChatSessionStatus,
      last_assistant_message: `생성에 필요한 정보가 부족합니다: ${missing.join(", ")}`,
      updated_at: new Date().toISOString(),
    };
    writeSession(failed);
    throw new Error(failed.last_assistant_message);
  }

  const jobId = `CHAT_JOB_${Date.now()}`;
  const requestPath = writeConfirmedRequest(jobId, requestBody);
  const validation = spawnSync("node", ["scripts/validate-request.mjs", requestPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (validation.status !== 0) {
    const failed = {
      ...session,
      status: "failed" as ChatSessionStatus,
      last_assistant_message: `request validation failed: ${scrubLog(validation.stderr || validation.stdout)}`,
      updated_at: new Date().toISOString(),
    };
    writeSession(failed);
    throw new Error(failed.last_assistant_message);
  }

  const now = new Date().toISOString();
  const runningJob: ChatGenerationJob = {
    job_id: jobId,
    request_id: requestBody.request_id,
    company_id: requestBody.company_id,
    status: "generating",
    request_path: requestPath,
    generated_path: path.join("generated-sites", requestBody.company_id),
    homepage_url: `/homepage/${requestBody.company_id}`,
    generation_mode: generationModeValue,
    exit_code: null,
    created_at: now,
    updated_at: now,
  };
  writeSession({
    ...session,
    status: "generating",
    generation_job: runningJob,
    last_assistant_message: "확정된 구조화 request로 홈페이지 생성을 시작합니다.",
    updated_at: now,
  });

  const result = spawnSync("bash", ["scripts/run-homepage-builder.sh", requestPath], {
    cwd: process.cwd(),
    env: {
      ...buildChildEnv(),
      GOOSE_MODE: generationModeValue,
      MAX_RETRY: generationModeValue === "required" ? "3" : "1",
      NEXT_BUILD_TIMEOUT_MS: "120000",
    },
    encoding: "utf8",
    timeout: 1000 * 60 * 6,
  });
  const generationResult = readGenerationResult(requestBody.company_id);
  const finalStatus = normalizeFinalSessionStatus(generationResult, result.status);
  const completedJob: ChatGenerationJob = {
    ...runningJob,
    status:
      finalStatus === "generated" || finalStatus === "manual_required"
        ? finalStatus
        : generationResult?.status === "published"
          ? "published"
          : "failed",
    exit_code: result.status,
    result: generationResult,
    updated_at: new Date().toISOString(),
  };
  const completedSession: ChatHomepageSession = {
    ...readChatHomepageSession(sessionId)!,
    status: finalStatus,
    generation_job: completedJob,
    last_assistant_message:
      finalStatus === "generated"
        ? "홈페이지 생성과 validation/build가 완료되었습니다."
        : finalStatus === "manual_required"
          ? "자동 생성이 실패하여 manual_required로 전환되었습니다."
          : "홈페이지 생성이 실패했습니다.",
    updated_at: new Date().toISOString(),
  };
  writeSession(completedSession);

  return {
    session: completedSession,
    request: requestBody,
    job: completedJob,
    stdout: scrubLog(result.stdout || ""),
    stderr: scrubLog(result.stderr || ""),
  };
}

export function buildPreviewState(session: ChatHomepageSession) {
  return {
    preview_state:
      session.status === "empty" || session.status === "collecting" ? session.status : "draft_ready",
    template_id: session.homepage_request.homepage_type === "product" ? "product_basic" : "company_intro_basic",
    template_variant: session.homepage_request.homepage_type === "product" ? "basic" : "result_style_v1",
    homepage_request: session.homepage_request,
    content_draft: session.content_draft,
  };
}

function parseMessageIntent(session: ChatHomepageSession, message: string) {
  const requestPatch: Partial<ChatHomepageRequest> = {};
  const contentDraftPatch: ContentDraft = {};
  const warnings: string[] = [];
  const blockedPhrase = forbiddenPhrases.find((phrase) => message.includes(phrase));

  if (blockedPhrase || /인증|수상|고객사|매출|특허|1위|납품/.test(message)) {
    return {
      blocked: true,
      requestPatch,
      contentDraftPatch,
      warnings: ["unsupported_claim_request_blocked"],
    };
  }

  const companyName = extractFieldChange(message, ["회사\\s*이름", "회사명", "상호"]);
  if (companyName) requestPatch.company_name = companyName;

  const industry = extractFieldChange(message, ["업종"]);
  if (industry) requestPatch.industry = industry;

  const businessType = extractFieldChange(message, ["업태", "사업\\s*유형", "사업\\s*분야"]);
  if (businessType) requestPatch.business_type = businessType;

  const businessDescription = extractFieldChange(message, ["주요\\s*사업\\s*내용", "사업\\s*내용", "설명"]);
  if (businessDescription) requestPatch.main_business_description = businessDescription;

  if (!session.homepage_request.homepage_type) requestPatch.homepage_type = "company_intro";
  if (message.includes("상품중심형")) requestPatch.homepage_type = "product";
  if (message.includes("회사소개") || message.includes("회사 소개")) requestPatch.homepage_type = "company_intro";

  if (!businessDescription && !businessType && isInitialBusinessPrompt(session, message)) {
    Object.assign(requestPatch, inferBusinessRequestPatch(message));
  }

  if (
    requestPatch.company_name ||
    requestPatch.industry ||
    requestPatch.business_type ||
    requestPatch.main_business_description
  ) {
    const nextRequest = mergeHomepageRequest(session.homepage_request, requestPatch);
    contentDraftPatch.hero_title = nextRequest.business_type || nextRequest.company_name || "홈페이지 초안";
    contentDraftPatch.one_line_intro = buildOneLineIntro(
      nextRequest,
      nextRequest.main_business_description || message,
    );
    contentDraftPatch.company_intro = buildCompanyIntro(nextRequest);
    contentDraftPatch.business_summary = buildBusinessSummary(nextRequest);
    contentDraftPatch.cta_text = `${nextRequest.company_name || "해당 기업"}의 사업과 서비스가 궁금하시다면 문의해 주세요.`;
  }

  if (/풍부|자세|강조|전문|rich/.test(message)) {
    contentDraftPatch.content_density = "rich";
    contentDraftPatch.core_strengths = enrichStrengths(session.homepage_request, session.content_draft);
  }
  if (/간결|짧|compact/.test(message)) contentDraftPatch.content_density = "compact";
  if (/보통|기본|standard/.test(message)) contentDraftPatch.content_density = "standard";
  if (/신뢰|전문/.test(message)) {
    contentDraftPatch.company_intro = buildCompanyIntro(
      mergeHomepageRequest(session.homepage_request, requestPatch),
      "professional_trust",
    );
  }

  const sectionLayout: Record<string, string> = {};
  if (/카드|그리드|grid|2열/.test(message)) {
    if (/포트폴리오/.test(message)) sectionLayout.portfolio = "grid_2";
    else if (/상품/.test(message)) sectionLayout.product_area = "grid_2";
    else sectionLayout.core_strengths = "grid_2";
  }
  if (/리스트|목록/.test(message)) {
    if (/포트폴리오/.test(message)) sectionLayout.portfolio = "list";
    else sectionLayout.core_strengths = "list";
  }
  if (/연혁/.test(message) && /간단|compact|작게/.test(message)) sectionLayout.history = "compact";
  if (/연혁/.test(message) && /타임라인|timeline/.test(message)) sectionLayout.history = "timeline";
  if (Object.keys(sectionLayout).length > 0) contentDraftPatch.section_layout = sectionLayout;

  const sectionVisibility = buildVisibilityPatch(session, message, warnings);
  if (Object.keys(sectionVisibility).length > 0) contentDraftPatch.section_visibility = sectionVisibility;

  return { blocked: false, requestPatch, contentDraftPatch, warnings };
}

function isInitialBusinessPrompt(session: ChatHomepageSession, message: string) {
  if (session.messages.length > 0) return false;
  return /홈페이지|랜딩|사이트|초안|만들/.test(message);
}

function inferBusinessRequestPatch(message: string): Partial<ChatHomepageRequest> {
  const patch: Partial<ChatHomepageRequest> = { homepage_type: "company_intro" };
  if (/재고|입출고|발주/.test(message)) {
    patch.industry = "IT·소프트웨어";
    patch.business_type = /AI|인공지능/i.test(message)
      ? "AI 기반 재고관리 솔루션"
      : "재고관리 솔루션";
    patch.main_business_description =
      "중소기업의 입출고와 발주 업무를 돕는 AI 기반 재고관리 솔루션입니다.";
    return patch;
  }
  if (/헬스케어|건강|의료/.test(message)) {
    patch.industry = "헬스케어";
    patch.business_type = "헬스케어 서비스";
    patch.main_business_description = message;
    return patch;
  }
  if (/제조|공장|생산/.test(message)) {
    patch.industry = "제조";
    patch.business_type = "제조 서비스";
    patch.main_business_description = message;
    return patch;
  }
  patch.main_business_description = message;
  return patch;
}

function deriveContentDraft(
  request: ChatHomepageRequest,
  currentDraft: ContentDraft,
  message = "",
): ContentDraft {
  const companyName = request.company_name || currentDraft.hero_title || "";
  const businessType = request.business_type || "";
  const description = request.main_business_description || message || "";
  const heroTitle = currentDraft.hero_title || businessType || companyName || "홈페이지 초안";
  const oneLineIntro = currentDraft.one_line_intro || buildOneLineIntro(request, description);
  const companyIntro = buildCompanyIntro(request);
  const strengths =
    currentDraft.core_strengths && currentDraft.core_strengths.length > 0
      ? currentDraft.core_strengths
      : deriveCoreStrengths(request, description);
  const tags = normalizeStringArray(currentDraft.tags).length > 0 ? currentDraft.tags : buildTags(request);
  const defaultLayout: Record<string, string> =
    request.homepage_type === "product"
      ? {
          core_strengths: "list",
          product_area: "grid_2",
        }
      : {
          core_strengths: "list",
          history: "timeline",
          portfolio: "list",
          featured_products: "grid_2",
        };

  return {
    hero_title: heroTitle,
    one_line_intro: oneLineIntro,
    company_intro: currentDraft.company_intro || companyIntro,
    business_summary: currentDraft.business_summary || buildBusinessSummary(request),
    core_strengths: strengths,
    tags,
    section_visibility: {
      company_summary: true,
      company_intro: true,
      core_strengths: true,
      contact_cta: true,
      history: hasItems(request.history),
      portfolio: hasItems(request.portfolio),
      featured_products: hasItems(request.products),
      ...(currentDraft.section_visibility || {}),
    },
    section_layout: {
      ...defaultLayout,
      ...(currentDraft.section_layout || {}),
    },
    content_density: currentDraft.content_density || "standard",
    hero_image_theme: currentDraft.hero_image_theme || inferHeroImageTheme(request),
    hero_image_keywords:
      currentDraft.hero_image_keywords && currentDraft.hero_image_keywords.length > 0
        ? currentDraft.hero_image_keywords
        : buildHeroImageKeywords(request),
    cta_text:
      currentDraft.cta_text ||
      `${companyName || "해당 기업"}의 사업과 서비스가 궁금하시다면 문의해 주세요.`,
  };
}

function buildOneLineIntro(request: ChatHomepageRequest, fallback = "") {
  if (/재고|입출고|발주/.test(`${request.business_type || ""} ${fallback}`)) {
    return "중소기업의 재고 운영을 돕는 업무 자동화 서비스";
  }
  return cleanText(fallback || request.main_business_description || request.business_type || "회사 소개 홈페이지 초안");
}

function buildCompanyIntro(request: ChatHomepageRequest, tone: "standard" | "professional_trust" = "standard") {
  const companyName = request.company_name || "해당 기업";
  const description = request.main_business_description || request.business_type || "입력된 사업 내용을 바탕으로 서비스를 소개합니다.";
  if (tone === "professional_trust") {
    return `${companyName}는 ${description} 고객이 사업 내용을 명확하게 이해할 수 있도록 전문적인 소개와 핵심 강점을 중심으로 구성합니다.`;
  }
  return `${companyName}는 ${description}`;
}

function buildBusinessSummary(request: ChatHomepageRequest) {
  if (request.industry && request.business_type) {
    return `${request.industry} 분야에서 ${request.business_type}을 중심으로 사업을 소개합니다.`;
  }
  return request.main_business_description || "";
}

function deriveCoreStrengths(request: ChatHomepageRequest, fallback = "") {
  const source = `${request.business_type || ""} ${request.main_business_description || ""} ${fallback}`;
  if (/재고|입출고|발주/.test(source)) {
    return ["AI 기반 재고 관리", "입출고 업무 효율화", "발주 업무 자동화"];
  }
  if (/헬스케어|건강|의료/.test(source)) {
    return ["서비스 이해도 중심 소개", "고객 신뢰를 고려한 문구", "문의 전환을 돕는 구성"];
  }
  return ["사업 내용을 한눈에 전달", "핵심 서비스 중심 구성", "문의로 이어지는 정보 흐름"];
}

function enrichStrengths(request: ChatHomepageRequest, draft: ContentDraft) {
  const base = draft.core_strengths && draft.core_strengths.length > 0 ? draft.core_strengths : deriveCoreStrengths(request);
  const additions = /재고|입출고|발주/.test(`${request.business_type || ""} ${request.main_business_description || ""}`)
    ? ["업무 흐름 통합 관리", "데이터 기반 현황 파악"]
    : ["정보 구조 명확화", "고객 문의 동선 강화"];
  return Array.from(new Set([...base, ...additions])).slice(0, 5);
}

function buildTags(request: ChatHomepageRequest) {
  return Array.from(
    new Set(
      [request.industry, request.business_type]
        .flatMap((item) => String(item || "").split(/[,\s/]+/))
        .map(cleanText)
        .filter((item) => item.length > 1),
    ),
  ).slice(0, 6);
}

function inferHeroImageTheme(request: ChatHomepageRequest) {
  const source = `${request.industry || ""} ${request.business_type || ""}`;
  if (/소프트웨어|AI|솔루션|재고/.test(source)) return "software_dashboard";
  if (/헬스케어|건강|의료/.test(source)) return "healthcare_trust";
  if (/제조|공장|생산/.test(source)) return "manufacturing_process";
  return "business_general";
}

function buildHeroImageKeywords(request: ChatHomepageRequest) {
  const theme = inferHeroImageTheme(request);
  if (theme === "software_dashboard") return ["소프트웨어", "대시보드", "업무 자동화"];
  if (theme === "healthcare_trust") return ["헬스케어", "신뢰", "건강 관리"];
  if (theme === "manufacturing_process") return ["제조", "생산", "프로세스"];
  return ["비즈니스", "회사 소개"];
}

function buildVisibilityPatch(session: ChatHomepageSession, message: string, warnings: string[]) {
  const hide = /숨|감춰|빼|제외|삭제/.test(message);
  const show = /보여|표시|추가|살려/.test(message);
  const section = inferSectionFromMessage(message);
  const patch: Record<string, boolean> = {};
  if (!section || (!hide && !show)) return patch;
  if (requiredVisibleSections.has(section) && hide) {
    warnings.push(`${section}_cannot_be_hidden`);
    return patch;
  }
  if (show && !sectionHasData(section, session.homepage_request)) {
    warnings.push(`${section}_has_no_data`);
    return patch;
  }
  patch[section] = show || !hide;
  return patch;
}

function inferSectionFromMessage(message: string) {
  if (/연락|문의|기업 정보/.test(message)) return "contact_info";
  if (/연혁/.test(message)) return "history";
  if (/포트폴리오/.test(message)) return "portfolio";
  if (/상품/.test(message)) return "featured_products";
  if (/핵심|강점/.test(message)) return "core_strengths";
  if (/소개/.test(message)) return "company_intro";
  return "";
}

function sectionHasData(section: string, request: ChatHomepageRequest) {
  if (section === "history") return hasItems(request.history);
  if (section === "portfolio") return hasItems(request.portfolio);
  if (section === "featured_products" || section === "product_area") return hasItems(request.products);
  if (section === "contact_info") return Boolean(request.contact && Object.values(request.contact).some(Boolean));
  return true;
}

function validateContentDraft(draft: ContentDraft, request: ChatHomepageRequest) {
  const warnings: string[] = [];
  const visibility = draft.section_visibility || {};
  const layout = draft.section_layout || {};
  for (const [section, visible] of Object.entries(visibility)) {
    if (!allowedVisibilitySections.has(section)) warnings.push(`unsupported_section_visibility:${section}`);
    if (requiredVisibleSections.has(section) && visible === false) warnings.push(`${section}_cannot_be_hidden`);
    if (visible === true && !sectionHasData(section, request) && !requiredVisibleSections.has(section)) {
      warnings.push(`${section}_has_no_data`);
    }
  }
  for (const [section, value] of Object.entries(layout)) {
    const allowed = allowedLayouts[section];
    if (!allowed || !allowed.has(value)) warnings.push(`unsupported_section_layout:${section}.${value}`);
  }
  if (draft.content_density && !allowedDensities.has(draft.content_density)) {
    warnings.push(`unsupported_content_density:${draft.content_density}`);
  }
  return { warnings };
}

function buildAssistantMessage({
  actionType,
  parsed,
  nextRequest,
  draftValidation,
  requestDiff,
  draftDiff,
}: {
  actionType: ChatActionType;
  parsed: ReturnType<typeof parseMessageIntent>;
  nextRequest: ChatHomepageRequest;
  draftValidation: { warnings: string[] };
  requestDiff: Partial<ChatHomepageRequest>;
  draftDiff: ContentDraft;
}) {
  if (parsed.blocked) {
    return "입력에 없는 인증, 수상, 고객사, 매출, 특허, 순위 정보는 추가할 수 없습니다. 해당 사실이 있다면 근거가 되는 항목을 먼저 입력해 주세요.";
  }
  if (draftValidation.warnings.some((warning) => warning.endsWith("_cannot_be_hidden"))) {
    return "필수 섹션은 숨길 수 없습니다. 고정 템플릿 안에서 문구나 표시 방식만 조정할 수 있습니다.";
  }
  if (draftValidation.warnings.some((warning) => warning.endsWith("_has_no_data"))) {
    return "해당 섹션에 표시할 입력 데이터가 없어 섹션을 추가하지 않았습니다.";
  }
  const missing = getMissingRequestFields(nextRequest);
  if (Object.keys(requestDiff).length > 0 || Object.keys(draftDiff).length > 0) {
    if (missing.length > 0) {
      return `고정 템플릿 기준으로 초안을 구성했습니다. 생성까지 진행하려면 ${missing.join(", ")} 정보를 더 입력해 주세요.`;
    }
    return "요청을 구조화된 request/draft 상태로 반영했습니다. 고정 템플릿 preview에 사용할 수 있습니다.";
  }
  if (actionType === "ask_missing_info") {
    return `생성에 필요한 정보가 부족합니다. ${missing.join(", ")} 정보를 입력해 주세요.`;
  }
  return "수정할 수 있는 템플릿 슬롯을 찾지 못했습니다. 회사명, 문구, 섹션 표시/숨김, 카드형/리스트형, 풍부하게/간결하게처럼 요청해 주세요.";
}

function resolveActionType({
  parsed,
  requestDiff,
  draftDiff,
}: {
  parsed: ReturnType<typeof parseMessageIntent>;
  requestDiff: Partial<ChatHomepageRequest>;
  draftDiff: ContentDraft;
}): ChatActionType {
  if (parsed.blocked) return "ask_missing_info";
  if (Object.keys(parsed.contentDraftPatch.section_visibility || {}).length > 0) return "toggle_section";
  if (Object.keys(draftDiff).length > 0) return "patch_draft";
  if (Object.keys(requestDiff).length > 0) return "patch_request";
  return "ask_missing_info";
}

function buildConfirmedRequest(session: ChatHomepageSession) {
  const request = session.homepage_request;
  const draft = normalizeDraftForHomepageType(session.content_draft, request.homepage_type || "company_intro");
  const requestId = request.request_id || `REQ_${session.session_id}`;
  const companyId = request.company_id || buildCompanyId(session);
  const contentDraft = removeEmptyDraft(draft);
  return removeEmptyFields({
    request_id: requestId,
    company_id: companyId,
    homepage_type: request.homepage_type || "company_intro",
    company_name: request.company_name,
    industry: request.industry,
    business_type: request.business_type,
    main_business_description: request.main_business_description,
    one_line_intro: draft.one_line_intro,
    company_intro: draft.company_intro,
    tags: draft.tags,
    contact: request.contact,
    core_strengths: draft.core_strengths,
    products: request.products,
    portfolio: request.portfolio,
    history: request.history,
    section_visibility: draft.section_visibility,
    section_layout: draft.section_layout,
    content_density: draft.content_density || "standard",
    content_source: "ai_suggested_user_confirmed",
    content_draft: contentDraft,
    preferred_style: "clean",
    created_at: new Date().toISOString(),
  }) as {
    request_id: string;
    company_id: string;
    homepage_type: HomepageType;
    company_name: string;
    industry: string;
    business_type: string;
    main_business_description: string;
    [key: string]: unknown;
  };
}

function normalizeDraftForHomepageType(draft: ContentDraft, homepageType: HomepageType) {
  const allowedLayoutSections =
    homepageType === "product"
      ? new Set(["core_strengths", "product_area"])
      : new Set(["core_strengths", "history", "portfolio", "featured_products"]);
  const allowedVisibility =
    homepageType === "product"
      ? new Set(["company_intro", "core_strengths", "product_area", "product_registration_cta", "contact_cta"])
      : new Set([
          "company_summary",
          "contact_info",
          "company_intro",
          "core_strengths",
          "history",
          "portfolio",
          "featured_products",
          "contact_cta",
        ]);
  return {
    ...draft,
    section_layout: Object.fromEntries(
      Object.entries(draft.section_layout || {}).filter(([section]) => allowedLayoutSections.has(section)),
    ),
    section_visibility: Object.fromEntries(
      Object.entries(draft.section_visibility || {}).filter(([section]) => allowedVisibility.has(section)),
    ),
  };
}

function validateConfirmedRequestBody(requestBody: Record<string, unknown>) {
  const missing: string[] = [];
  for (const field of [
    "company_name",
    "industry",
    "business_type",
    "main_business_description",
  ]) {
    if (typeof requestBody[field] !== "string" || String(requestBody[field]).trim() === "") {
      missing.push(field);
    }
  }
  if (
    typeof requestBody.main_business_description === "string" &&
    requestBody.main_business_description.trim().length < 10
  ) {
    missing.push("main_business_description");
  }
  return Array.from(new Set(missing));
}

function writeConfirmedRequest(jobId: string, requestBody: Record<string, unknown>) {
  fs.mkdirSync(requestRoot, { recursive: true });
  const requestPath = path.join(requestRoot, `${jobId}.json`);
  fs.writeFileSync(requestPath, JSON.stringify(requestBody, null, 2));
  return requestPath;
}

function readGenerationResult(companyId: string) {
  const resultPath = path.join(process.cwd(), "generated-sites", companyId, "generation-result.json");
  try {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeFinalSessionStatus(generationResult: any, exitCode: number | null): ChatSessionStatus {
  if (generationResult?.status === "generated" || generationResult?.status === "published") return "generated";
  if (generationResult?.status === "manual_required") return "manual_required";
  return exitCode === 0 ? "generated" : "failed";
}

function resolveSessionStatus(request: ChatHomepageRequest, draft: ContentDraft): ChatSessionStatus {
  if (!draft.hero_title && !draft.one_line_intro && !request.main_business_description) return "empty";
  return getMissingRequestFields(request).length > 0 ? "collecting" : "draft_ready";
}

function getMissingRequestFields(request: ChatHomepageRequest) {
  return requiredRequestFields.filter((field) => !request[field]);
}

function normalizeRequestPatch(payload: unknown): Partial<ChatHomepageRequest> {
  const source =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? "homepage_request" in payload &&
        (payload as { homepage_request?: unknown }).homepage_request &&
        typeof (payload as { homepage_request?: unknown }).homepage_request === "object"
        ? ((payload as { homepage_request: Record<string, unknown> }).homepage_request)
        : (payload as Record<string, unknown>)
      : {};
  const patch: Partial<ChatHomepageRequest> = {};
  if (source.homepage_type === "company_intro" || source.homepage_type === "product") patch.homepage_type = source.homepage_type;
  if (typeof source.company_name === "string") patch.company_name = cleanText(source.company_name);
  if (typeof source.industry === "string") patch.industry = cleanText(source.industry);
  if (typeof source.business_type === "string") patch.business_type = cleanText(source.business_type);
  if (typeof source.main_business_description === "string") {
    patch.main_business_description = cleanText(source.main_business_description);
  }
  if (typeof source.request_id === "string") patch.request_id = cleanText(source.request_id);
  if (typeof source.company_id === "string") patch.company_id = cleanText(source.company_id);
  if (Array.isArray(source.tags)) patch.tags = normalizeStringArray(source.tags);
  if (source.contact && typeof source.contact === "object" && !Array.isArray(source.contact)) {
    patch.contact = normalizeStringRecord(source.contact as Record<string, unknown>);
  }
  return removeUndefined(patch);
}

function mergeHomepageRequest(base: ChatHomepageRequest, patch: Partial<ChatHomepageRequest>) {
  const merged = removeUndefined({
    ...base,
    ...patch,
  }) as ChatHomepageRequest;
  const contact = {
    ...(base.contact || {}),
    ...(patch.contact || {}),
  };
  if (Object.keys(contact).length > 0) merged.contact = contact;
  return merged;
}

function mergeContentDraft(base: ContentDraft, patch: ContentDraft) {
  return removeUndefined({
    ...base,
    ...patch,
    section_visibility: {
      ...(base.section_visibility || {}),
      ...(patch.section_visibility || {}),
    },
    section_layout: {
      ...(base.section_layout || {}),
      ...(patch.section_layout || {}),
    },
  }) as ContentDraft;
}

function diffObject(before: Record<string, unknown>, after: Record<string, unknown>) {
  const diff: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) diff[key] = value;
  }
  return diff;
}

function extractFieldChange(message: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(?:은|는|을|를|:)?\\s*(.+?)(?:으로|로)?\\s*(?:바꿔|변경|수정|설정|입력|해줘|해주세요|$)`);
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const candidate = match[1].split(/아니라|말고/).pop() || "";
    return cleanText(candidate.replace(/(으로|로)$/u, ""));
  }
  return "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(String(item))).filter(Boolean);
}

function normalizeStringRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === "string")
      .map(([key, item]) => [key, cleanText(String(item))])
      .filter(([, item]) => Boolean(item)),
  );
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function hasItems(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function buildCompanyId(session: ChatHomepageSession) {
  const existing = cleanText(session.homepage_request.company_id);
  if (existing && /^[A-Za-z0-9_-]+$/.test(existing)) return existing;
  return `COMPANY_${session.session_id.replace(/^CHAT_/, "")}`;
}

function removeEmptyDraft(draft: ContentDraft) {
  return removeEmptyFields(draft) as ContentDraft;
}

function removeEmptyFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === null || item === "") return false;
      if (Array.isArray(item) && item.length === 0) return false;
      if (typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
      return true;
    }),
  ) as Partial<T>;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function buildSessionId() {
  return `CHAT_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function assertSessionId(sessionId: string) {
  if (!sessionIdPattern.test(sessionId)) throw new Error("Invalid session_id");
}

function getSessionPath(sessionId: string) {
  assertSessionId(sessionId);
  return path.join(sessionsRoot, `${sessionId}.json`);
}

function writeSession(session: ChatHomepageSession) {
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.writeFileSync(getSessionPath(session.session_id), JSON.stringify(session, null, 2));
}

function normalizeGenerationMode(value: unknown): GenerationMode {
  if (value === "required" || value === "goose") return "required";
  if (value === "auto") return "auto";
  return process.env.CHAT_GOOSE_MODE === "required"
    ? "required"
    : process.env.CHAT_GOOSE_MODE === "auto"
      ? "auto"
      : "local";
}

function buildChildEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_") || key.startsWith("__NEXT_")) delete env[key];
  }
  return env;
}

function scrubLog(value: string) {
  return value
    .split("\n")
    .filter((line) => !/api[_-]?key|oauth|token|secret/i.test(line))
    .slice(-12)
    .join("\n");
}
