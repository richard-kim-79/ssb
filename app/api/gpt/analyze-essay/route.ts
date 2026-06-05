import { handle, json, ApiError } from "@/lib/http";
import { requireApiKey } from "@/lib/auth/apiKey";
import { startGptAnalysis } from "@/lib/gpt/analyze";

export const runtime = "nodejs";

/** GPT Actions: analyze an essay with default criteria. */
export const POST = handle(async (req: Request) => {
  const actor = await requireApiKey(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const essay = body.essay;
  if (!essay || typeof essay !== "string") {
    throw new ApiError(400, "답안(essay) 텍스트가 필요합니다", "missing_essay");
  }

  const { submissionId, sessionId } = await startGptAnalysis(actor.userId, {
    essay,
    studentName: body.studentName ? String(body.studentName) : null,
    studentId: body.studentId ? String(body.studentId) : null,
    source: "gpt-default",
  });

  return json(
    {
      submissionId,
      sessionId,
      status: "analyzing",
      message: "분석을 시작했습니다. /api/gpt/results/{submissionId} 에서 결과를 확인하세요",
      resultUrl: `/api/gpt/results/${submissionId}`,
    },
    { status: 202 },
  );
});
