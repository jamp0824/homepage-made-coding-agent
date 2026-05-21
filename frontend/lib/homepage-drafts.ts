import fs from "node:fs";
import path from "node:path";

export type HomepageType = "company_intro" | "product";
export type ContentDensity = "compact" | "standard" | "rich";
export type ContentSource = "request_only" | "ai_suggested" | "ai_suggested_user_confirmed";

export type DraftContact = {
  address?: string;
  phone?: string;
  email?: string;
  website_url?: string;
};

export type DraftProduct = {
  name: string;
  description?: string;
  image_url?: string;
};

export type DraftHistoryItem = {
  year: string;
  text: string;
};

export type DraftPortfolioItem = {
  title?: string;
  description?: string;
};

export type DraftValidationResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

export type HomepageDraft = {
  draft_id: string;
  draft_status: "needs_input" | "drafted" | "edited" | "confirmed" | "validation_failed";
  request_id?: string;
  company_id?: string;
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
  contact: DraftContact;
  products: DraftProduct[];
  history: DraftHistoryItem[];
  portfolio: DraftPortfolioItem[];
  section_visibility: Record<string, boolean>;
  section_layout: Record<string, string>;
  content_density: ContentDensity;
  content_source: ContentSource;
  missing_fields: string[];
  validation_result: DraftValidationResult;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
};

export type ConversationMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  patch?: Record<string, unknown>;
  created_at: string;
};

export type ConversationSession = {
  draft_id: string;
  initial_prompt?: string;
  current_step: "type" | "business_info" | "company_profile" | "ai_draft" | "edit_publish" | "done";
  pending_questions: string[];
  last_assistant_message: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
};

export type DraftCreatePayload = Partial<HomepageDraft> & {
  homepageType?: string;
  homepage_type?: string;
  initialPrompt?: string;
  initial_prompt?: string;
};

export type DraftPatch = Partial<
  Pick<
    HomepageDraft,
    | "company_name"
    | "industry"
    | "business_type"
    | "main_business_description"
    | "one_line_intro"
    | "company_intro"
    | "core_strengths"
    | "section_visibility"
    | "section_layout"
    | "content_density"
    | "content_source"
  >
>;

