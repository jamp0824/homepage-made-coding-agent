import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestGeneratePayload = {
  homepageType?: string;
  companyName?: string;
  industry?: string;
  businessType?: string;
  mainBusinessDescription?: string;
  oneLineIntro?: string;
  companyIntro?: string;
  coreStrengths?: string;
  tags?: string;
  coverImageUrl?: string;
  contactAddress?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactWebsiteUrl?: string;
  productName?: string;
  productDescription?: string;
  productImageUrl?: string;
  portfolioItems?: string;
  historyItems?: string;
  generationMode?: string;
};

export async function POST(request: Request) {
  let payload: TestGeneratePayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const normalized = normalizePayload(payload);
  const missing = validatePayload(normalized);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Missing required fields", fields: missing }, { status: 400 });
  }

  const requestId = `REQ_UI_${Date.now()}`;
  const companyId = buildCompanyId(normalized.companyName, requestId);
  const requestBody = {
    request_id: requestId,
    company_id: companyId,
    homepage_type: normalized.homepageType,
    company_name: normalized.companyName,
    industry: normalized.industry,
    business_type: normalized.businessType,
    main_business_description: normalized.mainBusinessDescription,
    one_line_intro: normalized.oneLineIntro || normalized.mainBusinessDescription,
    company_intro: normalized.companyIntro || normalized.mainBusinessDescription,
    cover_image_url: normalized.coverImageUrl,
    tags: splitList(normalized.tags).slice(0, 12),
    contact: buildContact(normalized),
    core_strengths: splitLines(normalized.coreStrengths).slice(0, 10),
    products: normalized.productName
      ? [
          removeEmptyFields({
            name: normalized.productName,
            description: normalized.productDescription,
            image_url: normalized.productImageUrl,
          }),
        ]
      : [],
    portfolio: parsePortfolio(normalized.portfolioItems).slice(0, 6),
    history: parseHistory(normalized.historyItems).slice(0, 8),
    preferred_style: "clean",
    created_at: new Date().toISOString(),
  };

  const requestDir = path.join(process.cwd(), "harness", "tmp", "ui-requests");
  const requestPath = path.join(requestDir, `${requestId}.json`);
  const runLogDir = path.join(process.cwd(), "harness", "tmp", "ui-runs");
  const runLogPath = path.join(runLogDir, `${requestId}.log`);
  fs.mkdirSync(requestDir, { recursive: true });
  fs.mkdirSync(runLogDir, { recursive: true });
  fs.writeFileSync(requestPath, JSON.stringify(requestBody, null, 2));
  fs.writeFileSync(runLogPath, "");

  const generationMode =
    normalized.generationMode === "goose"
      ? "required"
      : normalized.generationMode === "auto"
        ? "auto"
        : "local";
  const runLogFd = fs.openSync(runLogPath, "a");
  const startedAt = new Date().toISOString();
  const result = spawnSync(
    "bash",
    ["scripts/run-homepage-builder.sh", requestPath],
    {
      cwd: process.cwd(),
      env: {
        ...buildChildEnv(),
        GOOSE_MODE: generationMode,
        MAX_RETRY: normalized.generationMode === "goose" ? "3" : "1",
        AGENT_RETRY_SLEEP_SECONDS: "8",
        NEXT_BUILD_TIMEOUT_MS: "120000",
      },
      stdio: ["ignore", runLogFd, runLogFd],
      timeout: 1000 * 60 * 6,
    },
  );
  fs.closeSync(runLogFd);

  const resultPath = path.join(process.cwd(), "generated-sites", companyId, "generation-result.json");
  const generationResult = fs.existsSync(resultPath)
    ? JSON.parse(fs.readFileSync(resultPath, "utf8"))
    : null;
  const logTail = readTail(runLogPath);
  const previewAvailable =
    ["generated", "published"].includes(generationResult?.status) &&
    generationResult?.validation_result?.passed === true &&
    generationResult?.build_result?.passed === true;
  const errorSummary = buildFailureSummary(generationResult, logTail, result.status);
  const failure = previewAvailable
    ? null
    : classifyFailure({
        status: generationResult?.status ?? "failed",
        generationMode,
        summary: errorSummary,
        exitCode: result.status,
      });

  return NextResponse.json(
    {
      ok: previewAvailable,
      requestPath,
      requestId,
      companyId,
      generationMode,
      modelProvider: generationResult?.model_provider ?? "goose_required",
      modelName: generationResult?.model_name ?? "configured-goose-model",
      status: generationResult?.status ?? "failed",
      homepageUrl: generationResult?.homepage_url ?? `/homepage/${companyId}`,
      generatedPath: `generated-sites/${companyId}`,
      validationPassed: generationResult?.validation_result?.passed ?? false,
      buildPassed: generationResult?.build_result?.passed ?? false,
      previewAvailable,
      retryCount: generationResult?.retry_count ?? 0,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: result.status,
      runLogPath,
      failureCategory: failure?.category ?? null,
      failureTitle: failure?.title ?? null,
      failureMessage: failure?.message ?? null,
      nextAction: failure?.nextAction ?? null,
      errorSummary,
    },
    { status: generationResult || result.status === 0 ? 200 : 500 },
  );
}

