import { and, asc, eq, isNull, max } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { essayAnnotationsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { loadOwnedSubmission, resolveAnchorText } from "@/lib/patch/access";
import { anchorByQuote } from "@/lib/patch/anchoring";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const TYPES = new Set(["correction", "highlight", "comment"]);
const SEVERITIES = new Set(["minor", "major", "suggestion"]);

/** List annotations for a submission/revision (?revisionId=...; omitted = original). */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);

  const revisionId = new URL(req.url).searchParams.get("revisionId");
  const revFilter = revisionId
    ? eq(essayAnnotationsTable.revisionId, revisionId)
    : isNull(essayAnnotationsTable.revisionId);

  const annotations = await db
    .select()
    .from(essayAnnotationsTable)
    .where(and(eq(essayAnnotationsTable.submissionId, submission.id), revFilter))
    .orderBy(asc(essayAnnotationsTable.orderIndex), asc(essayAnnotationsTable.startOffset));

  return json({ annotations });
});

/**
 * Add a manual (user-authored) annotation. Anchored server-side by quotedText
 * (same resolver as AI), so the client only sends the quote + an optional
 * `before` hint to disambiguate repeats.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const type = String(body.type ?? "");
  const quotedText = typeof body.quotedText === "string" ? body.quotedText : "";
  const revisionId = body.revisionId ? String(body.revisionId) : null;

  if (!TYPES.has(type)) throw new ApiError(400, "첨삭 유형이 올바르지 않습니다", "invalid_type");
  if (!quotedText) throw new ApiError(400, "첨삭할 구간(quotedText)이 필요합니다", "missing_quote");

  const text = await resolveAnchorText(submission, revisionId);
  const before = typeof body.before === "string" ? body.before : null;
  const span = anchorByQuote(text, quotedText, { hintBefore: before });
  if (span.orphaned) {
    throw new ApiError(400, "답안에서 해당 구간을 찾을 수 없습니다", "quote_not_found");
  }

  const severity = typeof body.severity === "string" && SEVERITIES.has(body.severity) ? body.severity : null;

  // Append to the end of the current ordering.
  const [{ value: maxOrder } = { value: null }] = await db
    .select({ value: max(essayAnnotationsTable.orderIndex) })
    .from(essayAnnotationsTable)
    .where(
      and(
        eq(essayAnnotationsTable.submissionId, submission.id),
        revisionId ? eq(essayAnnotationsTable.revisionId, revisionId) : isNull(essayAnnotationsTable.revisionId),
      ),
    );

  const [annotation] = await db
    .insert(essayAnnotationsTable)
    .values({
      submissionId: submission.id,
      revisionId,
      type: type as "correction" | "highlight" | "comment",
      startOffset: span.startOffset,
      endOffset: span.endOffset,
      quotedText,
      prefix: span.prefix,
      suffix: span.suffix,
      suggestedText: typeof body.suggestedText === "string" ? body.suggestedText : null,
      comment: typeof body.comment === "string" ? body.comment : null,
      color: typeof body.color === "string" ? body.color : null,
      severity: severity as "minor" | "major" | "suggestion" | null,
      source: "user",
      orphaned: 0,
      orderIndex: (maxOrder ?? -1) + 1,
    })
    .returning();

  return json({ annotation }, { status: 201 });
});
