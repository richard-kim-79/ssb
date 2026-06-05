import { assertJobAuthorized } from "@/lib/queue/qstash";
import { processGradeJob } from "@/lib/jobs/grade";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * QStash worker for grading. Authorizes via signature, then grades.
 * Processing failures intentionally bubble to a 500 so QStash retries the
 * delivery; `processGradeJob` is idempotent (claim-update) so retries are safe.
 */
export async function POST(req: Request) {
  const bodyText = await req.text();

  try {
    await assertJobAuthorized(req, bodyText);
  } catch (err) {
    console.error("[jobs/grade] authorization failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }

  let submissionId = "";
  try {
    const body = JSON.parse(bodyText || "{}") as { submissionId?: unknown };
    submissionId = String(body.submissionId ?? "");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!submissionId) return new Response("Missing submissionId", { status: 400 });

  const result = await processGradeJob(submissionId);
  return Response.json(result);
}