function normalizePayload(payload: TestGeneratePayload) {
  return {
    homepageType: payload.homepageType === "product" ? "product" : "company_intro",
    companyName: cleanText(payload.companyName),
    industry: cleanText(payload.industry),
    businessType: cleanText(payload.businessType),
    mainBusinessDescription: cleanText(payload.mainBusinessDescription),
    oneLineIntro: cleanText(payload.oneLineIntro),
    companyIntro: cleanText(payload.companyIntro),
    coreStrengths: cleanText(payload.coreStrengths),
    tags: cleanText(payload.tags),
    coverImageUrl: cleanText(payload.coverImageUrl),
    contactAddress: cleanText(payload.contactAddress),
    contactPhone: cleanText(payload.contactPhone),
    contactEmail: cleanText(payload.contactEmail),
    contactWebsiteUrl: cleanText(payload.contactWebsiteUrl),
    productName: cleanText(payload.productName),
    productDescription: cleanText(payload.productDescription),
    productImageUrl: cleanText(payload.productImageUrl),
    portfolioItems: cleanText(payload.portfolioItems),
    historyItems: cleanText(payload.historyItems),
    generationMode:
      payload.generationMode === "goose"
        ? "goose"
        : payload.generationMode === "auto"
          ? "auto"
          : "local",
  };
}

function validatePayload(payload: ReturnType<typeof normalizePayload>) {
  const missing = [];
  if (!payload.companyName) missing.push("companyName");
  if (!payload.industry) missing.push("industry");
  if (!payload.businessType) missing.push("businessType");
  if (!payload.mainBusinessDescription || payload.mainBusinessDescription.length < 10) {
    missing.push("mainBusinessDescription");
  }
  if (payload.homepageType === "product" && !payload.productName) missing.push("productName");
  return missing;
}

function cleanText(value?: string) {
  return String(value || "").trim();
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitList(value: string) {
  return value
    .split(/\r?\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildContact(payload: ReturnType<typeof normalizePayload>) {
  return removeEmptyFields({
    address: payload.contactAddress,
    phone: payload.contactPhone,
    email: payload.contactEmail,
    website_url: payload.contactWebsiteUrl,
  });
}

function parsePortfolio(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title = "", ...descriptionParts] = line.split("|").map((part) => part.trim());
      return removeEmptyFields({
        title,
        description: descriptionParts.join(" | "),
      });
    })
    .filter((item) => item.title || item.description);
}

function parseHistory(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [year = "", ...textParts] = line.split("|").map((part) => part.trim());
      return {
        year,
        text: textParts.join(" | "),
      };
    })
    .filter((item) => item.year && item.text);
}

function removeEmptyFields<T extends Record<string, string>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => Boolean(fieldValue)),
  ) as Partial<T>;
}

function buildCompanyId(companyName: string, requestId: string) {
  const ascii = companyName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 28)
    .toUpperCase();
  const suffix = requestId.replace("REQ_UI_", "");
  return `UI_${ascii || "COMPANY"}_${suffix}`.replace(/[^A-Z0-9_-]/g, "_");
}

function buildChildEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_") || key.startsWith("__NEXT_")) {
      delete env[key];
    }
  }
  return env;
}

