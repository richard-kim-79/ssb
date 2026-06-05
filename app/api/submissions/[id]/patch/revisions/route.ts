import { asc, eq, max } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { analysisResultsTable, essayRevisionsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { loadOwnedSubmission, loadRevisionForSubmission } from "@/lib/patch/access";
import { cleanText } from "@/lib/parsing/document";
import { diffTokens } from "@/lib/patch/diff";
import { enqueueRegrade } from "@/lib/queue/enqueue";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** List a submission's revisions (versions), newest grading result joined in. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);

  const revisions = await db
    .select({ revision: essayRevisionsTable, result: analysisResultsTable })
    .from(essayRevisionsTable)
    .leftJoin(analysisResultsTable, eq(analysisResultsTable.id, essayRevisionsTable.resultId))
    .where(eq(essayRevisionsTable.submissionId, submission.id))
    .orderBy(asc(essayRevisionsTable.versionNumber));

  return json({ revisions });
});

/**
 * Create a new revision (student re-submission). Snapshots the (normalized) text,
 * computes a token diff against its parent, and enqueues an async re-grade.
 * The original answer is the implicit version 1; the first revision is version 2.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const submission = await loadOwnedSubmission(id, user);

  const body = (await req.json().catch(() => ({}))) as { content?: unknown; parentRevisionId?: unknown };
  const content = cleanText(String(body.content ?? ""));
  if (!content || content.length < 5) {
    throw new ApiError(400, "수정한 답안 내용을 입력해주세요", "missing_content");
  }

  const parentRevisionId = body.parentRevisionId ? String(body.parentRevisionId) : null;
  const parentContent = parentRevisionId
    ? (await loadRevisionForSubmission(submission.id, parentRevisionId)).content
    : submission.essayContent;

  const [{ value: maxVersion } = { value: null }] = await db
    .select({ value: max(essayRevisionsTable.versionNumber) })
    .from(essayRevisionsTable)
    .where(eq(essayRevisionsTable.submissionId, submission.id));

  const diffFromParent = diffTokens(parentContent, content);

  const [revision] = await db
    .insert(essayRevisionsTable)
    .values({
      submissionId: submission.id,
      versionNumber: (maxVersion ?? 1) + 1, // original = implicit v1
      parentRevisionId,
      content,
      diffFromParent,
      status: "pending",
      progress: 0,
      progressMessage: "대기 중입니다",
    })
    .returning();

  await enqueueRegrade(revision.id);

  return json({ revision }, { status: 202 });
});
