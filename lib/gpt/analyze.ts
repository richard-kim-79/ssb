import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analysisSessionsTable, essaySubmissionsTable, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/http";
import { assertUnderUsageLimit } from "@/lib/usage/limits";
import { cleanText } from "@/lib/parsing/document";
import { enqueueGrade } from "@/lib/queue/enqueue";

export const DEFAULT_GPT_PROMPT = "다음 답안을 분석해주세요.";

export const DEFAULT_GPT_CRITERIA = `다음 기준으로 평가해주세요:
1. 논리적 구조 (25점): 주장이 명확하고 논리적으로 전개되었는가?
2. 논증의 타당성 (25점): 주장을 뒷받침하는 근거가 충분하고 타당한가?
3. 근거의 신빙성 (25점): 제시된 근거가 신뢰할 수 있고 구체적인가?
4. 언어 표현 (25점): 문법, 어휘, 문체가 적절하고 명확한가?`;

export interface GptAnalyzeInput {
  essay: string;
  prompt?: string;
  criteria?: string;
  studentName?: string | null;
  studentId?: string | null;
  source: "gpt-default" | "gpt-custom";
}

export interface GptAnalyzeResult {
  submissionId: string;
  sessionId: string;
}

/**
 * Start a GPT Actions analysis: validates usage, creates a session + a pending
 * submission, and enqueues grading. The caller (GPT) polls /api/gpt/results.
 */
export async function startGptAnalysis(
  userId: string,
  input: GptAnalyzeInput,
): Promise<GptAnalyzeResult> {
  const essay = input.essay.startsWith("[IMAGE_DATA:") ? input.essay : cleanText(input.essay);
  if (!essay || essay.length < 5) {
    throw new ApiError(400, "답안 내용이 필요합니다", "missing_essay");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ApiError(401, "사용자를 찾을 수 없습니다", "unauthorized");

  await assertUnderUsageLimit(user);

  const promptContent = cleanText(input.prompt ?? DEFAULT_GPT_PROMPT) || DEFAULT_GPT_PROMPT;
  const criteriaContent = cleanText(input.criteria ?? DEFAULT_GPT_CRITERIA) || DEFAULT_GPT_CRITERIA;
  const tag = input.source === "gpt-custom" ? "gpt-actions-custom.txt" : "gpt-actions-default.txt";

  const [session] = await db
    .insert(analysisSessionsTable)
    .values({
      userId,
      promptContent,
      criteriaContent,
      promptFilenames: [tag],
      criteriaFilenames: [tag],
      promptFilePaths: [],
      criteriaFilePaths: [],
    })
    .returning();

  const [submission] = await db
    .insert(essaySubmissionsTable)
    .values({
      sessionId: session.id,
      userId,
      studentName: input.studentName ?? null,
      studentId: input.studentId ?? null,
      essayContent: essay,
      status: "pending",
      progress: 0,
      progressMessage: "대기 중입니다",
    })
    .returning();

  await enqueueGrade(submission.id);

  return { submissionId: submission.id, sessionId: session.id };
}
