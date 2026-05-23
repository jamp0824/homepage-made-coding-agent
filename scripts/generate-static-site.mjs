#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  normalizeBlockOverrides,
  normalizeDesignTokens,
  normalizeSectionOrder,
  resolveSectionOrder,
} from "../frontend/lib/homepage-controls.mjs";
import { contentToViewModel } from "../frontend/lib/homepage-view-model.mjs";
import { renderHomepageHtml } from "../frontend/lib/homepage-static-renderer.mjs";

const requestPath = process.argv[2] || "requests/sample-company-intro.json";
const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
const companyIdPattern = /^[A-Za-z0-9_-]+$/;
const RESULT_STYLE_VARIANT = "result_style_v1";

const requiredRequestFields = [
  "request_id",
  "company_id",
  "homepage_type",
  "company_name",
  "industry",
  "business_type",
  "main_business_description",
];

const missingFields = requiredRequestFields.filter((field) => !request[field]);
if (missingFields.length > 0) {
  console.error(`Request missing required fields: ${missingFields.join(", ")}`);
  process.exit(1);
}

if (!["company_intro", "product"].includes(request.homepage_type)) {
  console.error(`Unsupported homepage_type: ${request.homepage_type}`);
  process.exit(1);
}

if (!companyIdPattern.test(request.company_id)) {
  console.error("company_id may only contain letters, numbers, underscores, and hyphens");
  process.exit(1);
}

const templateId =
  request.homepage_type === "company_intro" ? "company_intro_basic" : "product_basic";
const templateConfigPath = path.join("templates", templateId, "template.config.json");
const templateConfig = JSON.parse(fs.readFileSync(templateConfigPath, "utf8"));
const sitePath = path.join("generated-sites", request.company_id);

fs.mkdirSync(sitePath, { recursive: true });

const contentDraft = normalizeContentDraft(request.content_draft);
const assetTheme =
  draftString("hero_image_theme") ||
  templateConfig.asset_theme_defaults?.[request.industry] ||
  templateConfig.asset_theme_defaults?.default ||
  "business_general";
const tags = normalizeStringArray(contentDraft.tags ?? request.tags).slice(0, 12);
const contact = normalizeContact(request.contact);
const contactEntries = Object.entries(contact).filter(([, value]) => Boolean(value));
const products = Array.isArray(request.products) ? request.products : [];
const history = Array.isArray(request.history) ? request.history : [];
const portfolio = Array.isArray(request.portfolio) ? request.portfolio : [];
const sectionVisibility = normalizeSectionVisibility(contentDraft.section_visibility ?? request.section_visibility);
const sectionLayout = normalizeSectionLayout(contentDraft.section_layout ?? request.section_layout);
const contentDensity = normalizeContentDensity(contentDraft.content_density ?? request.content_density);
const designTokens = normalizeDesignTokens(contentDraft.design_tokens ?? request.design_tokens);
const sectionOrder = normalizeSectionOrder(contentDraft.section_order ?? request.section_order, request.homepage_type);
const blockOverrides = normalizeBlockOverrides(contentDraft.block_overrides ?? request.block_overrides);
const contentSource =
  typeof request.content_source === "string" ? request.content_source : "request_only";
const coreStrengths =
  Array.isArray(contentDraft.core_strengths) && contentDraft.core_strengths.length > 0
    ? contentDraft.core_strengths
    : Array.isArray(request.core_strengths) && request.core_strengths.length > 0
      ? request.core_strengths
    : [`${request.business_type} 중심의 서비스 제공`];
if (process.env.INJECT_FAKE_CLAIM === "1") {
  coreStrengths.push("업계 1위 수상 경력");
}

const sections = buildSections();
const sectionManifest = buildSectionManifest(sections);
const actualSectionVisibility = Object.fromEntries(
  sectionManifest
    .filter((section) => section.id !== "hero")
    .map((section) => [section.id, section.visible]),
);
const businessSummary =
  draftString("business_summary") || `${request.industry} 분야에서 ${request.business_type}을 수행합니다.`;
const productRegistrationCta =
  request.homepage_type === "product" && products.length === 0
    ? "홈페이지에 표시할 상품 정보를 등록하면 상품 영역을 구성할 수 있습니다."
    : "";

