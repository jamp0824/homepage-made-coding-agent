#!/usr/bin/env node
import fs from "node:fs";
import {
  allowedBlockEmphasis,
  allowedDesignColors,
  allowedRadii,
  sectionIds,
} from "../frontend/lib/homepage-controls.mjs";

const requestPath = process.argv[2];

if (!requestPath) {
  console.error("Usage: node scripts/validate-request.mjs requests/sample-company-intro.json");
  process.exit(1);
}

const requiredFields = [
  "request_id",
  "company_id",
  "homepage_type",
  "company_name",
  "industry",
  "business_type",
  "main_business_description",
];

const allowedTopLevelFields = new Set([
  ...requiredFields,
  "one_line_intro",
  "company_intro",
  "cover_image_url",
  "tags",
  "contact",
  "core_strengths",
  "products",
  "portfolio",
  "history",
  "section_visibility",
  "section_layout",
  "content_density",
  "design_tokens",
  "section_order",
  "block_overrides",
  "content_source",
  "content_draft",
  "draft_id",
  "confirmed_at",
  "preferred_style",
  "created_at",
]);
const companyIdPattern = /^[A-Za-z0-9_-]+$/;
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
const allowedLayoutValues = {
  core_strengths: new Set(["list", "grid_2"]),
  history: new Set(["timeline", "compact"]),
  portfolio: new Set(["list", "grid_2"]),
  featured_products: new Set(["grid_2", "grid_3"]),
  product_area: new Set(["grid_2", "grid_3"]),
};

const errors = [];
let request;

try {
  request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
} catch (error) {
  console.error(`Invalid request JSON: ${error.message}`);
  process.exit(1);
}

