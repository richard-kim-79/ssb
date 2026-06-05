import { and, desc, eq, isNull } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { essaySubmissionsTable, analysisResultsTable } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth/apiKey";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ submissionId: string }> };

/** GPT Actions: poll for analysis results by submission id. */
export const GET = handle(async (req: Request, ctx: Ctx) => {
  const actor = await requireApiKey(req);
  const { submissionId } = await ctx.params;

  const [submission] = await db
    .select()
    .from(essaySubmissionsTable)
    .where(eq(essaySubmissionsTable.id, submissionId))
    .limit(1);
  if (!submission) throw new ApiError(404, "제출물을 찾을 수 없습니다", "not_found");
  if (submission.userId !== actor.userId) throw new ApiError(403, "접근 권한이 없습니다", "forbidden");

  if (submission.status === "pending" || submission.status === "analyzing") {
    return json({
      status: submission.status,
      progress: submission.progress,
      message: submission.progressMessage,
    });
  }

  if (submission.status === "error") {
    return json(
      { status: "error", message: submission.progressMessage || "분석에 실패했습니다" },
      { status: 500 },
    );
  }

  const [result] = await db
    .select()
    .from(analysisResultsTable)
    .where(and(eq(analysisResultsTable.submissionId, submissionId), isNull(analysisResultsTable.revisionId)))
    .orderBy(desc(analysisResultsTable.createdAt))
    .limit(1);
  if (!result) throw new ApiError(404, "분석 결과를 찾을 수 없습니다", "not_found");

  return json({
    status: "completed",
    studentName: submission.studentName,
    studentId: submission.studentId,
    overallScore: result.overallScore,
    maxScore: result.maxScore,
    categoryScores: result.categoryScores,
    strengths: result.strengths,
    improvementAreas: result.improvementAreas,
    detailedFeedback: result.detailedFeedback,
    suggestions: result.suggestions,
    analyzedAt: submission.analysisCompletedAt,
  });
});
