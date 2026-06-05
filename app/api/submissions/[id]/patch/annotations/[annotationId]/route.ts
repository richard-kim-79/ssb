import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { essayAnnotationsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { loadOwnedSubmission } from "@/lib/patch/access";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; annotationId: string }> };

const TYPES = new Set(["correction", "highlight", "comment"]);
const SEVERITIES = new Set(["minor", "major", "suggestion"]);

async function loadAnnotation(submissionId: string, annotationId: string) {
  const [annotation] = await db
    .select()
    .from(essayAnnotationsTable)
    .where(eq(essayAnnotationsTable.id, annotationId))
    .limit(1);
  if (!annotation || annotation.submissionId !== submissionId) {
    throw new ApiError(404, "첨삭을 찾을 수 없습니다", "not_found");
  }
  return annotation;
}

/** Edit an annotation's note/correction fields (not its anchor). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, annotationId } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);
  await loadAnnotation(submission.id, annotationId);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.type === "string") {
    if (!TYPES.has(body.type)) throw new ApiError(400, "첨삭 유형이 올바르지 않습니다", "invalid_type");
    patch.type = body.type;
  }
  if (body.comment !== undefined) patch.comment = body.comment === null ? null : String(body.comment);
  if (body.suggestedText !== undefined)
    patch.suggestedText = body.suggestedText === null ? null : String(body.suggestedText);
  if (body.color !== undefined) patch.color = body.color === null ? null : String(body.color);
  if (body.severity !== undefined) {
    if (body.severity !== null && !(typeof body.severity === "string" && SEVERITIES.has(body.severity))) {
      throw new ApiError(400, "심각도 값이 올바르지 않습니다", "invalid_severity");
    }
    patch.severity = body.severity;
  }

  const [annotation] = await db
    .update(essayAnnotationsTable)
    .set(patch)
    .where(eq(essayAnnotationsTable.id, annotationId))
    .returning();

  return json({ annotation });
});

/** Delete an annotation. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, annotationId } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);
  await loadAnnotation(submission.id, annotationId);

  await db.delete(essayAnnotationsTable).where(eq(essayAnnotationsTable.id, annotationId));
  return json({ ok: true });
});
