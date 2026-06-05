import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import {
  analysisSessionsTable,
  essaySubmissionsTable,
  canUseBatchProcessing,
  getBatchLimitForPlan,
  type EssaySubmission,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getUserActivePlanId } from "@/lib/usage/plan";
import { getUsageStatus } from "@/lib/usage/limits";
import { cleanText, validateContent } from "@/lib/parsing/document";
import { processUploads, filesFromForm } from "@/lib/parsing/uploads";
import { enqueueGrade } from "@/lib/queue/enqueue";

export const runtime = "nodejs";
// 사진·PDF 답안은 업로드 시 멀티모달 AI로 전사(OCR)하므로 배치는 시간이 더 걸릴 수 있다.
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

interface EssayItem {
  essayContent: string;
  studentName: string | null;
  studentId: string | null;
  essayFilename: string | null;
  essayFilePath: string | null;
}

async function readItems(req: Request): Promise<EssayItem[]> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { essays?: unknown };
    const arr = Array.isArray(body.essays) ? body.essays : [];
    return arr.map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        essayContent: cleanText(String(item.essayContent ?? "")),
        studentName: item.studentName ? String(item.studentName) : null,
        studentId: item.studentId ? String(item.studentId) : null,
        essayFilename: null,
        essayFilePath: null,
      };
    });
  }

  // multipart: one submission per uploaded file (each saved under its own id).
  const form = await req.formData();
  const files = filesFromForm(form, "essayFiles");
  const items: EssayItem[] = [];
  for (const file of files) {
    const submissionId = randomUUID();
    const upload = await processUploads([file], `permanent/submissions/${submissionId}`);
    items.push({
      essayContent: upload.text,
      studentName: null,
      studentId: null,
      essayFilename: upload.filenames[0] ?? null,
      essayFilePath: upload.paths[0] ?? null,
    });
  }
  return items;
}

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id: sessionId } = await ctx.params;

  const [session] = await db
    .select()
    .from(analysisSessionsTable)
    .where(eq(analysisSessionsTable.id, sessionId))
    .limit(1);
  if (!session) throw new ApiError(404, "세션을 찾을 수 없습니다", "not_found");
  if (session.userId !== user.id && user.isAdmin !== 1) {
    throw new ApiError(403, "접근 권한이 없습니다", "forbidden");
  }

  const planId = user.isGuest === 1 ? null : await getUserActivePlanId(user.id);
  if (!planId || !canUseBatchProcessing(planId)) {
    throw new ApiError(403, "배치 첨삭은 유료 플랜에서만 사용할 수 있습니다", "batch_not_allowed");
  }

  const items = (await readItems(req)).filter(
    (it) => it.essayContent && it.essayContent.length >= 5,
  );
  if (items.length === 0) {
    throw new ApiError(400, "제출할 답안이 없습니다", "missing_essays");
  }

  const batchLimit = getBatchLimitForPlan(planId);
  if (items.length > batchLimit) {
    throw new ApiError(400, `한 번에 최대 ${batchLimit}편까지 제출할 수 있습니다`, "batch_limit_exceeded");
  }

  const usage = await getUsageStatus(user);
  if (items.length > usage.remaining) {
    throw new ApiError(
      429,
      `남은 첨삭 횟수(${usage.remaining}회)를 초과했습니다`,
      "usage_limit_exceeded",
    );
  }

  const created: EssaySubmission[] = [];
  for (const item of items) {
    if (
      !validateContent(
        { text: item.essayContent, filename: "", fileType: "", extractedAt: "" },
        "essay",
      )
    ) {
      continue; // skip invalid entries rather than failing the whole batch
    }

    const submissionId = randomUUID();
    const [submission] = await db
      .insert(essaySubmissionsTable)
      .values({
        id: submissionId,
        sessionId,
        userId: user.id,
        studentName: item.studentName,
        studentId: item.studentId,
        essayContent: item.essayContent,
        essayFilename: item.essayFilename,
        essayFilePath: item.essayFilePath,
        status: "pending",
        progress: 0,
        progressMessage: "대기 중입니다",
      })
      .returning();

    await enqueueGrade(submissionId);
    created.push(submission);
  }

  return json({ submissions: created, count: created.length }, { status: 202 });
});