function readTail(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.length > 8000 ? content.slice(-8000) : content;
  } catch {
    return "";
  }
}

function summarizeFailure(logOutput: string) {
  const output = logOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/api[_-]?key|oauth|token|secret/i.test(line));
  return output.slice(-8).join("\n");
}

function buildFailureSummary(generationResult: any, logOutput: string, exitCode: number | null) {
  const resultErrors = [
    ...(Array.isArray(generationResult?.errors) ? generationResult.errors : []),
    ...(Array.isArray(generationResult?.validation_result?.errors)
      ? generationResult.validation_result.errors
      : []),
    ...(Array.isArray(generationResult?.build_result?.errors)
      ? generationResult.build_result.errors
      : []),
  ]
    .map((error) => String(error).trim())
    .filter(Boolean);

  if (resultErrors.length > 0) return resultErrors.slice(0, 6).join("\n");
  if (exitCode === 0) return "";
  return summarizeFailure(logOutput);
}

function classifyFailure({
  status,
  generationMode,
  summary,
  exitCode,
}: {
  status: string;
  generationMode: string;
  summary: string;
  exitCode: number | null;
}) {
  const haystack = `${status}\n${generationMode}\n${summary}`.toLowerCase();

  if (/quota|rate limit|rate_limit|resource_exhausted|too many requests/.test(haystack)) {
    return {
      category: "provider_quota_or_rate_limit",
      title: "AI provider quota/rate limit",
      message: "Goose가 연결된 AI provider의 quota 또는 rate limit에 막혀 자동 생성을 완료하지 못했습니다.",
      nextAction: "Gemini/OpenAI/Claude 결제 또는 quota 설정을 확인한 뒤 다시 실행하세요.",
    };
  }

  if (/no goose provider|provider config|goose_provider|configure one provider|no provider/.test(haystack)) {
    return {
      category: "provider_not_configured",
      title: "Goose provider not configured",
      message: "Goose가 사용할 모델 provider 설정을 찾지 못해 홈페이지 생성이 시작되지 못했습니다.",
      nextAction: "goose configure에서 Google Gemini API Key 같은 provider를 설정한 뒤 다시 실행하세요.",
    };
  }

  if (/goose cli|command not found|missing cli|not installed|enoent/.test(haystack)) {
    return {
      category: "goose_cli_missing",
      title: "Goose CLI unavailable",
      message: "로컬 환경에서 Goose CLI를 실행할 수 없어 자동 생성이 중단되었습니다.",
      nextAction: "Goose 설치와 PATH 설정을 확인한 뒤 다시 실행하세요.",
    };
  }

  if (/validation|fake claim|not rendered|not present|unsupported high-risk/.test(haystack)) {
    return {
      category: "validation_failed",
      title: "Generated site validation failed",
      message: "생성 결과가 입력 정보 보존, fake claim 방지, 템플릿 규칙 중 하나를 통과하지 못했습니다.",
      nextAction: "agent-run-report와 validation-report를 확인해 누락되거나 만들어낸 정보를 수정해야 합니다.",
    };
  }

  if (/build|next\.js|compile|typescript|lint/.test(haystack)) {
    return {
      category: "build_failed",
      title: "Build failed",
      message: "생성된 홈페이지 파일은 만들어졌지만 Next.js build 검증을 통과하지 못했습니다.",
      nextAction: "build_result 오류를 확인해 생성 템플릿 또는 렌더링 코드를 수정해야 합니다.",
    };
  }

  if (/timeout|timed out/.test(haystack) || exitCode === null) {
    return {
      category: "timeout",
      title: "Generation timed out",
      message: "자동 생성이 제한 시간 안에 끝나지 않았습니다.",
      nextAction: "provider 응답 상태를 확인하고 다시 실행하세요.",
    };
  }

  return {
    category: status === "manual_required" ? "manual_required" : "automation_failed",
    title: status === "manual_required" ? "Automation ended as manual_required" : "Automation failed",
    message: "자동 생성이 retry 이후에도 완료되지 않아 예외 상태로 기록되었습니다.",
    nextAction: "run log와 agent-run-report를 확인한 뒤 provider 또는 generator 문제를 수정하고 다시 실행하세요.",
  };
}
