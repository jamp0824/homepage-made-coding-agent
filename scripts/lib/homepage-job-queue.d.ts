export type HomepageJobCustomer = {
  status: string;
  homepage_url: string;
  preview_available: boolean;
  message?: string;
};

export type HomepageJobDebug = {
  queue_state: string;
  request_path: string | null;
  generated_path: string | null;
  provider: string | null;
  validation_result: unknown;
  build_result: unknown;
  agent_run_report_path: string | null;
  job_report_path?: string | null;
  retry_count?: number | null;
  queued_at?: string | null;
  worker_hint?: string | null;
};

export type HomepageJobStatusResponse = {
  ok: boolean;
  job_id: string;
  request_id: string;
  company_id: string;
  status: string;
  customer: HomepageJobCustomer;
  debug: HomepageJobDebug;
};

export function resolveHomepageJobsRoot(rawJobsRoot?: string): string;

export function enqueueHomepageGenerationJob(input: {
  requestBody: Record<string, unknown>;
  jobsRoot?: string;
  jobId?: string;
  now?: string;
}): HomepageJobStatusResponse;

export function synthesizeHomepageGenerationJobStatus(input: {
  jobsRoot?: string;
  jobId: string;
}): HomepageJobStatusResponse | null;

export function normalizeLegacyHomepageGenerationJobStatus(input: {
  jobId: string;
  job: Record<string, unknown>;
  jobPath?: string;
}): HomepageJobStatusResponse;

export function assertAllowedJobsRoot(rawJobsRoot: string): void;
