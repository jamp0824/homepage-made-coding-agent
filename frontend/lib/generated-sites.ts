import fs from "node:fs";
import path from "node:path";

const generatedRoot = path.join(process.cwd(), "generated-sites");
const companyIdPattern = /^[A-Za-z0-9_-]+$/;

export type HomepageType = "company_intro" | "product";

export type GeneratedProduct = {
  name: string;
  description?: string;
};

export type GeneratedContent = {
  request_id: string;
  company_id: string;
  homepage_type: HomepageType;
  template_id: string;
  company_name: string;
  hero_title: string;
  one_line_intro: string;
  company_intro: string;
  business_summary: string;
  core_strengths: string[];
  products: GeneratedProduct[];
  history: Array<{
    year: string;
    text: string;
  }>;
  portfolio: Array<{
    title?: string;
    description?: string;
  }>;
  product_registration_cta: string;
  contact_cta: string;
  sections: string[];
};

export type GeneratedMetadata = {
  request_id: string;
  company_id: string;
  homepage_type: string;
  template_id: string;
  generated_at?: string;
  generator?: string;
  model_provider?: string;
  model_name?: string;
};

export type ValidationResult = {
  passed: boolean;
  errors: string[];
  warnings: string[];
};

export type BuildResult = {
  passed: boolean;
  command?: string;
  errors: string[];
};

export type GenerationResult = {
  request_id?: string;
  company_id?: string;
  status: string;
  homepage_type?: string;
  template_id?: string;
  homepage_url?: string;
  retry_count?: number;
  completed_at?: string;
  build_result?: BuildResult;
  validation_result?: ValidationResult;
  error_type?: string;
  errors?: string[];
};

export type GeneratedSite = {
  content: GeneratedContent;
  metadata: GeneratedMetadata;
  result: GenerationResult;
};

export type GeneratedSiteSummary = {
  companyId: string;
  companyName: string;
  requestId: string | null;
  homepageType: HomepageType | null;
  templateId: string | null;
  homepageUrl: string | null;
  status: string;
  validationPassed: boolean | null;
  validationErrorCount: number;
  warningCount: number;
  buildPassed: boolean | null;
  retryCount: number;
  completedAt: string | null;
  generatedAt: string | null;
  previewAvailable: boolean;
  readError: string | null;
};

function listGeneratedDirectories() {
  if (!fs.existsSync(generatedRoot)) return [];

  return fs
    .readdirSync(generatedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function safeReadJson<T>(filePath: string) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function normalizeHomepageType(value: string | undefined): HomepageType | null {
  if (value === "company_intro" || value === "product") {
    return value;
  }

  return null;
}

export function getGeneratedCompanyIds() {
  return listGeneratedDirectories().filter((companyId) => readGeneratedSite(companyId) !== null);
}

export function listGeneratedCompanyIds() {
  return getGeneratedCompanyIds();
}

export function readGeneratedSite(companyId: string): GeneratedSite | null {
  if (!companyIdPattern.test(companyId)) return null;

  const sitePath = path.join(generatedRoot, companyId);
  const contentPath = path.join(sitePath, "content.json");
  const metadataPath = path.join(sitePath, "metadata.json");
  const resultPath = path.join(sitePath, "generation-result.json");

  if (!fs.existsSync(contentPath) || !fs.existsSync(metadataPath) || !fs.existsSync(resultPath)) {
    return null;
  }

  const content = safeReadJson<GeneratedContent>(contentPath);
  const metadata = safeReadJson<GeneratedMetadata>(metadataPath);
  const result = safeReadJson<GenerationResult>(resultPath);

  if (!content || !metadata || !result) {
    return null;
  }

  return {
    content,
    metadata,
    result,
  };
}

export function listGeneratedSites(): GeneratedSiteSummary[] {
  return listGeneratedDirectories()
    .map((companyId) => {
      if (!companyIdPattern.test(companyId)) {
        return {
          companyId,
          companyName: companyId,
          requestId: null,
          homepageType: null,
          templateId: null,
          homepageUrl: null,
          status: "unavailable",
          validationPassed: null,
          validationErrorCount: 0,
          warningCount: 0,
          buildPassed: null,
          retryCount: 0,
          completedAt: null,
          generatedAt: null,
          previewAvailable: false,
          readError: "Unsupported company directory name.",
        } satisfies GeneratedSiteSummary;
      }

      const sitePath = path.join(generatedRoot, companyId);
      const content = safeReadJson<GeneratedContent>(path.join(sitePath, "content.json"));
      const metadata = safeReadJson<GeneratedMetadata>(path.join(sitePath, "metadata.json"));
      const result = safeReadJson<GenerationResult>(
        path.join(sitePath, "generation-result.json"),
      );
      const homepageType = normalizeHomepageType(
        content?.homepage_type ?? metadata?.homepage_type ?? result?.homepage_type,
      );
      const validationErrors = result?.validation_result?.errors ?? [];
      const warnings = result?.validation_result?.warnings ?? [];
      const previewAvailable = Boolean(content && metadata && result);
      const requestId =
        content?.request_id ?? metadata?.request_id ?? result?.request_id ?? null;
      const templateId =
        content?.template_id ?? metadata?.template_id ?? result?.template_id ?? null;
      const homepageUrl =
        typeof result?.homepage_url === "string"
          ? result.homepage_url
          : previewAvailable
            ? `/homepage/${companyId}`
            : null;

      return {
        companyId,
        companyName: content?.company_name ?? companyId,
        requestId,
        homepageType,
        templateId,
        homepageUrl,
        status: result?.status ?? "unavailable",
        validationPassed: result?.validation_result?.passed ?? null,
        validationErrorCount: validationErrors.length,
        warningCount: warnings.length,
        buildPassed: result?.build_result?.passed ?? null,
        retryCount: result?.retry_count ?? 0,
        completedAt: result?.completed_at ?? null,
        generatedAt: metadata?.generated_at ?? null,
        previewAvailable,
        readError: previewAvailable ? null : "Required generated site files are missing or invalid.",
      } satisfies GeneratedSiteSummary;
    })
    .sort((left, right) => {
      const leftTime = left.completedAt ? Date.parse(left.completedAt) : 0;
      const rightTime = right.completedAt ? Date.parse(right.completedAt) : 0;

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return left.companyId.localeCompare(right.companyId);
    });
}
