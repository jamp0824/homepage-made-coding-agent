// Company Intro Basic page template placeholder
// Codex/Goose should generate generated-sites/{company_id}/page.tsx using this structure.

export default function CompanyIntroPage({ content, assets }: { content: any; assets: any }) {
  return (
    <main>
      <section data-section="hero">
        <h1>{content.hero_title}</h1>
        <p>{content.one_line_intro}</p>
      </section>
      <section data-section="company_intro">
        <h2>회사 소개</h2>
        <p>{content.company_intro}</p>
      </section>
      <section data-section="core_strengths">
        <h2>핵심 강점</h2>
        <ul>
          {content.core_strengths?.map((item: string) => <li key={item}>{item}</li>)}
        </ul>
      </section>
      <section data-section="contact_cta">
        <h2>문의하기</h2>
        <p>{content.contact_cta}</p>
      </section>
    </main>
  );
}
