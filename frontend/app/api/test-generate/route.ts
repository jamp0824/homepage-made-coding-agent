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
  productName?: string;
  productDescription?: string;
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
    core_strengths: splitLines(normalized.coreStrengths).slice(0, 10),
    products:
      normalized.homepageType === "product" && normalized.productName
        ? [
            {
              name: normalized.productName,
              description: normalized.productDescription || "",
            },
          ]
        : [],
    portfolio: [],
    history: [],
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

  return NextResponse.json(
    {
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
      previewAvailable:
        ["generated", "published"].includes(generationResult?.status) &&
        generationResult?.validation_result?.passed === true &&
        generationResult?.build_result?.passed === true,
      retryCount: generationResult?.retry_count ?? 0,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: result.status,
      runLogPath,
      errorSummary: result.status === 0 ? "" : summarizeFailure(readTail(runLogPath)),
    },
    { status: result.status === 0 ? 200 : 500 },
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
    productName: cleanText(payload.productName),
    productDescription: cleanText(payload.productDescription),
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
