import { notFound } from "next/navigation";
import {
  getGeneratedCompanyIds,
  readGeneratedSite,
  type GeneratedContent,
} from "../../../lib/generated-sites";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

export function generateStaticParams() {
  return getGeneratedCompanyIds().map((companyId) => ({ companyId }));
}

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const site = readGeneratedSite(companyId);

  if (!site) {
    return {
      title: "Generated homepage not found",
    };
  }

  return {
    title: site.content.company_name,
    description: site.content.one_line_intro,
  };
}

export default async function GeneratedHomepagePage({ params }: PageProps) {
  const { companyId } = await params;
  const site = readGeneratedSite(companyId);

  if (!site) notFound();

  const { content } = site;
  const typeLabel = content.homepage_type === "product" ? "상품중심형" : "회사소개중심형";
  const isResultStyle = content.template_variant === "result_style_v1";

  if (isResultStyle) {
    return renderResultStyleHomepage(content);
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top">
          {content.company_name}
        </a>
        <nav aria-label="주요 섹션">
          <a href="#intro">회사 소개</a>
          <a href="#strengths">핵심 강점</a>
          <a href="#contact">문의</a>
        </nav>
      </header>

      <main id="top" className="homepage">
        <section className="hero" data-section="hero">
          <div className="eyebrow">
            {typeLabel} · {site.metadata.homepage_type}
          </div>
          <h1>{content.hero_title}</h1>
          <p>{content.one_line_intro}</p>
        </section>

        <section id="intro" className="section" data-section="company_intro">
          <div className="section-label">Company</div>
          <h2>회사 소개</h2>
          <p>{content.company_intro}</p>
          <dl className="facts">
            <div>
              <dt>템플릿</dt>
              <dd>{content.template_id}</dd>
            </div>
            <div>
              <dt>생성 상태</dt>
              <dd>{site.result.status}</dd>
            </div>
          </dl>
        </section>

        <section id="strengths" className="section" data-section="core_strengths">
          <div className="section-label">Strengths</div>
          <h2>핵심 강점</h2>
          <ul className="strength-list">
            {content.core_strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {renderTypeSection(content)}

        {content.history.length > 0 ? (
          <section className="section" data-section="history">
            <div className="section-label">History</div>
            <h2>연혁</h2>
            <div className="item-grid">
              {content.history.map((item) => (
                <article className="item-card" key={`${item.year}-${item.text}`}>
                  <h3>{item.year}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {content.portfolio.length > 0 ? (
          <section className="section" data-section="portfolio">
            <div className="section-label">Portfolio</div>
            <h2>포트폴리오</h2>
            <div className="item-grid">
              {content.portfolio.map((item) => (
                <article className="item-card" key={item.title ?? item.description}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section id="contact" className="contact" data-section="contact_cta">
          <h2>문의하기</h2>
          <p>{content.contact_cta}</p>
        </section>
      </main>
    </>
  );
}

function renderResultStyleHomepage(content: GeneratedContent) {
  const contactEntries = Object.entries(content.contact || {}).filter(([, value]) => Boolean(value));
  const tags = [...(content.tags || []), content.business_type].filter(Boolean);
  const productCount = content.products.length;
  const visibleSections = new Set(content.sections || []);
  const sectionLayout = content.section_layout || {};
  const strengthClassName =
    sectionLayout.core_strengths === "list" ? "strength-list strength-list-single" : "strength-list";
  const historyClassName =
    sectionLayout.history === "compact" ? "profile-timeline profile-timeline-compact" : "profile-timeline";
  const portfolioClassName =
    sectionLayout.portfolio === "list" ? "item-grid item-grid-list" : "item-grid";
  const productClassName =
    sectionLayout.featured_products === "grid_3" ? "product-card-list product-card-list-3" : "product-card-list";

  return (
    <main
      className="homepage profile-page"
      data-content-density={content.content_density || "standard"}
      data-template={content.template_id}
      data-template-variant={content.template_variant}
    >
      <header className="profile-nav" aria-label="생성 홈페이지 탐색">
        <div className="profile-brand-mark" aria-hidden="true">H</div>
        <nav aria-label="페이지 섹션">
          <a href="#company">기업</a>
          {productCount > 0 ? <a href="#products">상품</a> : null}
          <a href="#contact">문의</a>
        </nav>
      </header>

      <div className="profile-action-row">
        <a className="profile-back-link" href="/">← 뒤로</a>
      </div>

      <article className="profile-hero-card">
        <section className="profile-cover" data-section="hero">
          {content.cover_image_url ? <img src={content.cover_image_url} alt="" /> : <div className="cover-fallback" aria-hidden="true" />}
        </section>

        {visibleSections.has("company_summary") ? (
          <section className="profile-summary" data-section="company_summary">
            <p className="eyebrow">{content.industry || "회사소개중심형"}</p>
            <div className="profile-title-row">
              <h1>{content.company_name}</h1>
            </div>
            <p>{content.one_line_intro}</p>
            <div className="tag-row">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="profile-meta-row">
              <span>회사소개중심형</span>
              {productCount > 0 ? <span>상품 {productCount}개</span> : null}
            </div>
          </section>
        ) : null}
      </article>

      {contactEntries.length > 0 && visibleSections.has("contact_info") ? (
        <section className="section info-card profile-info-card" data-section="contact_info">
          <div className="section-label">Info</div>
          <h2>기업 정보</h2>
          <dl className="meta-list">
            {contactEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{contactLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section id="company" className="section info-card" data-section="company_intro">
        <div className="section-label">Company</div>
        <h2>기업 소개</h2>
        <p>{content.company_intro}</p>
      </section>

      <section className="section info-card profile-strength-card" data-section="core_strengths">
        <div className="section-label">Strengths</div>
        <h2>핵심 강점</h2>
        <ul className={strengthClassName}>
          {content.core_strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {content.history.length > 0 && visibleSections.has("history") ? (
        <section className="section info-card" data-section="history">
          <div className="section-label">History</div>
          <h2>연혁</h2>
          <ol className={historyClassName}>
            {content.history.map((item) => (
              <li key={`${item.year}-${item.text}`}>
                <strong>{item.year}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {content.portfolio.length > 0 && visibleSections.has("portfolio") ? (
        <section className="section info-card" data-section="portfolio">
          <div className="section-label">Portfolio</div>
          <h2>포트폴리오</h2>
          <div className={portfolioClassName}>
            {content.portfolio.map((item) => (
              <article className="item-card portfolio-card" key={item.title ?? item.description}>
                <span className="card-icon" aria-hidden="true">□</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {content.products.length > 0 && visibleSections.has("featured_products") ? (
        <section id="products" className="section info-card" data-section="featured_products">
          <div className="section-label">Products</div>
          <h2>주요 상품 <span className="count-badge">{productCount}</span></h2>
          <div className={productClassName}>
            {content.products.map((product) => (
              <article className="item-card product-profile-card" key={product.name}>
                <div className="product-image-frame">
                  {product.image_url ? <img className="item-image" src={product.image_url} alt="" /> : <div className="product-image-fallback" aria-hidden="true" />}
                </div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <span className="product-cta">견적요청</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="contact" className="contact profile-contact-card" data-section="contact_cta">
        <h2>문의하기</h2>
        <p>{content.contact_cta}</p>
      </section>
    </main>
  );
}

function contactLabel(key: string) {
  return (
    {
      address: "주소",
      phone: "전화",
      email: "이메일",
      website_url: "웹사이트",
    }[key] || key
  );
}

function renderTypeSection(content: GeneratedContent) {
  if (content.homepage_type === "product") {
    const hasProducts = content.products.length > 0;

    return (
      <section
        className="section"
        data-section={hasProducts ? "product_area" : "product_registration_cta"}
      >
        <div className="section-label">Products</div>
        <h2>상품 안내</h2>
        <div className="item-grid">
          {hasProducts ? (
            content.products.map((product) => (
              <article className="item-card" key={product.name}>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
              </article>
            ))
          ) : (
            <div className="notice">{content.product_registration_cta}</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="section" data-section="business_summary">
      <div className="section-label">Business</div>
      <h2>사업 요약</h2>
      <p>{content.business_summary}</p>
    </section>
  );
}