const content = {
  request_id: request.request_id,
  company_id: request.company_id,
  homepage_type: request.homepage_type,
  template_id: templateId,
  template_variant: request.homepage_type === "company_intro" ? RESULT_STYLE_VARIANT : "basic",
  company_name: request.company_name,
  hero_title: draftString("hero_title") || request.one_line_intro || request.company_name,
  one_line_intro: draftString("one_line_intro") || request.one_line_intro || request.main_business_description,
  company_intro: draftString("company_intro") || request.company_intro || request.main_business_description,
  business_summary: businessSummary,
  industry: request.industry,
  business_type: request.business_type,
  tags,
  contact,
  cover_image_url: typeof request.cover_image_url === "string" ? request.cover_image_url : "",
  core_strengths: coreStrengths,
  products,
  history,
  portfolio,
  product_registration_cta: productRegistrationCta,
  contact_cta: draftString("cta_text") || `${request.company_name}의 사업과 서비스가 궁금하시다면 문의해 주세요.`,
  sections,
  section_manifest: sectionManifest,
  section_visibility: actualSectionVisibility,
  section_layout: sectionLayout,
  content_density: contentDensity,
  design_tokens: designTokens,
  section_order: sectionOrder,
  block_overrides: blockOverrides,
  content_source: contentSource,
  content_draft_applied: Object.keys(contentDraft).length > 0,
  draft_id: typeof request.draft_id === "string" ? request.draft_id : "",
  confirmed_at: typeof request.confirmed_at === "string" ? request.confirmed_at : "",
};

const assets = {
  asset_theme: assetTheme,
  hero_image: content.cover_image_url || `${assetTheme}/neutral-cover-fallback`,
  section_images: {
    company_intro: `${assetTheme}/company-intro-placeholder`,
    core_strengths: `${assetTheme}/strengths-placeholder`,
  },
  fallback_used: !content.cover_image_url,
};

const metadata = {
  request_id: request.request_id,
  company_id: request.company_id,
  homepage_type: request.homepage_type,
  template_id: templateId,
  template_variant: content.template_variant,
  generated_at: new Date().toISOString(),
  generator: "static-mvp-generator",
  model_provider: process.env.HOMEPAGE_GENERATOR_PROVIDER || "local_placeholder",
  model_name: process.env.HOMEPAGE_GENERATOR_MODEL || "deterministic-template",
};

const pageSource =
  request.homepage_type === "company_intro"
    ? renderCompanyIntroPageTsx()
    : renderProductPageTsx();
const htmlSource = renderHomepageHtml(contentToViewModel(content), { title: content.company_name });
const cssSource = fs.readFileSync(path.join("frontend", "lib", "homepage-view.css"), "utf8");

const generatedFiles = [
  "content.json",
  "assets.json",
  "metadata.json",
  "page.tsx",
  "index.html",
  "styles.css",
  ...(Object.keys(contentDraft).length > 0 ? ["content.draft.json"] : []),
  "generation-result.json",
  "validation-report.json",
  "agent-run-report.json",
  "agent-run-report.md",
];

const generationResult = {
  request_id: request.request_id,
  company_id: request.company_id,
  status: "agent_failed",
  homepage_type: request.homepage_type,
  template_id: templateId,
  generated_path: sitePath,
  homepage_url: `/homepage/${request.company_id}`,
  model_provider: metadata.model_provider,
  model_name: metadata.model_name,
  generated_files: generatedFiles,
  build_result: {
    passed: false,
    command: "npm run build",
    errors: [],
  },
  validation_result: {
    passed: false,
    errors: ["generation has not been validated yet"],
    warnings: [],
  },
  retry_count: 0,
  completed_at: new Date().toISOString(),
};

