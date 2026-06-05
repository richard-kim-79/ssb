import { and, eq, isNull } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { analysisSessionsTable, essayAnnotationsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { loadOwnedSubmission, resolveAnchorText } from "@/lib/patch/access";
import { generateAnnotations } from "@/lib/ai/annotate";
import { resolveTier } from "@/lib/ai";
import { getUserActivePlanId } from "@/lib/usage/plan";
import { anchorByQuote } from "@/lib/patch/anchoring";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Generate AI inline 첨삭 for a submission (or one of its revisions).
 * Runs synchronously (maxDuration=300) and returns the anchored annotations.
 * Replaces any prior *AI* annotations for the target text (user edits survive).
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);

  const body = (await req.json().catch(() => ({}))) as { revisionId?: unknown };
  const revisionId = body.revisionId ? String(body.revisionId) : null;

  const text = await resolveAnchorText(submission, revisionId);
  if (text.startsWith("[IMAGE_DATA:")) {
    throw new ApiError(400, "이미지 답안은 인라인 첨삭을 지원하지 않습니다", "image_not_supported");
  }
  if (!text || text.length < 5) {
    throw new ApiError(400, "첨삭할 답안 내용이 없습니다", "empty_text");
  }

  const [session] = await db
    .select()
    .from(analysisSessionsTable)
    .where(eq(analysisSessionsTable.id, submission.sessionId))
    .limit(1);
  if (!session) throw new ApiError(404, "세션을 찾을 수 없습니다", "not_found");

  const planId = await getUserActivePlanId(submission.userId);
  const tier = resolveTier(planId);

  const { annotations: aiAnnotations } = await generateAnnotations(
    { promptText: session.promptContent, criteriaText: session.criteriaContent, essayText: text },
    tier,
  );

  // Anchor each AI quote to real offsets; sort by position for stable ordering.
  const anchored = aiAnnotations
    .map((a) => {
      const span = anchorByQuote(text, a.quotedText, { hintBefore: a.before });
      return { a, span };
    })
    .sort((x, y) => x.span.startOffset - y.span.startOffset);

  // Replace prior AI annotations for this target (keep user-authored ones).
  const revFilter = revisionId
    ? eq(essayAnnotationsTable.revisionId, revisionId)
    : isNull(essayAnnotationsTable.revisionId);
  await db
    .delete(essayAnnotationsTable)
    .where(and(eq(essayAnnotationsTable.submissionId, submission.id), eq(essayAnnotationsTable.source, "ai"), revFilter));

  if (anchored.length === 0) {
    return json({ annotations: [] });
  }

  const rows = anchored.map(({ a, span }, i) => ({
    submissionId: submission.id,
    revisionId,
    type: a.type,
    startOffset: span.startOffset,
    endOffset: span.endOffset,
    quotedText: a.quotedText,
    prefix: span.prefix,
    suffix: span.suffix,
    suggestedText: a.suggestedText ?? null,
    comment: a.comment,
    color: null,
    severity: a.severity ?? null,
    source: "ai" as const,
    orphaned: span.orphaned ? 1 : 0,
    orderIndex: i,
  }));

  const inserted = await db.insert(essayAnnotationsTable).values(rows).returning();
  inserted.sort((x, y) => x.orderIndex - y.orderIndex || x.startOffset - y.startOffset);
  return json({ annotations: inserted });
});
