// Generated from product_basic. Do not edit outside generated-sites/{company_id}.
import content from "./content.json";
import assets from "./assets.json";

export default function GeneratedHomepage() {
  return (
    <main data-template="product_basic" data-asset-theme={assets.asset_theme}>
      <section data-section="hero"><h1>{content.hero_title}</h1><p>{content.one_line_intro}</p></section>
      <section data-section="company_intro"><h2>회사 소개</h2><p>{content.company_intro}</p></section>
      <section data-section="core_strengths"><h2>핵심 강점</h2><ul>{content.core_strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section data-section="product_registration_cta"><h2>상품 안내</h2>{content.products.length > 0 ? content.products.map((product) => <article key={product.name}><h3>{product.name}</h3><p>{product.description}</p></article>) : <p>{content.product_registration_cta}</p>}</section>
      <section data-section="contact_cta"><h2>문의하기</h2><p>{content.contact_cta}</p></section>
    </main>
  );
}