fs.writeFileSync(path.join(sitePath, "content.json"), JSON.stringify(content, null, 2));
if (Object.keys(contentDraft).length > 0) {
  fs.writeFileSync(path.join(sitePath, "content.draft.json"), JSON.stringify(contentDraft, null, 2));
}
fs.writeFileSync(path.join(sitePath, "assets.json"), JSON.stringify(assets, null, 2));
fs.writeFileSync(path.join(sitePath, "metadata.json"), JSON.stringify(metadata, null, 2));
fs.writeFileSync(path.join(sitePath, "page.tsx"), pageSource);
fs.writeFileSync(path.join(sitePath, "index.html"), htmlSource);
fs.writeFileSync(path.join(sitePath, "styles.css"), cssSource);
fs.writeFileSync(path.join(sitePath, "generation-result.json"), JSON.stringify(generationResult, null, 2));
fs.writeFileSync(
  path.join(sitePath, "validation-report.json"),
  JSON.stringify({ passed: false, errors: ["validation has not run yet"], warnings: [] }, null, 2),
);
fs.writeFileSync(
  path.join(sitePath, "agent-run-report.json"),
  JSON.stringify(
    {
      request_id: request.request_id,
      company_id: request.company_id,
      request_path: requestPath,
      generated_path: sitePath,
      final_status: "agent_failed",
      retry_count: 0,
      validation_result: generationResult.validation_result,
      build_result: generationResult.build_result,
      timeline: [
        {
          step: "agent_running",
          status: "completed",
          message: "Initial generated files were written; validation has not run yet.",
        },
      ],
    },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(sitePath, "agent-run-report.md"),
  `# Agent Run Report

- request_id: ${request.request_id}
- company_id: ${request.company_id}
- final_status: agent_failed

Initial generated files were written; validation has not run yet.
`,
);

console.log(sitePath);

function buildSections() {
  const applyOrder = (sections) => {
    const visible = new Set(sections);
    const resolvedOrder = resolveSectionOrder(sectionOrder, request.homepage_type);
    return resolvedOrder.filter((section) => visible.has(section));
  };

  if (request.homepage_type === "product") {
    const productSection = products.length > 0 ? "product_area" : "product_registration_cta";
    return applyOrder([
      "hero",
      "company_intro",
      "core_strengths",
      wantsVisible(productSection, true) ? productSection : "",
      "contact_cta",
    ].filter(Boolean));
  }

  const companySections = ["hero"];
  if (wantsVisible("company_summary", true)) companySections.push("company_summary");
  companySections.push("company_intro", "core_strengths");
  if (contactEntries.length > 0 && wantsVisible("contact_info", true)) companySections.push("contact_info");
  if (history.length > 0 && wantsVisible("history", true)) companySections.push("history");
  if (portfolio.length > 0 && wantsVisible("portfolio", true)) companySections.push("portfolio");
  if (products.length > 0 && wantsVisible("featured_products", true)) companySections.push("featured_products");
  companySections.push("contact_cta");
  return applyOrder(companySections);
}

function buildSectionManifest(visibleSections) {
  const visible = new Set(visibleSections);
  const candidateSections =
    request.homepage_type === "product"
      ? ["hero", "company_intro", "core_strengths", "product_area", "product_registration_cta", "contact_cta"]
      : [
          "hero",
          "company_summary",
          "company_intro",
          "core_strengths",
          "contact_info",
          "history",
          "portfolio",
          "featured_products",
          "contact_cta",
        ];

  return candidateSections.map((section) => ({
    id: section,
    visible: visible.has(section),
  }));
}

function wantsVisible(sectionName, hasData) {
  if (["hero", "company_intro", "core_strengths", "contact_cta"].includes(sectionName)) {
    return true;
  }
  if (!hasData) return false;
  if (Object.prototype.hasOwnProperty.call(sectionVisibility, sectionName)) {
    return sectionVisibility[sectionName] !== false;
  }
  return true;
}

function normalizeSectionVisibility(value) {
  const allowed = new Set([
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
  const output = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [section, visible] of Object.entries(value)) {
      if (allowed.has(section) && typeof visible === "boolean") {
        output[section] = visible;
      }
    }
  }
  for (const requiredSection of ["company_intro", "core_strengths", "contact_cta"]) {
    output[requiredSection] = true;
  }
  return output;
}

function normalizeSectionLayout(value) {
  const defaults = templateConfig.default_section_layout || {};
  const allowed = templateConfig.allowed_section_layout || {};
  const output = { ...defaults };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [section, layout] of Object.entries(value)) {
      if (Array.isArray(allowed[section]) && allowed[section].includes(layout)) {
        output[section] = layout;
      }
    }
  }
  return output;
}

function normalizeContentDensity(value) {
  const allowed = templateConfig.allowed_content_density || ["compact", "standard", "rich"];
  return allowed.includes(value) ? value : templateConfig.default_content_density || "standard";
}

function normalizeContentDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output = {};
  for (const field of [
    "hero_title",
    "one_line_intro",
    "company_intro",
    "business_summary",
    "hero_image_theme",
    "cta_text",
  ]) {
    if (typeof value[field] === "string" && value[field].trim()) {
      output[field] = value[field].trim();
    }
  }
  const coreStrengths = normalizeStringArray(value.core_strengths).slice(0, 10);
  if (coreStrengths.length > 0) output.core_strengths = coreStrengths;
  const tags = normalizeStringArray(value.tags).slice(0, 12);
  if (tags.length > 0) output.tags = tags;
  const heroImageKeywords = normalizeStringArray(value.hero_image_keywords).slice(0, 8);
  if (heroImageKeywords.length > 0) output.hero_image_keywords = heroImageKeywords;
  if (value.section_visibility && typeof value.section_visibility === "object" && !Array.isArray(value.section_visibility)) {
    output.section_visibility = normalizeSectionVisibility(value.section_visibility);
  }
  if (value.section_layout && typeof value.section_layout === "object" && !Array.isArray(value.section_layout)) {
    output.section_layout = normalizeSectionLayout(value.section_layout);
  }
  if (value.content_density && typeof value.content_density === "string") {
    output.content_density = normalizeContentDensity(value.content_density);
  }
  const designTokens = normalizeDesignTokens(value.design_tokens);
  if (Object.keys(designTokens).length > 0) output.design_tokens = designTokens;
  const sectionOrder = normalizeSectionOrder(value.section_order, request.homepage_type);
  if (sectionOrder.length > 0) output.section_order = sectionOrder;
  const blockOverrides = normalizeBlockOverrides(value.block_overrides);
  if (Object.keys(blockOverrides).length > 0) output.block_overrides = blockOverrides;
  return output;
}

