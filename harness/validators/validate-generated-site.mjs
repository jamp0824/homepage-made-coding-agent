#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const requiredFiles = [
  "content.json",
  "assets.json",
  "metadata.json",
  "page.tsx",
  "index.html",
  "styles.css",
  "generation-result.json",
  "agent-run-report.json",
  "agent-run-report.md",
];

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
const allowedStatuses = new Set([
  "generated",
  "published",
  "agent_failed",
  "validation_failed",
  "build_failed",
  "manual_required",
]);

const readJson = (filePath, errors) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON: ${filePath} (${error.message})`);
    return null;
  }
};

const collectStrings = (value, output = []) => {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
};

const hasSection = (content, sectionName) => {
  return Array.isArray(content?.sections) && content.sections.includes(sectionName);
};

const sitePath = process.argv[2];
const requestPath = process.argv[3] || "";

if (!sitePath) {
  console.error("Usage: node harness/validators/validate-generated-site.mjs generated-sites/COMPANY_001 [request.json]");
  process.exit(1);
}

const errors = [];
const warnings = [];

if (!fs.existsSync(sitePath) || !fs.statSync(sitePath).isDirectory()) {
  errors.push(`Generated site directory not found: ${sitePath}`);
} else {
  for (const fileName of requiredFiles) {
    const filePath = path.join(sitePath, fileName);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing required file: ${filePath}`);
    }
  }
}

const content = fs.existsSync(path.join(sitePath, "content.json"))
  ? readJson(path.join(sitePath, "content.json"), errors)
  : null;
const assets = fs.existsSync(path.join(sitePath, "assets.json"))
  ? readJson(path.join(sitePath, "assets.json"), errors)
  : null;
const metadata = fs.existsSync(path.join(sitePath, "metadata.json"))
  ? readJson(path.join(sitePath, "metadata.json"), errors)
  : null;
const result = fs.existsSync(path.join(sitePath, "generation-result.json"))
  ? readJson(path.join(sitePath, "generation-result.json"), errors)
  : null;
const agentRunReport = fs.existsSync(path.join(sitePath, "agent-run-report.json"))
  ? readJson(path.join(sitePath, "agent-run-report.json"), errors)
  : null;
const pageSource = fs.existsSync(path.join(sitePath, "page.tsx"))
  ? fs.readFileSync(path.join(sitePath, "page.tsx"), "utf8")
  : "";
const htmlSource = fs.existsSync(path.join(sitePath, "index.html"))
  ? fs.readFileSync(path.join(sitePath, "index.html"), "utf8")
  : "";
const request = requestPath && fs.existsSync(requestPath) ? readJson(requestPath, errors) : null;