const draftsRoot = path.join(process.cwd(), "harness", "tmp", "homepage-drafts");
const draftIdPattern = /^[A-Za-z0-9_-]+$/;
const requiredFields = [
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

export function createHomepageDraft(payload: DraftCreatePayload) {
  const now = new Date().toISOString();
  const draftId = buildDraftId();
  const homepageType = normalizeHomepageType(payload.homepage_type ?? payload.homepageType);
  const base = normalizeDraftPayload(payload, homepageType);
  const missingFields = requiredFields.filter((field) => !base[field]);
  const draft: HomepageDraft = {
    draft_id: draftId,
    draft_status: missingFields.length > 0 ? "needs_input" : "drafted",
    homepage_type: homepageType,
    company_name: base.company_name,
    industry: base.industry,
    business_type: base.business_type,
    main_business_description: base.main_business_description,
    initial_prompt: base.initial_prompt,
    one_line_intro: base.one_line_intro || buildOneLineIntro(base),
    company_intro: base.company_intro || buildCompanyIntro(base),
    core_strengths: base.core_strengths.length > 0 ? base.core_strengths : deriveCoreStrengths(base),
    tags: base.tags,
    contact: base.contact,
    products: base.products,
    history: base.history,
    portfolio: base.portfolio,
    section_visibility: buildDefaultVisibility(homepageType, base),
    section_layout: buildDefaultLayout(homepageType),
    content_density: "standard",
    content_source: "ai_suggested",
    missing_fields: missingFields,
    validation_result: { passed: false, errors: [], warnings: [] },
    created_at: now,
    updated_at: now,
  };
  draft.validation_result = validateDraftState(draft);
  if (!draft.validation_result.passed) draft.draft_status = "validation_failed";

  const assistantMessage = buildDraftAssistantMessage(draft);
  const session: ConversationSession = {
    draft_id: draftId,
    initial_prompt: base.initial_prompt,
    current_step: missingFields.length > 0 ? "business_info" : "ai_draft",
    pending_questions: missingFields.map((field) => fieldToQuestion(field)),
    last_assistant_message: assistantMessage,
    messages: [
      {
        role: "assistant",
        content: assistantMessage,
        created_at: now,
      },
    ],
    created_at: now,
    updated_at: now,
  };

  writeDraftBundle(draft, session);
  return { draft, session };
}

export function readHomepageDraft(draftId: string) {
  assertDraftId(draftId);
  const draftPath = getDraftPath(draftId);
  const sessionPath = getSessionPath(draftId);
  if (!fs.existsSync(draftPath) || !fs.existsSync(sessionPath)) return null;

  return {
    draft: JSON.parse(fs.readFileSync(draftPath, "utf8")) as HomepageDraft,
    session: JSON.parse(fs.readFileSync(sessionPath, "utf8")) as ConversationSession,
  };
}

export function saveHomepageDraftBundle(draft: HomepageDraft, session: ConversationSession) {
  writeDraftBundle(draft, session);
}

export function patchHomepageDraft(draftId: string, patch: DraftPatch) {
  const bundle = readHomepageDraft(draftId);
  if (!bundle) return null;

  const now = new Date().toISOString();
  const safePatch = sanitizeDraftPatch(bundle.draft, patch);
  const draft = mergeDraftPatch(bundle.draft, safePatch);
  draft.updated_at = now;
  draft.content_source = safePatch.content_source || "ai_suggested_user_confirmed";
  draft.missing_fields = requiredFields.filter((field) => !draft[field]);
  draft.validation_result = validateDraftState(draft);
  draft.draft_status = draft.validation_result.passed ? "edited" : "validation_failed";

  const session = {
    ...bundle.session,
    updated_at: now,
    pending_questions: draft.missing_fields.map((field) => fieldToQuestion(field)),
  };
  writeDraftBundle(draft, session);
  return { draft, session };
}

export function applyDraftMessage(draftId: string, message: string, externalPatch?: DraftPatch) {
  const bundle = readHomepageDraft(draftId);
  if (!bundle) return null;

  const now = new Date().toISOString();
  const deterministic = buildPatchFromMessage(bundle.draft, message);
  const blocked = deterministic.warnings.includes("unsupported_claim_request_blocked");
  const safeExternalPatch = blocked ? {} : sanitizeDraftPatch(bundle.draft, externalPatch || {});
  const safeDeterministicPatch = sanitizeDraftPatch(bundle.draft, deterministic.patch);
  const patch = blocked ? {} : combineDraftPatches(safeExternalPatch, safeDeterministicPatch);
  const assistantMessage =
    Object.keys(patch).length > 0
      ? "요청을 고정 템플릿 안의 편집 가능한 슬롯으로 반영했습니다. 입력에 없는 사실은 추가하지 않았습니다."
      : deterministic.assistantMessage;
  const draft = mergeDraftPatch(bundle.draft, patch);
  draft.updated_at = now;
  draft.content_source = "ai_suggested_user_confirmed";
  draft.missing_fields = requiredFields.filter((field) => !draft[field]);
  draft.validation_result = validateDraftState(draft);
  draft.validation_result.warnings.push(...deterministic.warnings);
  draft.draft_status = draft.validation_result.passed ? "edited" : "validation_failed";

  const session: ConversationSession = {
    ...bundle.session,
    current_step: "edit_publish",
    pending_questions: draft.missing_fields.map((field) => fieldToQuestion(field)),
    last_assistant_message: assistantMessage,
    messages: [
      ...bundle.session.messages,
      { role: "user", content: message, created_at: now },
      { role: "assistant", content: assistantMessage, patch, created_at: now },
    ],
    updated_at: now,
  };

  writeDraftBundle(draft, session);
  return { draft, session, patch, assistantMessage };
}

export function extractAllowedDraftPatch(current: HomepageDraft, candidate: HomepageDraft): DraftPatch {
  const patch: DraftPatch = {};

  if (candidate.one_line_intro !== current.one_line_intro) {
    patch.one_line_intro = candidate.one_line_intro;
  }
  if (candidate.company_intro !== current.company_intro) {
    patch.company_intro = candidate.company_intro;
  }
  if (JSON.stringify(candidate.core_strengths) !== JSON.stringify(current.core_strengths)) {
    patch.core_strengths = candidate.core_strengths;
  }
  const sectionVisibilityPatch = diffRecord(current.section_visibility, candidate.section_visibility);
  if (Object.keys(sectionVisibilityPatch).length > 0) {
    patch.section_visibility = sectionVisibilityPatch as Record<string, boolean>;
  }
  const sectionLayoutPatch = diffRecord(current.section_layout, candidate.section_layout);
  if (Object.keys(sectionLayoutPatch).length > 0) {
    patch.section_layout = sectionLayoutPatch as Record<string, string>;
  }
  if (candidate.content_density !== current.content_density) {
    patch.content_density = candidate.content_density;
  }

  return sanitizeDraftPatch(current, patch);
}

export function refreshHomepageDraftValidation(draftId: string) {
  const bundle = readHomepageDraft(draftId);
  if (!bundle) return null;

  const now = new Date().toISOString();
  const draft: HomepageDraft = {
    ...bundle.draft,
    missing_fields: requiredFields.filter((field) => !bundle.draft[field]),
    updated_at: now,
  };
  draft.validation_result = validateDraftState(draft);
  draft.draft_status = draft.validation_result.passed ? draft.draft_status : "validation_failed";

  const session: ConversationSession = {
    ...bundle.session,
    pending_questions: draft.missing_fields.map((field) => fieldToQuestion(field)),
    updated_at: now,
  };
  writeDraftBundle(draft, session);
  return { draft, session };
}

export function buildConfirmedRequestFromDraft(draft: HomepageDraft) {
  const now = new Date().toISOString();
  const requestId = draft.request_id || `REQ_${draft.draft_id}`;
  const companyId = draft.company_id || buildCompanyId(draft.company_name, requestId);

  return removeEmptyFields({
    request_id: requestId,
    company_id: companyId,
    homepage_type: draft.homepage_type,
    company_name: draft.company_name,
    industry: draft.industry,
    business_type: draft.business_type,
    main_business_description: draft.main_business_description,
    one_line_intro: draft.one_line_intro,
    company_intro: draft.company_intro,
    tags: draft.tags,
    contact: draft.contact,
    core_strengths: draft.core_strengths,
    products: draft.products,
    portfolio: draft.portfolio,
    history: draft.history,
    section_visibility: draft.section_visibility,
    section_layout: draft.section_layout,
    content_density: draft.content_density,
    content_source: "ai_suggested_user_confirmed",
    draft_id: draft.draft_id,
    confirmed_at: now,
    preferred_style: "clean",
    created_at: now,
  });
}

export function confirmDraft(draftId: string) {
  const bundle = readHomepageDraft(draftId);
  if (!bundle) return null;

  const now = new Date().toISOString();
  const draft: HomepageDraft = {
    ...bundle.draft,
    draft_status: "confirmed",
    content_source: "ai_suggested_user_confirmed",
    confirmed_at: now,
    updated_at: now,
  };
  const session: ConversationSession = {
    ...bundle.session,
    current_step: "done",
    updated_at: now,
  };
  writeDraftBundle(draft, session);
  return { draft, session };
}

export function validateDraftState(draft: HomepageDraft): DraftValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of requiredFields) {
    if (!draft[field]) errors.push(`${field} is required`);
  }
  if (!["company_intro", "product"].includes(draft.homepage_type)) {
    errors.push("homepage_type must be company_intro or product");
  }
  if (!allowedDensities.has(draft.content_density)) {
    errors.push("content_density must be compact, standard, or rich");
  }
  for (const [section, visible] of Object.entries(draft.section_visibility || {})) {
    if (!allowedVisibilitySections.has(section)) {
      errors.push(`section_visibility has unsupported section: ${section}`);
    }
    if (typeof visible !== "boolean") {
      errors.push(`section_visibility.${section} must be a boolean`);
    }
  }
  for (const [section, layout] of Object.entries(draft.section_layout || {})) {
    const allowed = allowedLayouts[section];
    if (!allowed) {
      errors.push(`section_layout has unsupported section: ${section}`);
    } else if (typeof layout !== "string" || !allowed.has(layout)) {
      errors.push(`section_layout.${section} has unsupported layout: ${layout}`);
    }
  }
  for (const section of requiredVisibleSections) {
    if (draft.section_visibility[section] === false) {
      errors.push(`required section cannot be hidden: ${section}`);
    }
  }
  if (!Array.isArray(draft.core_strengths) || draft.core_strengths.length === 0) {
    errors.push("core_strengths must contain at least one item");
  }
  if (draft.section_visibility.history && draft.history.length === 0) {
    errors.push("history cannot be visible when no history data exists");
  }
  if (draft.section_visibility.portfolio && draft.portfolio.length === 0) {
    errors.push("portfolio cannot be visible when no portfolio data exists");
  }
  if (
    (draft.section_visibility.featured_products || draft.section_visibility.product_area) &&
    draft.products.length === 0
  ) {
    errors.push("product sections cannot be visible when no product data exists");
  }
  for (const phrase of forbiddenPhrases) {
    if (JSON.stringify(draft).includes(phrase)) {
      errors.push(`unsupported high-risk phrase found: ${phrase}`);
    }
  }

  return { passed: errors.length === 0, errors, warnings };
}