function draftString(field) {
  return typeof contentDraft[field] === "string" ? contentDraft[field] : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeContact(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = ["address", "phone", "email", "website_url"];
  return Object.fromEntries(
    allowed
      .map((key) => [key, typeof value[key] === "string" ? value[key].trim() : ""])
      .filter(([, item]) => Boolean(item)),
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderCompanyIntroPageTsx() {
  return `// Generated from ${templateId} (${RESULT_STYLE_VARIANT}). Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import { HomepageView } from "../../frontend/lib/homepage-view-renderer.mjs";
import { contentToViewModel } from "../../frontend/lib/homepage-view-model.mjs";

export default function GeneratedHomepage() {
  return <HomepageView model={contentToViewModel(content)} mode="final" />;
}
`;
}

function renderProductPageTsx() {
  return `// Generated from ${templateId}. Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import { HomepageView } from "../../frontend/lib/homepage-view-renderer.mjs";
import { contentToViewModel } from "../../frontend/lib/homepage-view-model.mjs";

export default function GeneratedHomepage() {
  return <HomepageView model={contentToViewModel(content)} mode="final" />;
}
`;
}

function renderCompanyIntroHtml() {
  const productCount = products.length;
  const visibleSections = new Set(content.sections);
  const strengthClassName = sectionLayout.core_strengths === "list" ? "strength-grid strength-grid-list" : "strength-grid";
  const historyClassName = sectionLayout.history === "compact" ? "timeline timeline-compact" : "timeline";
  const portfolioClassName = sectionLayout.portfolio === "list" ? "card-grid card-list" : "card-grid";
  const productClassName = sectionLayout.featured_products === "grid_3" ? "product-card-list product-card-list-3" : "product-card-list";
  const tagHtml = [...tags, request.business_type]
    .filter(Boolean)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("\n");
  const coverHtml = content.cover_image_url
    ? `<img src="${escapeHtml(content.cover_image_url)}" alt="" />`
    : `<div class="cover-fallback" aria-hidden="true"></div>`;
  const contactHtml =
    contactEntries.length > 0 && visibleSections.has("contact_info")
      ? `<section class="info-card profile-info-card" data-section="contact_info">
        <h2>기업 정보</h2>
        <dl class="contact-list">
          ${contactEntries
            .map(
              ([key, value]) => `<div><dt>${escapeHtml(contactLabel(key))}</dt><dd>${escapeHtml(value)}</dd></div>`,
            )
            .join("\n")}
        </dl>
      </section>`
      : "";
  const historyHtml =
    history.length > 0 && visibleSections.has("history")
      ? `<section class="info-card" data-section="history">
        <h2>연혁</h2>
        <ol class="${historyClassName}">
          ${history.map((item) => `<li><strong>${escapeHtml(item.year)}</strong><span>${escapeHtml(item.text)}</span></li>`).join("\n")}
        </ol>
      </section>`
      : "";
  const portfolioHtml =
    portfolio.length > 0 && visibleSections.has("portfolio")
      ? `<section class="info-card" data-section="portfolio">
        <h2>포트폴리오</h2>
        <div class="${portfolioClassName}">
          ${portfolio
            .map((item) => `<article class="portfolio-card"><span class="card-icon" aria-hidden="true">□</span><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(item.description || "")}</p></article>`)
            .join("\n")}
        </div>
      </section>`
      : "";
  const productsHtml =
    products.length > 0 && visibleSections.has("featured_products")
      ? `<section id="products" class="info-card" data-section="featured_products">
        <h2>주요 상품 <span class="count-badge">${productCount}</span></h2>
        <div class="${productClassName}">
          ${products
            .map(
              (product) => `<article class="product-profile-card">
                <div class="product-image-frame">
                  ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="" />` : `<div class="product-image-fallback" aria-hidden="true"></div>`}
                </div>
                <div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description || "")}</p></div>
                <span class="product-cta">견적요청</span>
              </article>`,
            )
            .join("\n")}
        </div>
      </section>`
      : "";

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(content.company_name)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="profile-page" data-template="${templateId}" data-template-variant="${RESULT_STYLE_VARIANT}" data-content-density="${escapeHtml(contentDensity)}" data-asset-theme="${escapeHtml(assetTheme)}">
      <header class="profile-nav" aria-label="생성 홈페이지 탐색">
        <div class="profile-brand-mark" aria-hidden="true">H</div>
        <nav aria-label="페이지 섹션">
          <a href="#company">기업</a>
          ${productCount > 0 ? `<a href="#products">상품</a>` : ""}
          <a href="#contact">문의</a>
        </nav>
      </header>
      <div class="profile-action-row">
        <a class="profile-back-link" href="/">← 뒤로</a>
      </div>
      <article class="profile-hero-card">
        <section class="profile-cover" data-section="hero">${coverHtml}</section>
        ${visibleSections.has("company_summary") ? `<section class="profile-summary" data-section="company_summary">
          <p class="eyebrow">${escapeHtml(content.industry)}</p>
          <div class="profile-title-row">
            <h1>${escapeHtml(content.company_name)}</h1>
          </div>
          <p>${escapeHtml(content.one_line_intro)}</p>
          <div class="tag-row">${tagHtml}</div>
          <div class="profile-meta-row">
            <span>회사소개중심형</span>
            ${productCount > 0 ? `<span>상품 ${productCount}개</span>` : ""}
          </div>
        </section>` : ""}
      </article>
      ${contactHtml}
      <section id="company" class="info-card" data-section="company_intro"><h2>기업 소개</h2><p>${escapeHtml(content.company_intro)}</p></section>
      <section class="info-card profile-strength-card" data-section="core_strengths">
        <h2>핵심 강점</h2>
        <ul class="${strengthClassName}">${coreStrengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul>
      </section>
      ${historyHtml}
      ${portfolioHtml}
      ${productsHtml}
      <section id="contact" class="contact-cta profile-contact-card" data-section="contact_cta"><h2>문의하기</h2><p>${escapeHtml(content.contact_cta)}</p></section>
    </main>
  </body>
</html>
`;
}

function renderProductHtml() {
  const productSectionName = products.length === 0 ? "product_registration_cta" : "product_area";
  const renderProducts = products.length
    ? products.map((product) => `<article class="item-card"><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description || "")}</p></article>`).join("\n")
    : `<div class="notice">${escapeHtml(productRegistrationCta)}</div>`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(content.company_name)}</title><link rel="stylesheet" href="./styles.css" /></head>
<body><main><section class="hero" data-section="hero"><h1>${escapeHtml(content.hero_title)}</h1><p>${escapeHtml(content.one_line_intro)}</p></section><section class="section" data-section="company_intro"><h2>회사 소개</h2><p>${escapeHtml(content.company_intro)}</p></section><section class="section" data-section="core_strengths"><h2>핵심 강점</h2><ul class="strength-list">${coreStrengths.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")}</ul></section><section class="section" data-section="${productSectionName}"><h2>상품 안내</h2><div class="item-grid">${renderProducts}</div></section><section class="contact" data-section="contact_cta"><h2>문의하기</h2><p>${escapeHtml(content.contact_cta)}</p></section></main></body></html>`;
}

