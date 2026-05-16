import fs from "node:fs";
import path from "node:path";

const defaultJobsRoot = path.join(process.cwd(), "jobs");
const queueNames = ["pending", "processing", "completed", "failed"] as const;

export type QueueName = (typeof queueNames)[number];

export type JobQueueItem = {
  fileName: string;
  queue: QueueName;
  requestId: string | null;
  companyId: string | null;
  homepageType: string | null;
  readError: string | null;
};

export type BatchRunReport = {
  jobs_root?: string;
  started_at?: string;
  completed_at?: string;
  summary?: {
    total?: number;
    completed?: number;
    failed?: number;
    generated?: number;
    published?: number;
    manual_required?: number;
  };
};

export type JobQueueSummary = {
  queues: Record<QueueName, number>;
  total: number;
  lastBatch: BatchRunReport | null;
  items: JobQueueItem[];
};

export function getJobQueueSummary(jobsRoot = defaultJobsRoot): JobQueueSummary {
  const items = queueNames.flatMap((queue) => listQueueItems(jobsRoot, queue));
  const queues = queueNames.reduce(
    (counts, queue) => {
      counts[queue] = items.filter((item) => item.queue === queue).length;
      return counts;
    },
    {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    } as Record<QueueName, number>,
  );

  return {
    queues,
    total: items.length,
    lastBatch: readBatchReport(jobsRoot),
    items,
  };
}

function listQueueItems(jobsRoot: string, queue: QueueName): JobQueueItem[] {
  const queuePath = path.join(jobsRoot, queue);
  if (!fs.existsSync(queuePath)) return [];

  return fs
    .readdirSync(queuePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(queuePath, entry.name);
      const request = safeReadJson<Record<string, unknown>>(filePath);

      return {
        fileName: entry.name,
        queue,
        requestId: stringOrNull(request?.request_id),
        companyId: stringOrNull(request?.company_id),
        homepageType: stringOrNull(request?.homepage_type),
        readError: request ? null : "Request JSON could not be read.",
      } satisfies JobQueueItem;
    })
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function readBatchReport(jobsRoot: string): BatchRunReport | null {
  return safeReadJson<BatchRunReport>(path.join(jobsRoot, "batch-run-report.json"));
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
