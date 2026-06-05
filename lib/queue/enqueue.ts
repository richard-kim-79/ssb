import { publishJob, qstashConfigured } from "./qstash";

/**
 * Enqueue a grading job.
 * - Production / QStash configured: publish to the worker endpoint (durable, retried).
 * - Local dev without QStash: run the processor in-process (fire-and-forget) so the
 *   loop works end-to-end without external infra.
 */
export async function enqueueGrade(submissionId: string): Promise<void> {
  if (qstashConfigured()) {
    await publishJob("/api/jobs/grade", { submissionId });
    return;
  }
  // Dev fallback — dynamic import to avoid pulling DB/AI code into edge bundles.
  const { processGradeJob } = await import("@/lib/jobs/grade");
  void processGradeJob(submissionId).catch((err) => console.error("[dev grade]", err));
}

/**
 * Enqueue a re-grade job for a revision (mirrors enqueueGrade).
 * QStash when configured; otherwise an in-process fire-and-forget for local dev.
 */
export async function enqueueRegrade(revisionId: string): Promise<void> {
  if (qstashConfigured()) {
    await publishJob("/api/jobs/regrade", { revisionId });
    return;
  }
  const { processRegradeJob } = await import("@/lib/jobs/regrade");
  void processRegradeJob(revisionId).catch((err) => console.error("[dev regrade]", err));
}
