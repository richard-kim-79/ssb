import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  analysisResultsTable,
  analysisSessionsTable,
  essayAnnotationsTable,
  essayRevisionsTable,
  essaySubmissionsTable,
  type CategoryScore,
  type EssayAnnotation,
} from "@/lib/db/schema";
import { analyzeEssay, resolveTier } from "@/lib/ai";
import { getUserActivePlanId } from "@/lib/usage/plan";
import { resolveAnchor } from "@/lib/patch/anchoring";

export interface RegradeJobResult {
  status: "completed" | "skipped" | "error";
  revisionId: string;
}

export interface ImprovedCategory {
  name: string;
  before: number | null;
  after: number;
  delta: number | null;
}

interface ParentBaseline {
  overallScore: number;
  maxScore: number;
  categories: CategoryScore[];
}

/**
 * The grading the new revision is measured against:
 *  - parentRevisionId set  → that revision's stored result
 *  - parentRevisionId null → the original submission's result (revisionId IS NULL)
 * Returns null if the parent was never graded (delta then stays null).
 */
async function getParentBaseline(submissionId: string, parentRevisionId: string | null): Promise<ParentBaseline | null> {
  if (parentRevisionId) {
    const [parent] = await db
      .select()
      .from(essayRevisionsTable)
      .where(eq(essayRevisionsTable.id, parentRevisionId))
      .limit(1);
    if (!parent?.resultId) return null;
    const [r] = await db
      .select()
      .from(analysisResultsTable)
      .where(eq(analysisResultsTable.id, parent.resultId))
      .limit(1);
    if (!r) return null;
    return { overallScore: r.overallScore, maxScore: r.maxScore, categories: r.categoryScores as CategoryScore[] };
  }

  const [r] = await db
    .select()
    .from(analysisResultsTable)
    .where(and(eq(analysisResultsTable.submissionId, submissionId), isNull(analysisResultsTable.revisionId)))
    .orderBy(asc(analysisResultsTable.createdAt))
    .limit(1);
  if (!r) return null;
  return { overallScore: r.overallScore, maxScore: r.maxScore, categories: r.categoryScores as CategoryScore[] };
}

/** Match new categories to the baseline by name; surface per-category deltas. */
function computeImprovedCategories(baseline: CategoryScore[] | null, next: CategoryScore[]): ImprovedCategory[] {
  const byName = new Map<string, CategoryScore>();
  for (const c of baseline ?? []) byName.set(c.name, c);
  return next.map((c) => {
    const before = byName.get(c.name);
    return {
      name: c.name,
      before: before ? before.score : null,
      after: c.score,
      delta: before ? c.score - before.score : null,
    };
  });
}

/**
 * Re-anchor the parent revision's annotations onto the new revision's text so the
 * student's existing 첨삭 carry forward. Spans the student rewrote can't be found
 * and are flagged `orphaned` (a "feedback applied" signal), never silently dropped.
 */
async function rebaseAnnotations(
  submissionId: string,
  parentRevisionId: string | null,
  newRevisionId: string,
  newContent: string,
): Promise<void> {
  const parentAnnotations: EssayAnnotation[] = parentRevisionId
    ? await db.select().from(essayAnnotationsTable).where(eq(essayAnnotationsTable.revisionId, parentRevisionId))
    : await db
        .select()
        .from(essayAnnotationsTable)
        .where(and(eq(essayAnnotationsTable.submissionId, submissionId), isNull(essayAnnotationsTable.revisionId)));

  if (parentAnnotations.length === 0) return;

  const rows = parentAnnotations.map((a) => {
    const resolved = resolveAnchor(newContent, {
      quotedText: a.quotedText,
      prefix: a.prefix,
      suffix: a.suffix,
      startOffset: a.startOffset,
      endOffset: a.endOffset,
    });
    return {
      submissionId,
      revisionId: newRevisionId,
      type: a.type,
      startOffset: resolved.startOffset,
      endOffset: resolved.endOffset,
      quotedText: a.quotedText,
      prefix: resolved.prefix,
      suffix: resolved.suffix,
      suggestedText: a.suggestedText,
      comment: a.comment,
      color: a.color,
      severity: a.severity,
      source: a.source,
      orphaned: resolved.orphaned ? 1 : 0,
      orderIndex: a.orderIndex,
    };
  });

  await db.insert(essayAnnotationsTable).values(rows);
}