function normalizeDraftPayload(payload: DraftCreatePayload, homepageType: HomepageType) {
  const contact = normalizeContact(payload.contact);
  const products = normalizeProducts(payload.products);
  const history = normalizeHistory(payload.history);
  const portfolio = normalizePortfolio(payload.portfolio);
  const initialPrompt = cleanText(payload.initial_prompt ?? payload.initialPrompt);

  return {
    homepage_type: homepageType,
    company_name: cleanText(payload.company_name),
    industry: cleanText(payload.industry),
    business_type: cleanText(payload.business_type),
    main_business_description: cleanText(payload.main_business_description) || initialPrompt,
    initial_prompt: initialPrompt,
    one_line_intro: cleanText(payload.one_line_intro),
    company_intro: cleanText(payload.company_intro),
    core_strengths: normalizeStringArray(payload.core_strengths),
    tags: normalizeStringArray(payload.tags).slice(0, 12),
    contact,
    products,
    history,
    portfolio,
  };
}

function buildPatchFromMessage(draft: HomepageDraft, message: string) {
  const normalized = message.toLowerCase();
  const patch: DraftPatch = {};
  const warnings: string[] = [];
  const blockedPhrase = forbiddenPhrases.find((phrase) => message.includes(phrase));

  if (blockedPhrase || /인증|수상|고객사|매출|특허|1위|납품/.test(message)) {
    return {
      patch,
      warnings: ["unsupported_claim_request_blocked"],
      assistantMessage:
        "입력에 없는 인증, 수상, 고객사, 매출, 특허, 순위 정보는 추가할 수 없습니다. 해당 사실이 있다면 근거가 되는 항목을 먼저 입력해 주세요.",
    };
  }

  if (/풍부|자세|강조|전문|rich/.test(message)) {
    patch.content_density = "rich";
    patch.core_strengths = enrichStrengths(draft);
  }
  if (/간결|짧|compact/.test(message)) {
    patch.content_density = "compact";
  }
  if (/보통|기본|standard/.test(message)) {
    patch.content_density = "standard";
  }

  const companyName = extractFieldChange(message, ["회사\\s*이름", "회사명", "상호"]);
  if (companyName) {
    patch.company_name = companyName;
    if (draft.company_intro.includes(draft.company_name)) {
      patch.company_intro = normalizeCompanyNameJosa(
        draft.company_intro.replaceAll(draft.company_name, companyName),
        companyName,
      );
    }
  }
  const industry = extractFieldChange(message, ["업종"]);
  if (industry) patch.industry = industry;
  const businessType = extractFieldChange(message, ["업태", "사업\\s*유형"]);
  if (businessType) patch.business_type = businessType;

  const section_layout: Record<string, string> = {};
  let layoutChanged = false;
  if (/카드|그리드|grid|2열/.test(message)) {
    if (/포트폴리오/.test(message)) section_layout.portfolio = "grid_2";
    else if (/상품/.test(message)) section_layout.product_area = "grid_2";
    else section_layout.core_strengths = "grid_2";
    layoutChanged = true;
  }
  if (/리스트|목록/.test(message)) {
    if (/포트폴리오/.test(message)) section_layout.portfolio = "list";
    else section_layout.core_strengths = "list";
    layoutChanged = true;
  }
  if (/연혁/.test(message) && /간단|compact|작게/.test(message)) {
    section_layout.history = "compact";
    layoutChanged = true;
  }
  if (/연혁/.test(message) && /타임라인|timeline/.test(message)) {
    section_layout.history = "timeline";
    layoutChanged = true;
  }
  if (layoutChanged) patch.section_layout = section_layout;

  const section_visibility: Record<string, boolean> = {};
  if (applyVisibilityRequest({ draft, message, section_visibility, warnings })) {
    patch.section_visibility = section_visibility;
  }

  const assistantMessage =
    Object.keys(patch).length > 0
      ? "요청을 고정 템플릿 안의 편집 가능한 슬롯으로 반영했습니다. 입력에 없는 사실은 추가하지 않았습니다."
      : "수정할 수 있는 템플릿 슬롯을 찾지 못했습니다. 문구, 섹션 표시/숨김, 카드형/리스트형, 풍부하게/간결하게처럼 요청해 주세요.";

  return { patch, warnings, assistantMessage };
}

