#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const requestPath = process.argv[2] || "requests/sample-company-intro.json";
const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
const companyIdPattern = /^[A-Za-z0-9_-]+$/;

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

const assetTheme =
  templateConfig.asset_theme_defaults?.[request.industry] ||
  templateConfig.asset_theme_defaults?.default ||
  "business_general";

const coreStrengths =
  Array.isArray(request.core_strengths) && request.core_strengths.length > 0
    ? request.core_strengths
    : [`${request.business_type} 중심의 서비스 제공`];
if (process.env.INJECT_FAKE_CLAIM === "1") {
  coreStrengths.push("업계 1위 수상 경력");
}

const sections = ["hero", "company_intro", "core_strengths"];

if (request.homepage_type === "product") {
  if (Array.isArray(request.products) && request.products.length > 0) {
    sections.push("product_area");
  } else {
    sections.push("product_registration_cta");
  }
} else {
  sections.push("business_summary");
}

if (Array.isArray(request.history) && request.history.length > 0) sections.push("history");
if (Array.isArray(request.portfolio) && request.portfolio.length > 0) sections.push("portfolio");
sections.push("contact_cta");

const content = {
  request_id: request.request_id,
  company_id: request.company_id,
  homepage_type: request.homepage_type,
  template_id: templateId,
  company_name: request.company_name,
  hero_title: request.one_line_intro || request.company_name,
  one_line_intro: request.one_line_intro || request.main_business_description,
  company_intro: request.company_intro || request.main_business_description,
  business_summary: `${request.industry} 분야에서 ${request.business_type}을 수행합니다.`,
  core_strengths: coreStrengths,
  products: Array.isArray(request.products) ? request.products : [],
  history: Array.isArray(request.history) ? request.history : [],
  portfolio: Array.isArray(request.portfolio) ? request.portfolio : [],
  product_registration_cta:
    request.homepage_type === "product" && (!request.products || request.products.length === 0)
      ? "홈페이지에 표시할 상품 정보를 등록하면 상품 영역을 구성할 수 있습니다."
      : "",
  contact_cta: `${request.company_name}의 사업과 서비스가 궁금하시다면 문의해 주세요.`,
  sections,
};

const productSectionName =
  request.homepage_type === "product" &&
  (!Array.isArray(request.products) || request.products.length === 0)
    ? "product_registration_cta"
    : "product_area";

const assets = {
  asset_theme: assetTheme,
  hero_image: `${assetTheme}/hero-placeholder`,
  section_images: {
    company_intro: `${assetTheme}/company-intro-placeholder`,
    core_strengths: `${assetTheme}/strengths-placeholder`,
  },
  fallback_used: true,
};

const metadata = {
  request_id: request.request_id,
  company_id: request.company_id,
  homepage_type: request.homepage_type,
  template_id: templateId,
  generated_at: new Date().toISOString(),
  generator: "static-mvp-generator",
  model_provider: process.env.HOMEPAGE_GENERATOR_PROVIDER || "local_placeholder",
  model_name: process.env.HOMEPAGE_GENERATOR_MODEL || "deterministic-template",
};

const pageSource = `// Generated from ${templateId}. Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import assets from "./assets.json";

export default function GeneratedHomepage() {
  return (
    <main data-template="${templateId}" data-asset-theme={assets.asset_theme}>
      <section data-section="hero">
        <h1>{content.hero_title}</h1>
        <p>{content.one_line_intro}</p>
      </section>
      <section data-section="company_intro">
        <h2>회사 소개</h2>
        <p>{content.company_intro}</p>
      </section>
      <section data-section="core_strengths">
        <h2>핵심 강점</h2>
        <ul>{content.core_strengths.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section data-section="${request.homepage_type === "product" ? productSectionName : "business_summary"}">
        <h2>${request.homepage_type === "product" ? "상품 안내" : "사업 요약"}</h2>
        ${
          request.homepage_type === "product"
            ? `{content.products.length > 0 ? content.products.map((product) => <article key={product.name}><h3>{product.name}</h3><p>{product.description}</p></article>) : <p>{content.product_registration_cta}</p>}`
            : `<p>{content.business_summary}</p>`
        }
      </section>
      {content.history?.length ? (
        <section data-section="history">
          <h2>연혁</h2>
          {content.history.map((item) => <article key={item.year + item.text}><h3>{item.year}</h3><p>{item.text}</p></article>)}
        </section>
      ) : null}
      {content.portfolio?.length ? (
        <section data-section="portfolio">
          <h2>포트폴리오</h2>
          {content.portfolio.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.description}</p></article>)}
        </section>
      ) : null}
      <section data-section="contact_cta">
        <h2>문의하기</h2>
        <p>{content.contact_cta}</p>
      </section>
    </main>
  );
}
`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderStrengths = content.core_strengths
  .map((item) => `<li>${escapeHtml(item)}</li>`)
  .join("\n");

const renderProducts = content.products.length
  ? content.products
      .map(
        (product) => `
        <article class="item-card">
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description || "")}</p>
        </article>`,
      )
      .join("\n")
  : `<div class="notice">${escapeHtml(content.product_registration_cta)}</div>`;