if (!request || typeof request !== "object" || Array.isArray(request)) {
  errors.push("Request must be a JSON object");
} else {
  for (const field of requiredFields) {
    if (!(field in request)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  for (const field of Object.keys(request)) {
    if (!allowedTopLevelFields.has(field)) {
      errors.push(`Unsupported request field: ${field}`);
    }
  }

  for (const field of [
    "request_id",
    "company_id",
    "homepage_type",
    "company_name",
    "industry",
    "business_type",
    "main_business_description",
  ]) {
    if (field in request && (typeof request[field] !== "string" || request[field].trim() === "")) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (
    typeof request.main_business_description === "string" &&
    request.main_business_description.length < 10
  ) {
    errors.push("main_business_description must be at least 10 characters");
  }

  if (typeof request.company_id === "string" && !companyIdPattern.test(request.company_id)) {
    errors.push("company_id may only contain letters, numbers, underscores, and hyphens");
  }

  if (!["company_intro", "product"].includes(request.homepage_type)) {
    errors.push("homepage_type must be company_intro or product");
  }

  if (
    "preferred_style" in request &&
    !["clean", "modern", "basic", "professional"].includes(request.preferred_style)
  ) {
    errors.push("preferred_style must be clean, modern, basic, or professional");
  }

  if ("core_strengths" in request) {
    if (!Array.isArray(request.core_strengths)) {
      errors.push("core_strengths must be an array");
    } else {
      if (request.core_strengths.length > 10) {
        errors.push("core_strengths must contain at most 10 items");
      }
      request.core_strengths.forEach((item, index) => {
        if (typeof item !== "string" || item.trim() === "") {
          errors.push(`core_strengths[${index}] must be a non-empty string`);
        }
      });
    }
  }

  if ("cover_image_url" in request && typeof request.cover_image_url !== "string") {
    errors.push("cover_image_url must be a string");
  }

  if ("tags" in request) {
    if (!Array.isArray(request.tags)) {
      errors.push("tags must be an array");
    } else {
      if (request.tags.length > 12) {
        errors.push("tags must contain at most 12 items");
      }
      request.tags.forEach((item, index) => {
        if (typeof item !== "string" || item.trim() === "") {
          errors.push(`tags[${index}] must be a non-empty string`);
        }
      });
    }
  }

  if ("contact" in request) validateContact(request.contact, errors);
  if ("products" in request) validateProducts(request.products, errors);
  if ("history" in request) validateHistory(request.history, errors);
  if ("portfolio" in request) validatePortfolio(request.portfolio, errors);
  if ("section_visibility" in request) validateSectionVisibility(request.section_visibility, errors);
  if ("section_layout" in request) validateSectionLayout(request.section_layout, errors);
  if ("design_tokens" in request) validateDesignTokens(request.design_tokens, errors);
  if ("section_order" in request) validateSectionOrder(request.section_order, errors);
  if ("block_overrides" in request) validateBlockOverrides(request.block_overrides, errors);
  if (
    "content_density" in request &&
    !["compact", "standard", "rich"].includes(request.content_density)
  ) {
    errors.push("content_density must be compact, standard, or rich");
  }
  if (
    "content_source" in request &&
    !["request_only", "ai_suggested", "ai_suggested_user_confirmed"].includes(
      request.content_source,
    )
  ) {
    errors.push("content_source must be request_only, ai_suggested, or ai_suggested_user_confirmed");
  }
  if ("content_draft" in request) validateContentDraft(request.content_draft, errors);
  if ("draft_id" in request && typeof request.draft_id !== "string") {
    errors.push("draft_id must be a string");
  }
  if ("confirmed_at" in request && typeof request.confirmed_at !== "string") {
    errors.push("confirmed_at must be a string");
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ passed: true, errors: [] }, null, 2));

function validateProducts(products, outputErrors) {
  if (!Array.isArray(products)) {
    outputErrors.push("products must be an array");
    return;
  }

  products.forEach((product, index) => {
    if (!product || typeof product !== "object" || Array.isArray(product)) {
      outputErrors.push(`products[${index}] must be an object`);
      return;
    }

    const allowedFields = new Set(["name", "description", "image_url"]);
    for (const field of Object.keys(product)) {
      if (!allowedFields.has(field)) {
        outputErrors.push(`products[${index}] has unsupported field: ${field}`);
      }
    }

    if (typeof product.name !== "string" || product.name.trim() === "") {
      outputErrors.push(`products[${index}].name must be a non-empty string`);
    }
    if ("description" in product && typeof product.description !== "string") {
      outputErrors.push(`products[${index}].description must be a string`);
    }
    if ("image_url" in product && typeof product.image_url !== "string") {
      outputErrors.push(`products[${index}].image_url must be a string`);
    }
  });
}

function validateContact(contact, outputErrors) {
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    outputErrors.push("contact must be an object");
    return;
  }

  const allowedFields = new Set(["address", "phone", "email", "website_url"]);
  for (const field of Object.keys(contact)) {
    if (!allowedFields.has(field)) {
      outputErrors.push(`contact has unsupported field: ${field}`);
    }
    if (typeof contact[field] !== "string") {
      outputErrors.push(`contact.${field} must be a string`);
    }
  }
}

function validateContentDraft(contentDraft, outputErrors) {
  if (!contentDraft || typeof contentDraft !== "object" || Array.isArray(contentDraft)) {
    outputErrors.push("content_draft must be an object");
    return;
  }

  const allowedFields = new Set([
    "hero_title",
    "one_line_intro",
    "company_intro",
    "business_summary",
    "core_strengths",
    "tags",
    "section_visibility",
    "section_layout",
    "content_density",
    "design_tokens",
    "section_order",
    "block_overrides",
    "hero_image_theme",
    "hero_image_keywords",
    "cta_text",
  ]);
  for (const field of Object.keys(contentDraft)) {
    if (!allowedFields.has(field)) {
      outputErrors.push(`content_draft has unsupported field: ${field}`);
    }
  }

  for (const field of [
    "hero_title",
    "one_line_intro",
    "company_intro",
    "business_summary",
    "hero_image_theme",
    "cta_text",
  ]) {
    if (field in contentDraft && typeof contentDraft[field] !== "string") {
      outputErrors.push(`content_draft.${field} must be a string`);
    }
  }

  if ("core_strengths" in contentDraft) {
    if (!Array.isArray(contentDraft.core_strengths)) {
      outputErrors.push("content_draft.core_strengths must be an array");
    } else {
      if (contentDraft.core_strengths.length > 10) {
        outputErrors.push("content_draft.core_strengths must contain at most 10 items");
      }
      contentDraft.core_strengths.forEach((item, index) => {
        if (typeof item !== "string" || item.trim() === "") {
          outputErrors.push(`content_draft.core_strengths[${index}] must be a non-empty string`);
        }
      });
    }
  }

  if ("tags" in contentDraft) {
    if (!Array.isArray(contentDraft.tags)) {
      outputErrors.push("content_draft.tags must be an array");
    } else if (contentDraft.tags.length > 12) {
      outputErrors.push("content_draft.tags must contain at most 12 items");
    }
  }

  if ("hero_image_keywords" in contentDraft) {
    if (!Array.isArray(contentDraft.hero_image_keywords)) {
      outputErrors.push("content_draft.hero_image_keywords must be an array");
    } else if (contentDraft.hero_image_keywords.length > 8) {
      outputErrors.push("content_draft.hero_image_keywords must contain at most 8 items");
    }
  }

  if ("section_visibility" in contentDraft) {
    validateSectionVisibility(contentDraft.section_visibility, outputErrors, "content_draft.");
  }
  if ("section_layout" in contentDraft) {
    validateSectionLayout(contentDraft.section_layout, outputErrors, "content_draft.");
  }
  if ("design_tokens" in contentDraft) {
    validateDesignTokens(contentDraft.design_tokens, outputErrors, "content_draft.");
  }
  if ("section_order" in contentDraft) {
    validateSectionOrder(contentDraft.section_order, outputErrors, "content_draft.");
  }
  if ("block_overrides" in contentDraft) {
    validateBlockOverrides(contentDraft.block_overrides, outputErrors, "content_draft.");
  }
  if (
    "content_density" in contentDraft &&
    !["compact", "standard", "rich"].includes(contentDraft.content_density)
  ) {
    outputErrors.push("content_draft.content_density must be compact, standard, or rich");
  }
}

function validateHistory(history, outputErrors) {
  if (!Array.isArray(history)) {
    outputErrors.push("history must be an array");
    return;
  }

  history.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      outputErrors.push(`history[${index}] must be an object`);
      return;
    }
    if (typeof item.year !== "string" || item.year.trim() === "") {
      outputErrors.push(`history[${index}].year must be a non-empty string`);
    }
    if (typeof item.text !== "string" || item.text.trim() === "") {
      outputErrors.push(`history[${index}].text must be a non-empty string`);
    }
  });
}