function applyVisibilityRequest({
  draft,
  message,
  section_visibility,
  warnings,
}: {
  draft: HomepageDraft;
  message: string;
  section_visibility: Record<string, boolean>;
  warnings: string[];
}) {
  const hide = /숨|감춰|빼|제외|삭제/.test(message);
  const show = /보여|표시|추가|살려/.test(message);
  if (!hide && !show) return false;

  const section = inferSectionFromMessage(message);
  if (!section) return false;
  if (requiredVisibleSections.has(section) && hide) {
    warnings.push(`${section}_cannot_be_hidden`);
    return false;
  }
  if (show && !sectionHasData(section, draft)) {
    warnings.push(`${section}_has_no_data`);
    return false;
  }
  section_visibility[section] = show || !hide;
  return true;
}

function inferSectionFromMessage(message: string) {
  if (/연락|문의|기업 정보/.test(message)) return "contact_info";
  if (/연혁/.test(message)) return "history";
  if (/포트폴리오/.test(message)) return "portfolio";
  if (/상품/.test(message)) return "featured_products";
  if (/핵심|강점/.test(message)) return "core_strengths";
  if (/소개/.test(message)) return "company_intro";
  return null;
}

function sectionHasData(section: string, draft: HomepageDraft) {
  if (section === "history") return draft.history.length > 0;
  if (section === "portfolio") return draft.portfolio.length > 0;
  if (section === "featured_products" || section === "product_area") return draft.products.length > 0;
  if (section === "contact_info") return Object.values(draft.contact).some(Boolean);
  return true;
}