const renderHistory = content.history.length
  ? `<section class="section" data-section="history">
        <div class="section-label">History</div>
        <h2>연혁</h2>
        <div class="item-grid">
          ${content.history
            .map(
              (item) => `
          <article class="item-card">
            <h3>${escapeHtml(item.year)}</h3>
            <p>${escapeHtml(item.text)}</p>
          </article>`,
            )
            .join("\n")}
        </div>
      </section>`
  : "";
const renderPortfolio = content.portfolio.length
  ? `<section class="section" data-section="portfolio">
        <div class="section-label">Portfolio</div>
        <h2>포트폴리오</h2>
        <div class="item-grid">
          ${content.portfolio
            .map(
              (item) => `
          <article class="item-card">
            <h3>${escapeHtml(item.title || "")}</h3>
            <p>${escapeHtml(item.description || "")}</p>
          </article>`,
            )
            .join("\n")}
        </div>
      </section>`
  : "";

const typeLabel = request.homepage_type === "product" ? "상품중심형" : "회사소개중심형";

const htmlSource = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(content.company_name)}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="#top">${escapeHtml(content.company_name)}</a>
      <nav aria-label="주요 섹션">
        <a href="#intro">회사 소개</a>
        <a href="#strengths">핵심 강점</a>
        <a href="#contact">문의</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero" data-section="hero">
        <div class="eyebrow">${escapeHtml(typeLabel)} · ${escapeHtml(request.industry)}</div>
        <h1>${escapeHtml(content.hero_title)}</h1>
        <p>${escapeHtml(content.one_line_intro)}</p>
      </section>

      <section id="intro" class="section" data-section="company_intro">
        <div class="section-label">Company</div>
        <h2>회사 소개</h2>
        <p>${escapeHtml(content.company_intro)}</p>
        <dl class="facts">
          <div>
            <dt>업종</dt>
            <dd>${escapeHtml(request.industry)}</dd>
          </div>
          <div>
            <dt>업태</dt>
            <dd>${escapeHtml(request.business_type)}</dd>
          </div>
        </dl>
      </section>

      <section id="strengths" class="section" data-section="core_strengths">
        <div class="section-label">Strengths</div>
        <h2>핵심 강점</h2>
        <ul class="strength-list">
          ${renderStrengths}
        </ul>
      </section>

      ${
        request.homepage_type === "product"
          ? `<section class="section" data-section="${productSectionName}">
        <div class="section-label">Products</div>
        <h2>상품 안내</h2>
        <div class="item-grid">
          ${renderProducts}
        </div>
      </section>`
          : `<section class="section" data-section="business_summary">
        <div class="section-label">Business</div>
        <h2>사업 요약</h2>
        <p>${escapeHtml(content.business_summary)}</p>
      </section>`
      }

      ${renderHistory}
      ${renderPortfolio}

      <section id="contact" class="contact" data-section="contact_cta">
        <h2>문의하기</h2>
        <p>${escapeHtml(content.contact_cta)}</p>
      </section>
    </main>
  </body>
</html>
`;

const cssSource = `:root {
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

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  color: var(--text);
  background: var(--soft);
  line-height: 1.6;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  min-height: 64px;
  padding: 0 40px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--line);
}

.brand {
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

nav a {
  color: var(--muted);
  font-size: 14px;
  text-decoration: none;
}

main {
  max-width: 1040px;
  margin: 0 auto;
  padding: 56px 24px 72px;
}

.hero {
  min-height: 420px;
  display: grid;
  align-content: center;
  padding: 72px 0;
}

.eyebrow,
.section-label {
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
}

h1 {
  max-width: 760px;
  margin: 12px 0 20px;
  font-size: 48px;
  line-height: 1.18;
  letter-spacing: 0;
}

h2 {
  margin: 8px 0 18px;
  font-size: 28px;
  letter-spacing: 0;
}

h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

p {
  max-width: 780px;
  margin: 0;
  color: var(--muted);
}

.section,
.contact {
  margin-top: 28px;
  padding: 40px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 28px 0 0;
}

.facts div,
.item-card,
.notice {
  padding: 18px;
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: 8px;
}

dt {
  color: var(--muted);
  font-size: 13px;
}

dd {
  margin: 4px 0 0;
  font-weight: 700;
}

.strength-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.strength-list li {
  min-height: 88px;
  padding: 18px;
  background: var(--soft);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.contact {
  background: var(--primary-dark);
}

.contact h2,
.contact p {
  color: #ffffff;
}

@media (max-width: 720px) {
  .site-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 16px 20px;
  }

  main {
    padding: 36px 18px 56px;
  }

  .hero {
    min-height: 320px;
    padding: 48px 0;
  }

  h1 {
    font-size: 34px;
  }

  .section,
  .contact {
    padding: 28px 20px;
  }

  .facts,
  .strength-list,
  .item-grid {
    grid-template-columns: 1fr;
  }
}
`;

const generatedFiles = [
  "content.json",
  "assets.json",
  "metadata.json",
  "page.tsx",
  "index.html",
  "styles.css",
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
