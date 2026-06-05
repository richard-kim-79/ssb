import { assertJobAuthorized } from "@/lib/queue/qstash";
import { processRegradeJob } from "@/lib/jobs/regrade";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * QStash worker for re-grading a revision. Authorizes via signature, then re-grades.
 * Failures bubble to a 500 so QStash retries; `processRegradeJob` is idempotent
 * (claim-update) so retries are safe.
 */
export async function POST(req: Request) {
  const bodyText = await req.text();

  try {
    await assertJobAuthorized(req, bodyText);
  } catch (err) {
    console.error("[jobs/regrade] authorization failed:", err);
    return new Response("Unauthorized", { status: 401 });
  }

  let revisionId = "";
  try {
    const body = JSON.parse(bodyText || "{}") as { revisionId?: unknown };
    revisionId = String(body.revisionId ?? "");
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!revisionId) return new Response("Missing revisionId", { status: 400 });

  const result = await processRegradeJob(revisionId);
  return Response.json(result);
}
