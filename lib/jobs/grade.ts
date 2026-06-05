import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analysisResultsTable, analysisSessionsTable, essaySubmissionsTable } from "@/lib/db/schema";
import { analyzeEssay, resolveTier } from "@/lib/ai";
import { getUserActivePlanId } from "@/lib/usage/plan";

export interface GradeJobResult {
  status: "completed" | "skipped" | "error";
  submissionId: string;
}

/**
 * Grade a single submission. Idempotent: a conditional claim ensures only one
 * QStash delivery does the work; redeliveries are deduped.
 * Throws on a terminal failure so QStash can retry the whole job.
 */
export async function processGradeJob(submissionId: string): Promise<GradeJobResult> {
  // Claim the submission (pending|error -> analyzing). Zero rows = already taken.
  const claimed = await db
    .update(essaySubmissionsTable)
    .set({
      status: "analyzing",
      progress: 25,
      progressMessage: "AI가 답안을 분석하고 있습니다",
      analysisStartedAt: new Date(),
    })
    .where(and(eq(essaySubmissionsTable.id, submissionId), inArray(essaySubmissionsTable.status, ["pending", "error"])))
    .returning();

  if (claimed.length === 0) {
    return { status: "skipped", submissionId };
  }
  const submission = claimed[0];

  try {
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
        essayText: submission.essayContent,
        studentInfo: {
          name: submission.studentName ?? undefined,
          studentId: submission.studentId ?? undefined,
        },
      },
      tier,
    );

    await db.update(essaySubmissionsTable)
      .set({ progress: 90, progressMessage: "종합 점수를 계산하고 맞춤형 피드백을 생성하고 있습니다" })
      .where(eq(essaySubmissionsTable.id, submissionId));

    await db.insert(analysisResultsTable).values({
      submissionId,
      overallScore: result.overallScore,
      maxScore: result.maxScore,
      categoryScores: result.categories,
      strengths: result.strengths,
      improvementAreas: result.improvementAreas,
      detailedFeedback: result.detailedFeedback,
      suggestions: result.suggestions,
      model,
      tier: usedTier,
    });

    await db.update(essaySubmissionsTable)
      .set({
        status: "completed",
        progress: 100,
        progressMessage: "분석이 완료되었습니다! 결과를 확인해보세요",
        analysisCompletedAt: new Date(),
      })
      .where(eq(essaySubmissionsTable.id, submissionId));

    return { status: "completed", submissionId };
  } catch (error) {
    console.error(`Grade job failed (${submissionId}):`, error);
    await db.update(essaySubmissionsTable)
      .set({ status: "error", progress: 0, progressMessage: "분석 중 오류가 발생했습니다. 다시 시도해주세요" })
      .where(eq(essaySubmissionsTable.id, submissionId));
    throw error; // let QStash retry
  }
}