function validatePortfolio(portfolio, outputErrors) {
  if (!Array.isArray(portfolio)) {
    outputErrors.push("portfolio must be an array");
    return;
  }

  portfolio.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      outputErrors.push(`portfolio[${index}] must be an object`);
    }
  });
}

function validateSectionVisibility(sectionVisibility, outputErrors) {
  if (!sectionVisibility || typeof sectionVisibility !== "object" || Array.isArray(sectionVisibility)) {
    outputErrors.push("section_visibility must be an object");
    return;
  }

  for (const [section, visible] of Object.entries(sectionVisibility)) {
    if (!allowedVisibilitySections.has(section)) {
      outputErrors.push(`section_visibility has unsupported section: ${section}`);
      continue;
    }
    if (typeof visible !== "boolean") {
      outputErrors.push(`section_visibility.${section} must be a boolean`);
    }
    if (visible === false && requiredVisibleSections.has(section)) {
      outputErrors.push(`section_visibility.${section} cannot be false`);
    }
  }
}

function validateSectionLayout(sectionLayout, outputErrors) {
  if (!sectionLayout || typeof sectionLayout !== "object" || Array.isArray(sectionLayout)) {
    outputErrors.push("section_layout must be an object");
    return;
  }

  for (const [section, layout] of Object.entries(sectionLayout)) {
    const allowed = allowedLayoutValues[section];
    if (!allowed) {
      outputErrors.push(`section_layout has unsupported section: ${section}`);
      continue;
    }
    if (typeof layout !== "string" || !allowed.has(layout)) {
      outputErrors.push(`section_layout.${section} has unsupported layout: ${layout}`);
    }
  }
}

function validateDesignTokens(designTokens, outputErrors, prefix = "") {
  if (!designTokens || typeof designTokens !== "object" || Array.isArray(designTokens)) {
    outputErrors.push(`${prefix}design_tokens must be an object`);
    return;
  }

  const allowedFields = new Set(["primary", "accent", "radius"]);
  for (const [field, value] of Object.entries(designTokens)) {
    if (!allowedFields.has(field)) {
      outputErrors.push(`${prefix}design_tokens has unsupported field: ${field}`);
      continue;
    }
    if ((field === "primary" || field === "accent") && !allowedDesignColors.includes(value)) {
      outputErrors.push(`${prefix}design_tokens.${field} must be an allowed palette value`);
    }
    if (field === "radius" && !allowedRadii.includes(value)) {
      outputErrors.push(`${prefix}design_tokens.radius has unsupported value: ${value}`);
    }
  }
}

function validateSectionOrder(sectionOrder, outputErrors, prefix = "") {
  if (!Array.isArray(sectionOrder)) {
    outputErrors.push(`${prefix}section_order must be an array`);
    return;
  }
  const seen = new Set();
  sectionOrder.forEach((section, index) => {
    if (!sectionIds.includes(section)) {
      outputErrors.push(`${prefix}section_order[${index}] has unsupported section: ${section}`);
    }
    if (seen.has(section)) {
      outputErrors.push(`${prefix}section_order contains duplicate section: ${section}`);
    }
    seen.add(section);
  });
}

function validateBlockOverrides(blockOverrides, outputErrors, prefix = "") {
  if (!blockOverrides || typeof blockOverrides !== "object" || Array.isArray(blockOverrides)) {
    outputErrors.push(`${prefix}block_overrides must be an object`);
    return;
  }
  for (const [section, override] of Object.entries(blockOverrides)) {
    if (!sectionIds.includes(section)) {
      outputErrors.push(`${prefix}block_overrides has unsupported section: ${section}`);
      continue;
    }
    if (!override || typeof override !== "object" || Array.isArray(override)) {
      outputErrors.push(`${prefix}block_overrides.${section} must be an object`);
      continue;
    }
    for (const [field, value] of Object.entries(override)) {
      if (field !== "emphasis") {
        outputErrors.push(`${prefix}block_overrides.${section} has unsupported field: ${field}`);
        continue;
      }
      if (!allowedBlockEmphasis.includes(value)) {
        outputErrors.push(`${prefix}block_overrides.${section}.emphasis has unsupported value: ${value}`);
      }
    }
  }
}