function mergeDraftPatch(draft: HomepageDraft, patch: DraftPatch): HomepageDraft {
  return {
    ...draft,
    ...patch,
    section_visibility: {
      ...draft.section_visibility,
      ...(patch.section_visibility || {}),
    },
    section_layout: {
      ...draft.section_layout,
      ...(patch.section_layout || {}),
    },
  };
}

function combineDraftPatches(first: DraftPatch, second: DraftPatch): DraftPatch {
  const combined: DraftPatch = {
    ...first,
    ...second,
  };
  const sectionVisibility = {
    ...(first.section_visibility || {}),
    ...(second.section_visibility || {}),
  };
  const sectionLayout = {
    ...(first.section_layout || {}),
    ...(second.section_layout || {}),
  };
  if (Object.keys(sectionVisibility).length > 0) combined.section_visibility = sectionVisibility;
  if (Object.keys(sectionLayout).length > 0) combined.section_layout = sectionLayout;
  return combined;
}

function sanitizeDraftPatch(draft: HomepageDraft, patch: DraftPatch): DraftPatch {
  const safePatch: DraftPatch = {};

  if (typeof patch.one_line_intro === "string") {
    const value = cleanText(patch.one_line_intro);
    if (value && !hasForbiddenPhrase(value)) safePatch.one_line_intro = value;
  }
  if (typeof patch.company_name === "string") {
    const value = cleanText(patch.company_name);
    if (value && !hasForbiddenPhrase(value)) safePatch.company_name = value;
  }
  if (typeof patch.industry === "string") {
    const value = cleanText(patch.industry);
    if (value && !hasForbiddenPhrase(value)) safePatch.industry = value;
  }
  if (typeof patch.business_type === "string") {
    const value = cleanText(patch.business_type);
    if (value && !hasForbiddenPhrase(value)) safePatch.business_type = value;
  }
  if (typeof patch.main_business_description === "string") {
    const value = cleanText(patch.main_business_description);
    if (value && !hasForbiddenPhrase(value)) safePatch.main_business_description = value;
  }
  if (typeof patch.company_intro === "string") {
    const value = cleanText(patch.company_intro);
    if (value && !hasForbiddenPhrase(value)) safePatch.company_intro = value;
  }
  if (Array.isArray(patch.core_strengths)) {
    const values = normalizeStringArray(patch.core_strengths)
      .filter((item) => !hasForbiddenPhrase(item))
      .slice(0, 10);
    if (values.length > 0) safePatch.core_strengths = values;
  }
  if (
    patch.content_density === "compact" ||
    patch.content_density === "standard" ||
    patch.content_density === "rich"
  ) {
    safePatch.content_density = patch.content_density;
  }
  if (patch.section_visibility && typeof patch.section_visibility === "object") {
    const sectionVisibility: Record<string, boolean> = {};
    for (const [section, visible] of Object.entries(patch.section_visibility)) {
      if (!allowedVisibilitySections.has(section) || typeof visible !== "boolean") continue;
      if (requiredVisibleSections.has(section) && visible === false) continue;
      if (visible === true && !sectionHasData(section, draft)) continue;
      sectionVisibility[section] = visible;
    }
    if (Object.keys(sectionVisibility).length > 0) safePatch.section_visibility = sectionVisibility;
  }
  if (patch.section_layout && typeof patch.section_layout === "object") {
    const sectionLayout: Record<string, string> = {};
    for (const [section, layout] of Object.entries(patch.section_layout)) {
      const allowed = allowedLayouts[section];
      if (!allowed || typeof layout !== "string" || !allowed.has(layout)) continue;
      sectionLayout[section] = layout;
    }
    if (Object.keys(sectionLayout).length > 0) safePatch.section_layout = sectionLayout;
  }
  if (
    patch.content_source === "request_only" ||
    patch.content_source === "ai_suggested" ||
    patch.content_source === "ai_suggested_user_confirmed"
  ) {
    safePatch.content_source = patch.content_source;
  }

  return safePatch;
}