if (content && metadata) {
  if (!content.company_name) errors.push("content.json missing company_name");
  if (!content.company_intro) errors.push("content.json missing company_intro");
  if (!Array.isArray(content.core_strengths) || content.core_strengths.length < 1) {
    errors.push("content.json missing at least one core_strength");
  }
  if (!content.homepage_type) errors.push("content.json missing homepage_type");
  if (!content.template_id) errors.push("content.json missing template_id");

  const expectedTemplate =
    content.homepage_type === "company_intro"
      ? "company_intro_basic"
      : content.homepage_type === "product"
        ? "product_basic"
        : null;
  if (!expectedTemplate) {
    errors.push(`Unsupported homepage_type: ${content.homepage_type}`);
  } else if (content.template_id !== expectedTemplate || metadata.template_id !== expectedTemplate) {
    errors.push(`template_id must be ${expectedTemplate} for ${content.homepage_type}`);
  }

  for (const sectionName of ["hero", "company_intro", "core_strengths", "contact_cta"]) {
    if (!hasSection(content, sectionName)) errors.push(`Missing required section: ${sectionName}`);
  }

  if (content.homepage_type === "product") {
    const products = Array.isArray(content.products) ? content.products : [];
    if (request) {
      const requestProducts = Array.isArray(request.products) ? request.products : [];
      if (requestProducts.length === 0 && products.length > 0) {
        errors.push("Product cards were generated even though request.products is empty");
      }
      if (requestProducts.length === 0 && !hasSection(content, "product_registration_cta")) {
        errors.push("Product request without products must include product_registration_cta section");
      }
      if (requestProducts.length > 0 && !hasSection(content, "product_area")) {
        errors.push("Product request with products must include product_area section");
      }
    } else if (products.length === 0 && !hasSection(content, "product_registration_cta")) {
      errors.push("Product site without product cards must include product_registration_cta section");
    } else if (products.length > 0 && !hasSection(content, "product_area")) {
      errors.push("Product site with product cards must include product_area section");
    }
  }

  if (request) {
    if (content.company_name !== request.company_name) {
      errors.push("company_name must match request.company_name exactly");
    }
    if ((!Array.isArray(request.history) || request.history.length === 0) && hasSection(content, "history")) {
      errors.push("history section generated even though request.history is empty");
    }
    if ((!Array.isArray(request.portfolio) || request.portfolio.length === 0) && hasSection(content, "portfolio")) {
      errors.push("portfolio section generated even though request.portfolio is empty");
    }
    if (Array.isArray(content.products) && Array.isArray(request.products)) {
      const allowedProductNames = new Set(request.products.map((product) => product.name));
      const allowedProducts = new Map(
        request.products.map((product) => [product.name, product.description || ""]),
      );
      for (const product of content.products) {
        if (!allowedProductNames.has(product.name)) {
          errors.push(`Product not present in request was generated: ${product.name}`);
          continue;
        }
        if ((product.description || "") !== allowedProducts.get(product.name)) {
          errors.push(`Product description for ${product.name} does not match request`);
        }
      }
    }
    if (Array.isArray(content.history) && Array.isArray(request.history)) {
      const allowedHistory = new Set(
        request.history.map((item) => `${item.year}\n${item.text}`),
      );
      for (const item of content.history) {
        if (!allowedHistory.has(`${item.year}\n${item.text}`)) {
          errors.push(`History item not present in request was generated: ${item.year} ${item.text}`);
        }
      }
    }
    if (Array.isArray(content.portfolio) && Array.isArray(request.portfolio)) {
      const allowedPortfolio = new Set(
        request.portfolio.map((item) => `${item.title || ""}\n${item.description || ""}`),
      );
      for (const item of content.portfolio) {
        if (!allowedPortfolio.has(`${item.title || ""}\n${item.description || ""}`)) {
          errors.push(`Portfolio item not present in request was generated: ${item.title || ""}`);
        }
      }
    }
  } else {
    warnings.push("Request path was not provided; request-based fake-claim checks were limited");
  }
}

if (assets) {
  if (!assets.asset_theme) errors.push("assets.json missing asset_theme");
  if (!assets.hero_image) errors.push("assets.json missing hero_image");
  if (typeof assets.fallback_used !== "boolean") errors.push("assets.json missing fallback_used boolean");
}

if (result) {
  for (const field of [
    "request_id",
    "company_id",
    "status",
    "homepage_type",
    "template_id",
    "generated_path",
    "generated_files",
    "validation_result",
    "retry_count",
  ]) {
    if (!(field in result)) errors.push(`generation-result.json missing ${field}`);
  }
  if (!allowedStatuses.has(result.status)) {
    errors.push(`generation-result.json has unsupported status: ${result.status}`);
  }
}

if (agentRunReport) {
  for (const field of [
    "request_id",
    "company_id",
    "request_path",
    "generated_path",
    "final_status",
    "retry_count",
    "validation_result",
    "build_result",
    "timeline",
  ]) {
    if (!(field in agentRunReport)) errors.push(`agent-run-report.json missing ${field}`);
  }
  if (!Array.isArray(agentRunReport.timeline) || agentRunReport.timeline.length < 1) {
    errors.push("agent-run-report.json timeline must contain at least one event");
  }
  if (result && agentRunReport.final_status !== result.status) {
    errors.push("agent-run-report.json final_status must match generation-result.json status");
  }
}

const generatedText = collectStrings({ content, assets, metadata, agentRunReport }).join("\n");
  for (const phrase of forbiddenPhrases) {
  if (generatedText.includes(phrase)) {
    errors.push(`Unsupported high-risk phrase found: ${phrase}`);
  }
}

if (content && pageSource) {
  for (const sectionName of content.sections || []) {
    if (!pageSource.includes(`data-section="${sectionName}"`)) {
      errors.push(`page.tsx missing data-section for content section: ${sectionName}`);
    }
  }
}

if (content && htmlSource) {
  if (!htmlSource.includes(`>${content.company_name}<`) && !htmlSource.includes(content.company_name)) {
    errors.push("index.html does not include company_name");
  }
  for (const sectionName of content.sections || []) {
    if (!htmlSource.includes(`data-section="${sectionName}"`)) {
      errors.push(`index.html missing data-section for content section: ${sectionName}`);
    }
  }
}

const report = {
  passed: errors.length === 0,
  errors,
  warnings,
  checked_at: new Date().toISOString(),
};

if (fs.existsSync(sitePath) && fs.statSync(sitePath).isDirectory()) {
  fs.writeFileSync(path.join(sitePath, "validation-report.json"), JSON.stringify(report, null, 2));
}

if (!report.passed) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
