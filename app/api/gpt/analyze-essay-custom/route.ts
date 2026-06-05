import { handle, json, ApiError } from "@/lib/http";
import { requireApiKey } from "@/lib/auth/apiKey";
import { startGptAnalysis } from "@/lib/gpt/analyze";

export const runtime = "nodejs";

/** GPT Actions: analyze an essay with a custom prompt and grading criteria. */
export const POST = handle(async (req: Request) => {
  const actor = await requireApiKey(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const essay = body.essay;
  const prompt = body.prompt;
  const criteria = body.criteria;
  if (!essay || typeof essay !== "string") {
    throw new ApiError(400, "답안(essay) 텍스트가 필요합니다", "missing_essay");
  }
  if (!prompt || typeof prompt !== "string") {
    throw new ApiError(400, "문제(prompt) 텍스트가 필요합니다", "missing_prompt");
  }
  if (!criteria || typeof criteria !== "string") {
    throw new ApiError(400, "채점 기준(criteria) 텍스트가 필요합니다", "missing_criteria");
  }

  const { submissionId, sessionId } = await startGptAnalysis(actor.userId, {
    essay,
    prompt,
    criteria,
    studentName: body.studentName ? String(body.studentName) : null,
    studentId: body.studentId ? String(body.studentId) : null,
    source: "gpt-custom",
  });

  return json(
    {
      submissionId,
      sessionId,
      status: "analyzing",
      message: "맞춤 기준으로 분석을 시작했습니다. /api/gpt/results/{submissionId} 에서 결과를 확인하세요",
      resultUrl: `/api/gpt/results/${submissionId}`,
    },
    { status: 202 },
  );
});
