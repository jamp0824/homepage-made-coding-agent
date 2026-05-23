import {
  defaultDesignTokens,
  defaultSectionLayout,
  normalizeBlockOverrides,
  normalizeDesignTokens,
  resolveSectionOrder,
} from "./homepage-controls.mjs";

export function draftToViewModel(draft) {
  return {
    homepageType: draft.homepage_type,
    companyName: draft.company_name,
    industry: draft.industry,
    businessType: draft.business_type,
    heroTitle: draft.one_line_intro || draft.company_name,
    oneLineIntro: draft.one_line_intro,
    companyIntro: draft.company_intro,
    businessSummary: draft.main_business_description,
    coreStrengths: Array.isArray(draft.core_strengths) ? draft.core_strengths : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    contactCta: `${draft.company_name || "해당 기업"}의 사업과 서비스가 궁금하시다면 문의해 주세요.`,
    contact: draft.contact || {},
    history: Array.isArray(draft.history) ? draft.history : [],
    portfolio: Array.isArray(draft.portfolio) ? draft.portfolio : [],
    products: Array.isArray(draft.products) ? draft.products : [],
    productRegistrationCta: "홈페이지에 표시할 상품 정보를 등록하면 상품 영역을 구성할 수 있습니다.",
    coverImageUrl: draft.cover_image_url || "",
    sectionVisibility: draft.section_visibility || {},
    sectionLayout: draft.section_layout || {},
    contentDensity: draft.content_density || "standard",
    designTokens: draft.design_tokens,
    sectionOrder: draft.section_order,
    blockOverrides: draft.block_overrides,
  };
}

export function contentToViewModel(content) {
  const visibleSections = new Set(Array.isArray(content.sections) ? content.sections : []);
  const manifestVisibility = Array.isArray(content.section_manifest)
    ? Object.fromEntries(content.section_manifest.map((section) => [section.id, section.visible]))
    : {};
  return {
    homepageType: content.homepage_type,
    companyName: content.company_name,
    industry: content.industry,
    businessType: content.business_type,
    heroTitle: content.hero_title || content.one_line_intro || content.company_name,
    oneLineIntro: content.one_line_intro,
    companyIntro: content.company_intro,
    businessSummary: content.business_summary,
    coreStrengths: Array.isArray(content.core_strengths) ? content.core_strengths : [],
    tags: Array.isArray(content.tags) ? content.tags : [],
    contactCta: content.contact_cta || `${content.company_name || "해당 기업"}의 사업과 서비스가 궁금하시다면 문의해 주세요.`,
    contact: content.contact || {},
    history: Array.isArray(content.history) ? content.history : [],
    portfolio: Array.isArray(content.portfolio) ? content.portfolio : [],
    products: Array.isArray(content.products) ? content.products : [],
    productRegistrationCta: content.product_registration_cta || "",
    coverImageUrl: content.cover_image_url || "",
    sectionVisibility:
      visibleSections.size > 0
        ? Object.fromEntries(resolveSectionOrder(content.section_order, content.homepage_type).map((section) => [section, visibleSections.has(section)]))
        : { ...manifestVisibility, ...(content.section_visibility || {}) },
    sectionLayout: content.section_layout || {},
    contentDensity: content.content_density || "standard",
    designTokens: content.design_tokens,
    sectionOrder: content.section_order || content.sections,
    blockOverrides: content.block_overrides,
  };
}

export function resolveViewModel(model) {
  const homepageType = model.homepageType === "product" ? "product" : "company_intro";
  const products = Array.isArray(model.products) ? model.products : [];
  const history = Array.isArray(model.history) ? model.history : [];
  const portfolio = Array.isArray(model.portfolio) ? model.portfolio : [];
  const contact = model.contact || {};
  const sectionLayout = {
    ...defaultSectionLayout[homepageType],
    ...(model.sectionLayout || {}),
  };
  const sectionVisibility = {
    company_summary: true,
    contact_info: Object.values(contact).some(Boolean),
    company_intro: true,
    core_strengths: true,
    history: history.length > 0,
    portfolio: portfolio.length > 0,
    featured_products: homepageType === "company_intro" && products.length > 0,
    product_area: homepageType === "product" && products.length > 0,
    product_registration_cta: homepageType === "product" && products.length === 0,
    contact_cta: true,
    ...(model.sectionVisibility || {}),
  };

  if (history.length === 0) sectionVisibility.history = false;
  if (portfolio.length === 0) sectionVisibility.portfolio = false;
  if (products.length === 0) {
    sectionVisibility.featured_products = false;
    sectionVisibility.product_area = false;
  }
  if (homepageType !== "product") sectionVisibility.product_registration_cta = false;
  if (homepageType === "product") sectionVisibility.featured_products = false;
  sectionVisibility.company_intro = true;
  sectionVisibility.core_strengths = true;
  sectionVisibility.contact_cta = true;

  return {
    ...model,
    homepageType,
    companyName: model.companyName || "",
    industry: model.industry || "",
    businessType: model.businessType || "",
    heroTitle: model.heroTitle || model.oneLineIntro || model.companyName || "",
    oneLineIntro: model.oneLineIntro || "",
    companyIntro: model.companyIntro || "",
    businessSummary: model.businessSummary || "",
    coreStrengths: Array.isArray(model.coreStrengths) ? model.coreStrengths : [],
    tags: Array.isArray(model.tags) ? model.tags : [],
    contactCta: model.contactCta || "",
    contact,
    history,
    portfolio,
    products,
    productRegistrationCta: model.productRegistrationCta || "",
    coverImageUrl: model.coverImageUrl || "",
    sectionVisibility,
    sectionLayout,
    contentDensity: model.contentDensity || "standard",
    designTokens: {
      ...defaultDesignTokens,
      ...normalizeDesignTokens(model.designTokens),
    },
    sectionOrder: resolveSectionOrder(model.sectionOrder, homepageType),
    blockOverrides: normalizeBlockOverrides(model.blockOverrides),
  };
}
