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
