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
