"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type GenerateResult = {
  requestId: string;
  companyId: string;
  modelProvider: string;
  modelName: string;
  status: string;
  homepageUrl: string;
  generatedPath: string;
  validationPassed: boolean;
  buildPassed: boolean;
  previewAvailable: boolean;
  retryCount: number;
  exitCode: number | null;
  errorSummary?: string;
};

const initialForm = {
  homepageType: "company_intro",
  companyName: "주식회사 테스트홈",
  industry: "IT·소프트웨어",
  businessType: "업무 자동화 솔루션 개발 및 공급",
  mainBusinessDescription: "기업의 반복 업무를 줄이는 업무 자동화 솔루션을 개발하고 공급합니다.",
  oneLineIntro: "반복 업무를 줄이는 자동화 솔루션",
  companyIntro: "주식회사 테스트홈은 기업의 업무 흐름을 분석하고 자동화 시스템을 구축하는 회사입니다.",
  coreStrengths: "업무 자동화\n데이터 관리\n기업 맞춤 구축",
  productName: "업무 자동화 대시보드",
  productDescription: "반복 업무 현황을 한눈에 보고 자동화 상태를 관리하는 대시보드입니다.",
  generationMode: "goose",
};

export default function TestBuilderForm() {
  const [form, setForm] = useState(initialForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/test-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ? `${body.error}: ${(body.fields || []).join(", ")}` : "생성 실패");
        setResult(body);
        return;
      }
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "요청 실패");
    } finally {
      setIsGenerating(false);
    }
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="index-page test-builder-page">
      <section className="index-hero compact-hero">
        <p className="eyebrow">Test Input Flow</p>
        <h1>정보 입력 후 홈페이지 자동 생성</h1>
        <p>
          테스트용 입력 화면입니다. 완료 버튼을 누르면 request JSON이 만들어지고 기존 builder가
          실행된 뒤 생성된 홈페이지 URL을 보여줍니다.
        </p>
      </section>

      <form className="test-builder-form" onSubmit={handleSubmit}>
        <section className="form-section" aria-label="생성 방식">
          <div>
            <p className="section-label">Generation</p>
            <h2>생성 방식</h2>
          </div>
          <div className="segmented-control">
            <label>
              <input
                checked={form.generationMode === "goose"}
                name="generationMode"
                onChange={() => updateField("generationMode", "goose")}
                type="radio"
              />
              <span>Goose 필수</span>
            </label>
            <label>
              <input
                checked={form.generationMode === "auto"}
                name="generationMode"
                onChange={() => updateField("generationMode", "auto")}
                type="radio"
              />
              <span>Goose 우선</span>
            </label>
          </div>
        </section>

        <section className="form-section" aria-label="회사 기본 정보">
          <div>
            <p className="section-label">Company</p>
            <h2>기본 정보</h2>
          </div>
          <div className="form-grid">
            <label>
              홈페이지 유형
              <select
                value={form.homepageType}
                onChange={(event) => updateField("homepageType", event.target.value)}
              >
                <option value="company_intro">회사소개중심형</option>
                <option value="product">상품중심형</option>
              </select>
            </label>
            <label>
              회사명
              <input
                value={form.companyName}
                onChange={(event) => updateField("companyName", event.target.value)}
              />
            </label>
            <label>
              업종
              <input
                value={form.industry}
                onChange={(event) => updateField("industry", event.target.value)}
              />
            </label>
            <label>
              사업 유형
              <input
                value={form.businessType}
                onChange={(event) => updateField("businessType", event.target.value)}
              />
            </label>
          </div>
          <label>
            주요 사업 설명
            <textarea
              rows={4}
              value={form.mainBusinessDescription}
              onChange={(event) => updateField("mainBusinessDescription", event.target.value)}
            />
          </label>
        </section>

        <section className="form-section" aria-label="홈페이지 표시 정보">
          <div>
            <p className="section-label">Content</p>
            <h2>표시 정보</h2>
          </div>
          <label>
            한 줄 소개
            <input
              value={form.oneLineIntro}
              onChange={(event) => updateField("oneLineIntro", event.target.value)}
            />
          </label>
          <label>
            회사 소개
            <textarea
              rows={4}
              value={form.companyIntro}
              onChange={(event) => updateField("companyIntro", event.target.value)}
            />
          </label>
          <label>
            핵심 강점
            <textarea
              rows={4}
              value={form.coreStrengths}
              onChange={(event) => updateField("coreStrengths", event.target.value)}
            />
          </label>
        </section>

        {form.homepageType === "product" ? (
          <section className="form-section" aria-label="상품 정보">
            <div>
              <p className="section-label">Product</p>
              <h2>상품 정보</h2>
            </div>
            <label>
              상품명
              <input
                value={form.productName}
                onChange={(event) => updateField("productName", event.target.value)}
              />
            </label>
            <label>
              상품 설명
              <textarea
                rows={3}
                value={form.productDescription}
                onChange={(event) => updateField("productDescription", event.target.value)}
              />
            </label>
          </section>
        ) : null}

        <div className="form-actions">
          <button disabled={isGenerating} type="submit">
            {isGenerating ? "생성 중..." : "완료하고 홈페이지 생성"}
          </button>
          <Link className="secondary-link" href="/">
            결과 목록 보기
          </Link>
        </div>
      </form>

      {isGenerating ? (
        <section className="generation-status" aria-live="polite">
          <strong>홈페이지를 생성하고 있습니다.</strong>
          <span>request JSON 생성, builder 실행, validation/build 검증을 순서대로 처리합니다.</span>
        </section>
      ) : null}

      {error ? (
        <section className="generation-status generation-status-error" aria-live="polite">
          <strong>생성 실패</strong>
          <span>{error}</span>
          {result?.errorSummary ? <code>{result.errorSummary}</code> : null}
        </section>
      ) : null}

      {result ? (
        <section className="generation-result" aria-label="생성 결과">
          <div>
            <p className="section-label">Result</p>
            <h2>{result.status}</h2>
          </div>
          <dl className="meta-list">
            <div>
              <dt>request_id</dt>
              <dd>{result.requestId}</dd>
            </div>
            <div>
              <dt>company_id</dt>
              <dd>{result.companyId}</dd>
            </div>
            <div>
              <dt>validation</dt>
              <dd>{result.validationPassed ? "pass" : "fail"}</dd>
            </div>
            <div>
              <dt>build</dt>
              <dd>{result.buildPassed ? "pass" : "fail"}</dd>
            </div>
            <div>
              <dt>provider</dt>
              <dd>{result.modelProvider}</dd>
            </div>
            <div>
              <dt>model</dt>
              <dd>{result.modelName}</dd>
            </div>
          </dl>
          <div className="result-actions">
            {result.previewAvailable ? (
              <Link className="primary-link" href={result.homepageUrl}>
                생성된 홈페이지 보기
              </Link>
            ) : (
              <span className="status-badge status-badge-danger">홈페이지 미생성</span>
            )}
            <code>{result.generatedPath}</code>
          </div>
        </section>
      ) : null}
    </main>
  );
}