function contactLabel(key) {
  return {
    address: "주소",
    phone: "전화",
    email: "이메일",
    website_url: "웹사이트",
  }[key] || key;
}

function renderResultStyleCss() {
  return `:root {
  color-scheme: light;
  --text: #1d2433;
  --muted: #687386;
  --line: #e3e8f0;
  --surface: #ffffff;
  --soft: #f6f8fb;
  --primary: #4f7fe8;
  --primary-soft: #edf4ff;
  --primary-dark: #264f9d;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: var(--text);
  background: var(--soft);
  line-height: 1.6;
}

.profile-page {
  width: min(calc(100% - 48px), 1080px);
  margin: 0 auto;
  padding: 24px 0 72px;
}

.profile-nav {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 24px;
  align-items: center;
  min-height: 52px;
  margin-bottom: 18px;
  padding: 0 10px;
}

.profile-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #ffffff;
  background: var(--primary);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 800;
}

.profile-nav nav {
  display: flex;
  justify-content: center;
  gap: 18px;
}

.profile-nav a,
.profile-back-link {
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.profile-action-row {
  display: flex;
  justify-content: flex-start;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 12px;
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.profile-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
  background: #ffffff;
  font: inherit;
}

.profile-hero-card {
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--line);
}

.profile-cover {
  overflow: hidden;
  height: 340px;
  background: linear-gradient(135deg, #edf4ff, #f9fbff);
  border: 0;
}

.profile-cover img,
.cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
}

.profile-cover img { object-fit: cover; }

.cover-fallback {
  background:
    linear-gradient(135deg, rgba(79, 127, 232, 0.18), rgba(18, 163, 127, 0.12)),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 12px, rgba(255,255,255,0.2) 12px 24px);
}

.profile-summary,
.info-card,
.contact-cta {
  padding: 32px;
  background: var(--surface);
  border: 1px solid var(--line);
}

.profile-summary {
  margin-bottom: 0;
  padding: 26px clamp(28px, 5.5vw, 72px) 30px;
  border: 0;
  border-top: 0;
}

.info-card,
.contact-cta {
  margin-top: 22px;
  padding: 30px clamp(28px, 4.5vw, 56px);
  border-radius: 8px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
}

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: 0;
}

h2 {
  margin: 0 0 18px;
  font-size: 22px;
  letter-spacing: 0;
}

h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

p {
  max-width: 820px;
  margin: 0;
  color: var(--muted);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.profile-title-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 6px;
}

.profile-title-row span,
.count-badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
}

.profile-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 14px;
  color: var(--muted);
  font-size: 13px;
}

.tag-row span {
  padding: 6px 10px;
  color: #4d5f78;
  background: var(--primary-soft);
  border-radius: 6px;
  font-size: 13px;
}

.profile-info-card .contact-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 28px;
}

.contact-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
}

.contact-list div,
.strength-grid li,
.card-grid article,
.product-card-list article {
  padding: 16px;
  background: #fbfcff;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.profile-info-card .contact-list div {
  padding: 0;
  background: transparent;
  border: 0;
}

dt {
  color: var(--muted);
  font-size: 13px;
}

dd {
  margin: 4px 0 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.strength-grid,
.timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.strength-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.strength-grid li {
  min-height: 56px;
  border-left: 4px solid var(--primary);
}

.strength-grid-list {
  grid-template-columns: 1fr;
}

.profile-strength-card {
  background: transparent;
  border: 0;
  padding-top: 12px;
}

.profile-strength-card .strength-grid li {
  background: #ffffff;
}

.profile-strength-card .strength-grid {
  max-width: 760px;
}

.timeline {
  display: grid;
  gap: 14px;
}

.timeline-compact {
  gap: 8px;
}

.timeline li {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 14px;
  align-items: start;
}

.timeline strong {
  display: inline-flex;
  justify-content: center;
  padding: 4px 8px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 6px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.card-list {
  grid-template-columns: 1fr;
}

.portfolio-card {
  position: relative;
  padding-left: 64px !important;
}

.card-icon {
  position: absolute;
  left: 18px;
  top: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 6px;
  font-weight: 800;
}

.product-card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.product-card-list-3 .product-profile-card {
  width: min(100%, 180px);
}

.profile-page[data-content-density="compact"] .info-card,
.profile-page[data-content-density="compact"] .contact-cta {
  margin-top: 16px;
  padding-top: 22px;
  padding-bottom: 22px;
}

.profile-page[data-content-density="compact"] .profile-cover {
  height: 260px;
}

.profile-page[data-content-density="rich"] .info-card,
.profile-page[data-content-density="rich"] .contact-cta {
  padding-top: 38px;
  padding-bottom: 38px;
}

.profile-page[data-content-density="rich"] .strength-grid,
.profile-page[data-content-density="rich"] .card-grid {
  gap: 16px;
}

.product-profile-card {
  width: min(100%, 200px);
  padding: 0 !important;
  overflow: hidden;
}

.product-profile-card h3,
.product-profile-card p,
.product-profile-card .product-cta {
  margin-left: 16px;
  margin-right: 16px;
}

.product-profile-card h3 {
  margin-top: 14px;
}

.product-profile-card p {
  margin-bottom: 16px;
  font-size: 13px;
}

.product-image-frame {
  background: var(--primary-soft);
}

.product-profile-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  margin-bottom: 0;
}

.product-image-fallback {
  aspect-ratio: 1 / 1;
  background:
    linear-gradient(135deg, rgba(79, 127, 232, 0.16), rgba(18, 163, 127, 0.1)),
    repeating-linear-gradient(45deg, rgba(255,255,255,0.52) 0 10px, rgba(255,255,255,0.2) 10px 20px);
}

.product-cta {
  display: inline-flex;
  margin-bottom: 16px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
}

.contact-cta {
  color: #ffffff;
  background: var(--primary-dark);
  border-color: var(--primary-dark);
}

.contact-cta p {
  color: rgba(255, 255, 255, 0.84);
}

.profile-contact-card {
  padding-top: 34px;
  padding-bottom: 34px;
}

@media (max-width: 720px) {
  .profile-page {
    width: min(calc(100% - 28px), 1080px);
    padding: 24px 0 56px;
  }
  .profile-cover { height: 180px; }
  .profile-nav { grid-template-columns: 1fr; justify-items: start; }
  .profile-nav nav { justify-content: flex-start; }
  .profile-action-row { padding: 0; }
  .profile-summary,
  .info-card,
  .contact-cta { padding: 22px 18px; }
  h1 { font-size: 26px; }
  .contact-list,
  .profile-info-card .contact-list,
  .strength-grid,
  .card-grid { grid-template-columns: 1fr; }
  .timeline li { grid-template-columns: 1fr; }
  .profile-strength-card { padding-left: 0; padding-right: 0; }
}
`;
}

