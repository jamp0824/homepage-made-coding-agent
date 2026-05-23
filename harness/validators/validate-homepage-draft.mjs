#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  normalizeBlockOverrides,
  normalizeDesignTokens,
  normalizeSectionOrder,
} from "../../frontend/lib/homepage-controls.mjs";

const draftPath = process.argv[2];

if (!draftPath) {
  console.error("Usage: node harness/validators/validate-homepage-draft.mjs harness/tmp/homepage-drafts/DRAFT_ID/content.draft.json");
  process.exit(1);
}

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
const allowedLayouts = {
  core_strengths: new Set(["list", "grid_2"]),
  history: new Set(["timeline", "compact"]),
  portfolio: new Set(["list", "grid_2"]),
  featured_products: new Set(["grid_2", "grid_3"]),
  product_area: new Set(["grid_2", "grid_3"]),
};
const allowedDensities = new Set(["compact", "standard", "rich"]);

const errors = [];
const warnings = [];
let draft = null;

try {
  draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
} catch (error) {
  errors.push(`Invalid draft JSON: ${error.message}`);
}

if (draft) {
  validateRequiredString("draft_id");
  validateRequiredString("homepage_type");
  validateRequiredString("company_name");
  validateRequiredString("industry");
  validateRequiredString("business_type");
  validateRequiredString("main_business_description");

  if (!["company_intro", "product"].includes(draft.homepage_type)) {
    errors.push("homepage_type must be company_intro or product");
  }

  if (!allowedDensities.has(draft.content_density)) {
    errors.push("content_density must be compact, standard, or rich");
  }

  validateVisibility();
  validateLayout();
  validateDesignControls();
  validateNonEmptyVisibleData();

  if (!Array.isArray(draft.core_strengths) || draft.core_strengths.length === 0) {
    errors.push("core_strengths must contain at least one item");
  }

  const draftText = collectStrings(draft).join("\n");
  for (const phrase of forbiddenPhrases) {
    if (draftText.includes(phrase)) {
      errors.push(`Unsupported high-risk phrase found in draft: ${phrase}`);
    }
  }
}

const report = {
  passed: errors.length === 0,
  errors,
  warnings,
  checked_at: new Date().toISOString(),
};

if (draftPath) {
  const reportPath = path.join(path.dirname(draftPath), "content.draft.validation-report.json");
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  } catch {
    // Ignore report write failure; stdout/stderr still report validation result.
  }
}

if (!report.passed) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));

function validateRequiredString(field) {
  if (typeof draft[field] !== "string" || draft[field].trim() === "") {
    errors.push(`${field} must be a non-empty string`);
  }
}

function validateVisibility() {
  if (!draft.section_visibility || typeof draft.section_visibility !== "object" || Array.isArray(draft.section_visibility)) {
    errors.push("section_visibility must be an object");
    return;
  }

  for (const [section, visible] of Object.entries(draft.section_visibility)) {
    if (!allowedVisibilitySections.has(section)) {
      errors.push(`section_visibility has unsupported section: ${section}`);
      continue;
    }
    if (typeof visible !== "boolean") {
      errors.push(`section_visibility.${section} must be a boolean`);
    }
    if (visible === false && requiredVisibleSections.has(section)) {
      errors.push(`section_visibility.${section} cannot be false`);
    }
  }
}

function validateLayout() {
  if (!draft.section_layout || typeof draft.section_layout !== "object" || Array.isArray(draft.section_layout)) {
    errors.push("section_layout must be an object");
    return;
  }

  for (const [section, layout] of Object.entries(draft.section_layout)) {
    const allowed = allowedLayouts[section];
    if (!allowed) {
      errors.push(`section_layout has unsupported section: ${section}`);
      continue;
    }
    if (typeof layout !== "string" || !allowed.has(layout)) {
      errors.push(`section_layout.${section} has unsupported layout: ${layout}`);
    }
  }
}

function validateDesignControls() {
  const normalizedTokens = normalizeDesignTokens(draft.design_tokens);
  if (draft.design_tokens && JSON.stringify(normalizedTokens) !== JSON.stringify(draft.design_tokens)) {
    errors.push("design_tokens contains unsupported values");
  }
  const normalizedOrder = normalizeSectionOrder(draft.section_order, draft.homepage_type);
  if (draft.section_order && JSON.stringify(normalizedOrder) !== JSON.stringify(draft.section_order)) {
    errors.push("section_order contains unsupported or duplicate sections");
  }
  const normalizedOverrides = normalizeBlockOverrides(draft.block_overrides);
  if (draft.block_overrides && JSON.stringify(normalizedOverrides) !== JSON.stringify(draft.block_overrides)) {
    errors.push("block_overrides contains unsupported values");
  }
}

function validateNonEmptyVisibleData() {
  const visibility = draft.section_visibility || {};
  if (visibility.history === true && (!Array.isArray(draft.history) || draft.history.length === 0)) {
    errors.push("history cannot be visible when draft.history is empty");
  }
  if (visibility.portfolio === true && (!Array.isArray(draft.portfolio) || draft.portfolio.length === 0)) {
    errors.push("portfolio cannot be visible when draft.portfolio is empty");
  }
  if (
    (visibility.featured_products === true || visibility.product_area === true) &&
    (!Array.isArray(draft.products) || draft.products.length === 0)
  ) {
    errors.push("product sections cannot be visible when draft.products is empty");
  }
}

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}
