import React from "react";
import { resolveViewModel } from "./homepage-view-model.mjs";

const h = React.createElement;

export function HomepageView({ model, mode = "final" }) {
  const m = resolveViewModel(model);
  return h(
    "main",
    {
      className: "hv-page",
      "data-mode": mode,
      "data-density": m.contentDensity,
      "data-radius": m.designTokens.radius,
      style: {
        "--hv-primary": m.designTokens.primary,
        "--hv-accent": m.designTokens.accent,
      },
    },
    h(Header, { model: m }),
    m.sectionOrder
      .filter((section) => m.sectionVisibility[section] !== false)
      .map((section) => renderSection(section, m)),
  );
}

function Header({ model }) {
  return h(
    "header",
    { className: "hv-nav", "aria-label": "생성 홈페이지 탐색" },
    h("div", { className: "hv-brand-mark", "aria-hidden": "true" }, "H"),
    h(
      "nav",
      { "aria-label": "페이지 섹션" },
      h("a", { href: "#company" }, "기업"),
      model.products.length > 0 ? h("a", { href: "#products" }, "상품") : null,
      h("a", { href: "#contact" }, "문의"),
    ),
  );
}

function renderSection(section, model) {
  switch (section) {
    case "hero":
      return h(HeroSection, { key: section, model });
    case "company_summary":
      return h(SummarySection, { key: section, model });
    case "contact_info":
      return h(ContactInfoSection, { key: section, model });
    case "company_intro":
      return h(TextSection, { key: section, id: "company", section, label: "Company", title: "기업 소개", body: model.companyIntro, model });
    case "core_strengths":
      return h(StrengthsSection, { key: section, model });
    case "history":
      return h(HistorySection, { key: section, model });
    case "portfolio":
      return h(PortfolioSection, { key: section, model });
    case "featured_products":
    case "product_area":
      return h(ProductsSection, { key: section, section, model });
    case "product_registration_cta":
      return h(TextSection, {
        key: section,
        section,
        label: "Products",
        title: "상품 안내",
        body: model.productRegistrationCta,
        model,
      });
    case "contact_cta":
      return h(TextSection, { key: section, id: "contact", section, title: "문의하기", body: model.contactCta, model, contact: true });
    default:
      return null;
  }
}

function HeroSection({ model }) {
  return h(
    "section",
    { className: "hv-cover", "data-section": "hero" },
    model.coverImageUrl ? h("img", { src: model.coverImageUrl, alt: "" }) : h("div", { className: "hv-cover-fallback", "aria-hidden": "true" }),
  );
}

function SummarySection({ model }) {
  const tags = [...model.tags, model.businessType].filter(Boolean);
  return h(
    "section",
    { className: sectionClass(model, "company_summary", "hv-summary"), "data-section": "company_summary" },
    model.industry ? h("p", { className: "hv-eyebrow" }, model.industry) : null,
    h("h1", null, model.companyName),
    h("p", null, model.oneLineIntro),
    tags.length > 0
      ? h("div", { className: "hv-tag-row" }, tags.map((tag) => h("span", { key: tag }, tag)))
      : null,
    h(
      "div",
      { className: "hv-meta-row" },
      h("span", null, model.homepageType === "product" ? "상품중심형" : "회사소개중심형"),
      model.products.length > 0 ? h("span", null, `상품 ${model.products.length}개`) : null,
    ),
  );
}

function ContactInfoSection({ model }) {
  const entries = Object.entries(model.contact || {}).filter(([, value]) => Boolean(value));
  if (entries.length === 0) return null;
  return h(
    "section",
    { className: sectionClass(model, "contact_info"), "data-section": "contact_info" },
    h("div", { className: "hv-section-label" }, "Info"),
    h("h2", null, "기업 정보"),
    h(
      "dl",
      { className: "hv-meta-list" },
      entries.map(([key, value]) =>
        h("div", { key }, h("dt", null, contactLabel(key)), h("dd", null, value)),
      ),
    ),
  );
}

function TextSection({ id, section, label, title, body, model, contact = false }) {
  return h(
    "section",
    { id, className: sectionClass(model, section, contact ? "hv-contact" : ""), "data-section": section },
    label ? h("div", { className: "hv-section-label" }, label) : null,
    h("h2", null, title),
    body ? h("p", null, body) : null,
  );
}

function StrengthsSection({ model }) {
  const listClass = model.sectionLayout.core_strengths === "list" ? "hv-strength-list hv-strength-list-single" : "hv-strength-list";
  return h(
    "section",
    { className: sectionClass(model, "core_strengths", "hv-strength-section"), "data-section": "core_strengths" },
    h("div", { className: "hv-section-label" }, "Strengths"),
    h("h2", null, "핵심 강점"),
    h("ul", { className: listClass }, model.coreStrengths.map((item) => h("li", { key: item }, item))),
  );
}

function HistorySection({ model }) {
  const className = model.sectionLayout.history === "compact" ? "hv-timeline hv-timeline-compact" : "hv-timeline";
  return h(
    "section",
    { className: sectionClass(model, "history"), "data-section": "history" },
    h("div", { className: "hv-section-label" }, "History"),
    h("h2", null, "연혁"),
    h(
      "ol",
      { className },
      model.history.map((item) => h("li", { key: `${item.year}-${item.text}` }, h("strong", null, item.year), h("span", null, item.text))),
    ),
  );
}

function PortfolioSection({ model }) {
  const className = model.sectionLayout.portfolio === "list" ? "hv-card-grid hv-card-list" : "hv-card-grid";
  return h(
    "section",
    { className: sectionClass(model, "portfolio"), "data-section": "portfolio" },
    h("div", { className: "hv-section-label" }, "Portfolio"),
    h("h2", null, "포트폴리오"),
    h(
      "div",
      { className },
      model.portfolio.map((item) =>
        h("article", { className: "hv-item-card", key: item.title || item.description }, h("h3", null, item.title), h("p", null, item.description)),
      ),
    ),
  );
}

function ProductsSection({ section, model }) {
  const layout = model.sectionLayout[section] || model.sectionLayout.featured_products || model.sectionLayout.product_area;
  const className = layout === "grid_3" ? "hv-product-grid hv-product-grid-3" : "hv-product-grid";
  return h(
    "section",
    { id: "products", className: sectionClass(model, section), "data-section": section },
    h("div", { className: "hv-section-label" }, "Products"),
    h("h2", null, "주요 상품 ", h("span", { className: "hv-count-badge" }, model.products.length)),
    h(
      "div",
      { className },
      model.products.map((product) =>
        h(
          "article",
          { className: "hv-product-card", key: product.name },
          h(
            "div",
            { className: "hv-product-image-frame" },
            product.image_url ? h("img", { src: product.image_url, alt: "" }) : h("div", { className: "hv-product-image-fallback", "aria-hidden": "true" }),
          ),
          h("h3", null, product.name),
          product.description ? h("p", null, product.description) : null,
          h("span", { className: "hv-product-cta" }, "견적요청"),
        ),
      ),
    ),
  );
}

function sectionClass(model, section, extra = "") {
  const emphasis = model.blockOverrides?.[section]?.emphasis === "strong" ? " hv-section-strong" : "";
  return `hv-section${emphasis}${extra ? ` ${extra}` : ""}`;
}

function contactLabel(key) {
  return (
    {
      address: "주소",
      phone: "전화",
      email: "이메일",
      website_url: "웹사이트",
    }[key] || key
  );
}
