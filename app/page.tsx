import Link from "next/link";
import { listGeneratedSites, type GeneratedSiteSummary } from "../lib/generated-sites";
import { getJobQueueSummary } from "../lib/jobs";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const sites = listGeneratedSites();
  const jobs = getJobQueueSummary();
  const previewAvailableCount = sites.filter((site) => site.previewAvailable).length;
  const generatedCount = sites.filter(
    (site) => site.status === "generated" || site.status === "published",
  ).length;
  const manualRequiredCount = sites.filter((site) => site.status === "manual_required").length;

  return (
    <main className="index-page">
      <section className="index-hero">
        <p className="eyebrow">Goose Homepage Builder Harness</p>
        <h1>생성된 홈페이지 미리보기</h1>
        <p>
          request JSON으로 생성된 결과를 회사별 URL에서 확인합니다. 고객 입력 UI가 아니라
          생성 산출물 검증용 앱입니다.
        </p>
        <p className="api-note">
          상태 목록 JSON은 <code>/api/generated-sites</code> 와 <code>/api/jobs</code> 에서
          조회할 수 있습니다.
        </p>
      </section>

      <section className="status-strip" aria-label="작업 큐 요약">
        <article className="stat-card">
          <span>pending jobs</span>
          <strong>{jobs.queues.pending}</strong>
        </article>
        <article className="stat-card">
          <span>processing jobs</span>
          <strong>{jobs.queues.processing}</strong>
        </article>
        <article className="stat-card">
          <span>completed jobs</span>
          <strong>{jobs.queues.completed}</strong>
        </article>
        <article className="stat-card">
          <span>failed jobs</span>
          <strong>{jobs.queues.failed}</strong>
        </article>
      </section>

      {jobs.lastBatch ? (
        <section className="job-panel" aria-label="최근 batch 실행 요약">
          <div>
            <p className="section-label">Last Batch</p>
            <h2>최근 job 실행</h2>
          </div>
          <dl className="meta-list">
            <div>
              <dt>total</dt>
              <dd>{jobs.lastBatch.summary?.total ?? 0}</dd>
            </div>
            <div>
              <dt>completed</dt>
              <dd>{jobs.lastBatch.summary?.completed ?? 0}</dd>
            </div>
            <div>
              <dt>failed</dt>
              <dd>{jobs.lastBatch.summary?.failed ?? 0}</dd>
            </div>
            <div>
              <dt>completed_at</dt>
              <dd>{jobs.lastBatch.completed_at ?? "미확인"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="status-strip" aria-label="생성 현황 요약">
        <article className="stat-card">
          <span>전체 디렉터리</span>
          <strong>{sites.length}</strong>
        </article>
        <article className="stat-card">
          <span>미리보기 가능</span>
          <strong>{previewAvailableCount}</strong>
        </article>
        <article className="stat-card">
          <span>generated/published</span>
          <strong>{generatedCount}</strong>
        </article>
        <article className="stat-card">
          <span>manual_required</span>
          <strong>{manualRequiredCount}</strong>
        </article>
      </section>

      <section className="preview-list" aria-label="생성된 홈페이지 목록">
        {sites.length > 0 ? (
          sites.map((site) =>
            site.previewAvailable && site.homepageUrl ? (
              <Link className="preview-card" href={site.homepageUrl} key={site.companyId}>
                {renderPreviewCard(site)}
              </Link>
            ) : (
              <article className="preview-card preview-card-disabled" key={site.companyId}>
                {renderPreviewCard(site)}
              </article>
            ),
          )
        ) : (
          <p className="empty-state">
            아직 생성된 홈페이지가 없습니다. 먼저 builder script를 실행하세요.
          </p>
        )}
      </section>
    </main>
  );
}

function renderPreviewCard(site: GeneratedSiteSummary) {
  const typeLabel =
    site.homepageType === "product"
      ? "상품중심형"
      : site.homepageType === "company_intro"
        ? "회사소개중심형"
        : "유형 미확인";
  const validationLabel =
    site.validationPassed === null ? "검증 미확인" : site.validationPassed ? "검증 통과" : "검증 실패";
  const badgeTone =
    site.status === "manual_required" || site.validationPassed === false
      ? "status-badge-danger"
      : site.status === "generated" || site.status === "published"
        ? "status-badge-success"
        : "status-badge-neutral";

  return (
    <>
      <div className="preview-card-header">
        <div>
          <span>{site.companyId}</span>
          <strong>{site.companyName}</strong>
        </div>
        <span className={`status-badge ${badgeTone}`}>{site.status}</span>
      </div>
      <p>{typeLabel}</p>
      <dl className="meta-list">
        <div>
          <dt>템플릿</dt>
          <dd>{site.templateId ?? "미확인"}</dd>
        </div>
        <div>
          <dt>검증</dt>
          <dd>{validationLabel}</dd>
        </div>
        <div>
          <dt>오류 수</dt>
          <dd>{site.validationErrorCount}</dd>
        </div>
        <div>
          <dt>재시도</dt>
          <dd>{site.retryCount}</dd>
        </div>
      </dl>
      {site.readError ? (
        <p className="card-note">{site.readError}</p>
      ) : (
        <p className="card-note">
          {site.homepageUrl ?? `/homepage/${site.companyId}`}
          {site.completedAt ? ` · ${site.completedAt}` : ""}
        </p>
      )}
    </>
  );
}
