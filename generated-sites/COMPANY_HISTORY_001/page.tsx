// Generated from company_intro_basic (result_style_v1). Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import assets from "./assets.json";

const contactLabels = {
  address: "주소",
  phone: "전화",
  email: "이메일",
  website_url: "웹사이트",
};

export default function GeneratedHomepage() {
  const contactEntries = Object.entries(content.contact || {});
  const hasCoverImage = Boolean(content.cover_image_url);
  const productCount = content.products.length;

  return (
    <main className="profile-page" data-template={content.template_id} data-template-variant={content.template_variant} data-asset-theme={assets.asset_theme}>
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
        <div className="profile-actions" aria-label="페이지 액션">
          <button type="button" aria-label="좋아요">♡</button>
          <button type="button" aria-label="공유">↗</button>
        </div>
      </div>
      <article className="profile-hero-card">
        <section className="profile-cover" data-section="hero">
          {hasCoverImage ? <img src={content.cover_image_url} alt="" /> : <div className="cover-fallback" aria-hidden="true" />}
        </section>
        <section className="profile-summary" data-section="company_summary">
          <p className="eyebrow">{content.industry}</p>
          <div className="profile-title-row">
            <h1>{content.company_name}</h1>
            <span>generated</span>
          </div>
          <p>{content.one_line_intro}</p>
          <div className="tag-row">
            {content.tags.map((tag) => <span key={tag}>{tag}</span>)}
            <span>{content.business_type}</span>
          </div>
          <div className="profile-meta-row">
            <span>회사소개중심형</span>
            {productCount > 0 ? <span>상품 {productCount}개</span> : null}
          </div>
        </section>
      </article>
      {contactEntries.length > 0 ? (
        <section className="info-card profile-info-card" data-section="contact_info">
          <h2>기업 정보</h2>
          <dl className="contact-list">
            {contactEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{contactLabels[key] || key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      <section id="company" className="info-card" data-section="company_intro">
        <h2>기업 소개</h2>
        <p>{content.company_intro}</p>
      </section>
      <section className="info-card profile-strength-card" data-section="core_strengths">
        <h2>핵심 강점</h2>
        <ul className="strength-grid">
          {content.core_strengths.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      {content.history.length > 0 ? (
        <section className="info-card" data-section="history">
          <h2>연혁</h2>
          <ol className="timeline">
            {content.history.map((item) => <li key={item.year + item.text}><strong>{item.year}</strong><span>{item.text}</span></li>)}
          </ol>
        </section>
      ) : null}
      {content.portfolio.length > 0 ? (
        <section className="info-card" data-section="portfolio">
          <h2>포트폴리오</h2>
          <div className="card-grid">
            {content.portfolio.map((item) => <article className="portfolio-card" key={item.title || item.description}><span className="card-icon" aria-hidden="true">□</span><h3>{item.title}</h3><p>{item.description}</p></article>)}
          </div>
        </section>
      ) : null}
      {content.products.length > 0 ? (
        <section id="products" className="info-card" data-section="featured_products">
          <h2>주요 상품 <span className="count-badge">{productCount}</span></h2>
          <div className="product-card-list">
            {content.products.map((product) => (
              <article className="product-profile-card" key={product.name}>
                <div className="product-image-frame">
                  {product.image_url ? <img src={product.image_url} alt="" /> : <div className="product-image-fallback" aria-hidden="true" />}
                </div>
                <div><h3>{product.name}</h3><p>{product.description}</p></div>
                <span className="product-cta">견적요청</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section id="contact" className="contact-cta profile-contact-card" data-section="contact_cta">
        <h2>문의하기</h2>
        <p>{content.contact_cta}</p>
      </section>
    </main>
  );
}
