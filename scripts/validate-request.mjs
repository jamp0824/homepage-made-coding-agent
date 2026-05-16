#!/usr/bin/env node
import fs from "node:fs";

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
  "core_strengths",
  "products",
  "portfolio",
  "history",
  "preferred_style",
  "created_at",
]);
const companyIdPattern = /^[A-Za-z0-9_-]+$/;

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

  if ("products" in request) validateProducts(request.products, errors);
  if ("history" in request) validateHistory(request.history, errors);
  if ("portfolio" in request) validatePortfolio(request.portfolio, errors);
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