function hasForbiddenPhrase(value: string) {
  return forbiddenPhrases.some((phrase) => value.includes(phrase));
}

function extractFieldChange(message: string, fieldPatterns: string[]) {
  const fieldPattern = fieldPatterns.join("|");
  const regexes = [
    new RegExp(`(?:${fieldPattern})(?:은|는|을|를)?\\s*(?:.+?(?:아니라|말고)\\s*)?(.+?)(?:으로|로)\\s*(?:바꿔|변경|수정|해줘|해주세요|해)`, "i"),
    new RegExp(`(?:${fieldPattern})(?:은|는|을|를)?\\s*(?:[:：]|=)?\\s*([^,\\.\\n]+)`, "i"),
  ];

  for (const regex of regexes) {
    const match = message.match(regex);
    if (!match?.[1]) continue;
    const value = cleanText(match[1])
      .replace(/^(은|는|을|를)\s*/, "")
      .replace(/\s*(으로|로|라고|으로요|로요)$/, "");
    if (value.length >= 2) return value;
  }
  return "";
}

function normalizeCompanyNameJosa(value: string, companyName: string) {
  return value
    .replaceAll(`${companyName}은`, `${companyName}는`)
    .replaceAll(`${companyName}을`, `${companyName}를`);
}

function diffRecord(
  current: Record<string, string | boolean> = {},
  candidate: Record<string, string | boolean> = {},
) {
  const patch: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (current[key] !== value) patch[key] = value;
  }
  return patch;
}