/**
 * Re-grade a single essay revision. Idempotent via a conditional claim, mirroring
 * `processGradeJob`. Throws on terminal failure so QStash retries the whole job.
 */
export async function processRegradeJob(revisionId: string): Promise<RegradeJobResult> {
  // Claim the revision (pending|error -> analyzing). Zero rows = already taken.
  const claimed = await db
    .update(essayRevisionsTable)
    .set({ status: "analyzing", progress: 25, progressMessage: "AI가 수정한 답안을 다시 채점하고 있습니다" })
    .where(and(eq(essayRevisionsTable.id, revisionId), inArray(essayRevisionsTable.status, ["pending", "error"])))
    .returning();

  if (claimed.length === 0) {
    return { status: "skipped", revisionId };
  }
  const revision = claimed[0];

  try {
    const [submission] = await db
      .select()
      .from(essaySubmissionsTable)
      .where(eq(essaySubmissionsTable.id, revision.submissionId))
      .limit(1);
    if (!submission) throw new Error("제출물을 찾을 수 없습니다.");

    const [session] = await db
      .select()
      .from(analysisSessionsTable)
      .where(eq(analysisSessionsTable.id, submission.sessionId))
      .limit(1);
    if (!session) throw new Error("세션을 찾을 수 없습니다.");

    const planId = await getUserActivePlanId(submission.userId);
    const tier = resolveTier(planId);

    const { result, model, tier: usedTier } = await analyzeEssay(
      {
        promptText: session.promptContent,
        criteriaText: session.criteriaContent,
        essayText: revision.content,
        studentInfo: {
          name: submission.studentName ?? undefined,
          studentId: submission.studentId ?? undefined,
        },
      },
      tier,
    );

    await db
      .update(essayRevisionsTable)
      .set({ progress: 80, progressMessage: "점수 변화와 개선점을 계산하고 있습니다" })
      .where(eq(essayRevisionsTable.id, revisionId));

    const [inserted] = await db
      .insert(analysisResultsTable)
      .values({
        submissionId: revision.submissionId,
        revisionId,
        overallScore: result.overallScore,
        maxScore: result.maxScore,
        categoryScores: result.categories,
        strengths: result.strengths,
        improvementAreas: result.improvementAreas,
        detailedFeedback: result.detailedFeedback,
        suggestions: result.suggestions,
        model,
        tier: usedTier,
      })
      .returning();

    const baseline = await getParentBaseline(revision.submissionId, revision.parentRevisionId);
    const scoreDelta = baseline ? result.overallScore - baseline.overallScore : null;
    const improvedCategories = computeImprovedCategories(baseline?.categories ?? null, result.categories);

    await db
      .update(essayRevisionsTable)
      .set({
        resultId: inserted.id,
        overallScore: result.overallScore,
        maxScore: result.maxScore,
        scoreDelta,
        improvedCategories,
        status: "completed",
        progress: 100,
        progressMessage: "재채점이 완료되었습니다! 점수 변화를 확인해보세요",
        completedAt: new Date(),
      })
      .where(eq(essayRevisionsTable.id, revisionId));

    // Best-effort: carry the parent's 첨삭 forward onto the new text.
    try {
      await rebaseAnnotations(revision.submissionId, revision.parentRevisionId, revisionId, revision.content);
    } catch (err) {
      console.error(`Annotation rebase failed (revision ${revisionId}):`, err);
    }

    return { status: "completed", revisionId };
  } catch (error) {
    console.error(`Regrade job failed (${revisionId}):`, error);
    await db
      .update(essayRevisionsTable)
      .set({ status: "error", progress: 0, progressMessage: "재채점 중 오류가 발생했습니다. 다시 시도해주세요" })
      .where(eq(essayRevisionsTable.id, revisionId));
    throw error; // let QStash retry
  }
}