function renderBasicCss() {
  return `:root {
  color-scheme: light;
  --text: #172033;
  --muted: #5c667a;
  --line: #dfe4ee;
  --surface: #ffffff;
  --soft: #f5f7fb;
  --primary: #2f6fed;
  --primary-dark: #1f4fb4;
  --accent: #12a37f;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: var(--text); background: var(--soft); line-height: 1.6; }
main { max-width: 1040px; margin: 0 auto; padding: 56px 24px 72px; }
.hero { min-height: 420px; display: grid; align-content: center; padding: 72px 0; }
h1 { max-width: 760px; margin: 12px 0 20px; font-size: 48px; line-height: 1.18; letter-spacing: 0; }
h2 { margin: 8px 0 18px; font-size: 28px; letter-spacing: 0; }
h3 { margin: 0 0 8px; font-size: 18px; }
p { max-width: 780px; margin: 0; color: var(--muted); }
.section,.contact { margin-top: 28px; padding: 40px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.strength-list,.item-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.strength-list { padding: 0; list-style: none; }
.strength-list li,.item-card,.notice { padding: 18px; background: var(--soft); border: 1px solid var(--line); border-radius: 8px; }
.contact { background: var(--primary-dark); }
.contact h2,.contact p { color: #ffffff; }
@media (max-width: 720px) { main { padding: 36px 18px 56px; } .hero { min-height: 320px; padding: 48px 0; } h1 { font-size: 34px; } .section,.contact { padding: 28px 20px; } .strength-list,.item-grid { grid-template-columns: 1fr; } }
`;
}