function buildDefaultVisibility(homepageType: HomepageType, base: ReturnType<typeof normalizeDraftPayload>) {
  return {
    company_summary: true,
    contact_info: Object.values(base.contact).some(Boolean),
    company_intro: true,
    core_strengths: true,
    history: base.history.length > 0,
    portfolio: base.portfolio.length > 0,
    featured_products: homepageType === "company_intro" && base.products.length > 0,
    product_area: homepageType === "product" && base.products.length > 0,
    product_registration_cta: homepageType === "product" && base.products.length === 0,
    contact_cta: true,
  };
}

function buildDefaultLayout(homepageType: HomepageType): Record<string, string> {
  return homepageType === "product"
    ? { core_strengths: "grid_2", product_area: "grid_2" }
    : {
        core_strengths: "grid_2",
        history: "timeline",
        portfolio: "grid_2",
        featured_products: "grid_2",
      };
}

function buildOneLineIntro(base: ReturnType<typeof normalizeDraftPayload>) {
  if (!base.main_business_description) return "";
  const source = base.initial_prompt || base.main_business_description;
  if (!source) return "";
  return source.length > 54 ? `${source.slice(0, 54).trim()}...` : source;
}

function buildCompanyIntro(base: ReturnType<typeof normalizeDraftPayload>) {
  const source = base.initial_prompt || base.main_business_description;
  if (!base.company_name && !source) return "";
  if (!base.company_name) return source;
  if (source.includes(base.company_name)) return source;
  return `${base.company_name}은 ${source}`;
}

function deriveCoreStrengths(base: ReturnType<typeof normalizeDraftPayload>) {
  const promptStrengths = extractPromptStrengths(base.initial_prompt);
  const strengths = [
    ...promptStrengths,
    base.business_type ? `${base.business_type} 중심의 서비스 구성` : "",
    base.industry ? `${base.industry} 분야에 맞춘 정보 정리` : "",
    base.main_business_description || base.initial_prompt
      ? "입력된 주요 사업 내용을 바탕으로 한 홈페이지 구성"
      : "",
  ].filter(Boolean);

  return strengths.length > 0 ? strengths.slice(0, 3) : ["입력된 사업 정보를 바탕으로 한 홈페이지 구성"];
}

function extractPromptStrengths(prompt: string) {
  if (!prompt) return [];
  const candidates = [
    /AI|인공지능/i.test(prompt) ? "AI 기반 업무 지원" : "",
    /재고|입출고|발주/.test(prompt) ? "재고와 입출고 업무 관리" : "",
    /자동화|반복 업무/.test(prompt) ? "반복 업무 자동화" : "",
    /중소기업|소상공인/.test(prompt) ? "중소기업 환경에 맞춘 사용성" : "",
    /데이터|분석|현황/.test(prompt) ? "데이터 기반 운영 현황 관리" : "",
  ].filter(Boolean);
  return [...new Set(candidates)];
}

function enrichStrengths(draft: HomepageDraft) {
  const source = draft.core_strengths.length > 0 ? draft.core_strengths : deriveCoreStrengthsFromDraft(draft);
  return source
    .map((item) => {
      if (item.length >= 26) return item;
      return `${item} 상세 설명`;
    })
    .slice(0, 6);
}

function deriveCoreStrengthsFromDraft(draft: HomepageDraft) {
  const strengths = [
    ...extractPromptStrengths(draft.initial_prompt || ""),
    draft.business_type ? `${draft.business_type} 중심의 서비스 구성` : "",
    draft.industry ? `${draft.industry} 분야에 맞춘 정보 정리` : "",
    draft.main_business_description ? "입력된 주요 사업 내용을 바탕으로 한 홈페이지 구성" : "",
  ].filter(Boolean);

  return strengths.length > 0 ? strengths.slice(0, 3) : ["입력된 사업 정보를 바탕으로 한 홈페이지 구성"];
}

