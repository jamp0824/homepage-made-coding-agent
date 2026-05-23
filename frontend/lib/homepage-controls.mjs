export const homepageTypes = ["company_intro", "product"];
export const contentDensities = ["compact", "standard", "rich"];

export const sectionIds = [
  "hero",
  "company_summary",
  "company_intro",
  "core_strengths",
  "contact_info",
  "history",
  "portfolio",
  "featured_products",
  "product_area",
  "product_registration_cta",
  "contact_cta",
];

export const requiredVisibleSections = ["company_intro", "core_strengths", "contact_cta"];

export const allowedVisibilitySections = sectionIds.filter((section) => section !== "hero");

export const allowedLayouts = {
  core_strengths: ["list", "grid_2"],
  history: ["timeline", "compact"],
  portfolio: ["list", "grid_2"],
  featured_products: ["grid_2", "grid_3"],
  product_area: ["grid_2", "grid_3"],
};

export const defaultSectionLayout = {
  company_intro: {
    core_strengths: "grid_2",
    history: "timeline",
    portfolio: "grid_2",
    featured_products: "grid_2",
  },
  product: {
    core_strengths: "grid_2",
    product_area: "grid_2",
  },
};

export const allowedDesignColors = [
  "#2f6fed",
  "#12a37f",
  "#4f7fe8",
  "#264f9d",
  "#0f766e",
  "#334155",
];

export const defaultDesignTokens = {
  primary: "#2f6fed",
  accent: "#12a37f",
  radius: "md",
};

export const allowedRadii = ["none", "sm", "md", "lg"];
export const allowedBlockEmphasis = ["default", "strong"];

export const forbiddenPhrases = [
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

export function isHomepageType(value) {
  return homepageTypes.includes(value);
}

export function isContentDensity(value) {
  return contentDensities.includes(value);
}

export function isAllowedVisibilitySection(value) {
  return allowedVisibilitySections.includes(value);
}

export function isRequiredVisibleSection(value) {
  return requiredVisibleSections.includes(value);
}

export function isSectionId(value) {
  return sectionIds.includes(value);
}

export function isAllowedLayout(section, value) {
  return Array.isArray(allowedLayouts[section]) && allowedLayouts[section].includes(value);
}

export function hasForbiddenPhrase(value) {
  return forbiddenPhrases.some((phrase) => String(value || "").includes(phrase));
}

export function defaultSectionOrder(model) {
  if (model?.homepageType === "product" || model?.homepage_type === "product") {
    return ["hero", "company_intro", "core_strengths", "product_area", "product_registration_cta", "contact_cta"];
  }
  return [
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
}

export function normalizeDesignTokens(value) {
  const tokens = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return tokens;
  if (allowedDesignColors.includes(value.primary)) tokens.primary = value.primary;
  if (allowedDesignColors.includes(value.accent)) tokens.accent = value.accent;
  if (allowedRadii.includes(value.radius)) tokens.radius = value.radius;
  return tokens;
}

export function normalizeSectionOrder(value, homepageType) {
  const defaults = defaultSectionOrder({ homepageType });
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const ordered = [];
  for (const item of value) {
    if (!isSectionId(item) || seen.has(item)) continue;
    seen.add(item);
    ordered.push(item);
  }

  const allowedForType = new Set(defaults);
  return ordered.filter((section) => allowedForType.has(section));
}

export function resolveSectionOrder(value, homepageType) {
  const defaults = defaultSectionOrder({ homepageType });
  const normalized = normalizeSectionOrder(value, homepageType);
  if (normalized.length === 0) return defaults;
  const seen = new Set(normalized);
  return [...normalized, ...defaults.filter((section) => !seen.has(section))];
}

export function normalizeBlockOverrides(value) {
  const overrides = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return overrides;
  for (const [section, override] of Object.entries(value)) {
    if (!isSectionId(section) || !override || typeof override !== "object" || Array.isArray(override)) continue;
    if (allowedBlockEmphasis.includes(override.emphasis)) {
      overrides[section] = { emphasis: override.emphasis };
    }
  }
  return overrides;
}

export function normalizeSectionVisibility(value, sectionHasData = () => true) {
  const visibility = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return visibility;
  for (const [section, visible] of Object.entries(value)) {
    if (!isAllowedVisibilitySection(section) || typeof visible !== "boolean") continue;
    if (isRequiredVisibleSection(section) && visible === false) continue;
    if (visible === true && !sectionHasData(section)) continue;
    visibility[section] = visible;
  }
  return visibility;
}

export function normalizeSectionLayout(value) {
  const layout = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return layout;
  for (const [section, variant] of Object.entries(value)) {
    if (isAllowedLayout(section, variant)) layout[section] = variant;
  }
  return layout;
}