function buildDraftAssistantMessage(draft: HomepageDraft) {
  if (draft.missing_fields.length > 0) {
    return `초안을 만들기 위해 ${draft.missing_fields.join(", ")} 정보가 더 필요합니다.`;
  }
  return "고정 템플릿 구조에 맞춰 초안을 만들었습니다. 문구, 섹션 표시/숨김, 카드형/리스트형, 풍부하게/간결하게 같은 수정 요청을 할 수 있습니다.";
}

function fieldToQuestion(field: string) {
  return (
    {
      company_name: "회사명을 입력해 주세요.",
      industry: "업종을 입력해 주세요.",
      business_type: "업태 또는 사업 유형을 입력해 주세요.",
      main_business_description: "주요 사업 내용을 10자 이상 입력해 주세요.",
    }[field] || `${field} 값을 입력해 주세요.`
  );
}

function writeDraftBundle(draft: HomepageDraft, session: ConversationSession) {
  const dir = getDraftDir(draft.draft_id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getDraftPath(draft.draft_id), JSON.stringify(draft, null, 2));
  fs.writeFileSync(getSessionPath(draft.draft_id), JSON.stringify(session, null, 2));
}

function getDraftDir(draftId: string) {
  assertDraftId(draftId);
  return path.join(draftsRoot, draftId);
}

function getDraftPath(draftId: string) {
  return path.join(getDraftDir(draftId), "content.draft.json");
}

function getSessionPath(draftId: string) {
  return path.join(getDraftDir(draftId), "conversation-session.json");
}

function assertDraftId(draftId: string) {
  if (!draftIdPattern.test(draftId)) {
    throw new Error("Unsupported draft_id");
  }
}

function buildDraftId() {
  return `DRAFT_${Date.now()}`;
}

function buildCompanyId(companyName: string, requestId: string) {
  const ascii = companyName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 28)
    .toUpperCase();
  const suffix = requestId.replace(/^REQ_/, "");
  return `DRAFT_${ascii || "COMPANY"}_${suffix}`.replace(/[^A-Z0-9_-]/g, "_");
}

function normalizeHomepageType(value: unknown): HomepageType {
  return value === "product" ? "product" : "company_intro";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function normalizeContact(value: unknown): DraftContact {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const contact = value as Record<string, unknown>;
  return removeEmptyFields({
    address: cleanText(contact.address),
    phone: cleanText(contact.phone),
    email: cleanText(contact.email),
    website_url: cleanText(contact.website_url),
  });
}

function normalizeProducts(value: unknown): DraftProduct[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const product = item as Record<string, unknown>;
      const name = cleanText(product.name);
      if (!name) return null;
      return removeEmptyFields({
        name,
        description: cleanText(product.description),
        image_url: cleanText(product.image_url),
      }) as DraftProduct;
    })
    .filter((item): item is DraftProduct => Boolean(item));
}

function normalizeHistory(value: unknown): DraftHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const history = item as Record<string, unknown>;
      const year = cleanText(history.year);
      const text = cleanText(history.text);
      return year && text ? { year, text } : null;
    })
    .filter((item): item is DraftHistoryItem => Boolean(item));
}

function normalizePortfolio(value: unknown): DraftPortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const portfolio = item as Record<string, unknown>;
      const normalized = removeEmptyFields({
        title: cleanText(portfolio.title),
        description: cleanText(portfolio.description),
      });
      return Object.keys(normalized).length > 0 ? (normalized as DraftPortfolioItem) : null;
    })
    .filter((item): item is DraftPortfolioItem => Boolean(item));
}

function removeEmptyFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => {
      if (Array.isArray(fieldValue)) return fieldValue.length > 0;
      if (fieldValue && typeof fieldValue === "object") return Object.keys(fieldValue).length > 0;
      return fieldValue !== "";
    }),
  ) as T;
}
