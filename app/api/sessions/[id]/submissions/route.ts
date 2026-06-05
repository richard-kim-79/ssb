import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { analysisSessionsTable, essaySubmissionsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { assertUnderUsageLimit } from "@/lib/usage/limits";
import { cleanText, validateContent } from "@/lib/parsing/document";
import { processUploads, filesFromForm } from "@/lib/parsing/uploads";
import { enqueueGrade } from "@/lib/queue/enqueue";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

interface SubmissionInput {
  essayContent: string;
  studentName: string | null;
  studentId: string | null;
  essayFilename: string | null;
  essayFilePath: string | null;
}

async function readInput(req: Request, submissionId: string): Promise<SubmissionInput> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const raw = String(body.essayContent ?? "");
    const text = raw.startsWith("[IMAGE_DATA:") ? raw : cleanText(raw);
    return {
      essayContent: text,
      studentName: body.studentName ? String(body.studentName) : null,
      studentId: body.studentId ? String(body.studentId) : null,
      essayFilename: null,
      essayFilePath: null,
    };
  }

  const form = await req.formData();
  const upload = await processUploads(
    filesFromForm(form, "essayFiles"),
    `permanent/submissions/${submissionId}`,
  );
  const pasted = String(form.get("essayContent") ?? "");
  const pastedText = pasted.startsWith("[IMAGE_DATA:") ? pasted : cleanText(pasted);

  return {
    essayContent: [pastedText, upload.text].filter(Boolean).join("\n\n"),
    studentName: form.get("studentName") ? String(form.get("studentName")) : null,
    studentId: form.get("studentId") ? String(form.get("studentId")) : null,
    essayFilename: upload.filenames[0] ?? null,
    essayFilePath: upload.paths[0] ?? null,
  };
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

  // Gate on usage BEFORE inserting the row (the row is the usage counter).
  await assertUnderUsageLimit(user);

  const submissionId = randomUUID();
  const input = await readInput(req, submissionId);

  if (!input.essayContent || input.essayContent.length < 5) {
    throw new ApiError(400, "답안 내용을 입력하거나 파일을 업로드해주세요", "missing_essay");
  }
  const isImage = input.essayContent.startsWith("[IMAGE_DATA:");
  if (!isImage && !validateContent({ text: input.essayContent, filename: "", fileType: "", extractedAt: "" }, "essay")) {
    throw new ApiError(400, "답안 내용이 올바르지 않습니다", "invalid_essay");
  }

  const [submission] = await db
    .insert(essaySubmissionsTable)
    .values({
      id: submissionId,
      sessionId,
      userId: user.id,
      studentName: input.studentName,
      studentId: input.studentId,
      essayContent: input.essayContent,
      essayFilename: input.essayFilename,
      essayFilePath: input.essayFilePath,
      status: "pending",
      progress: 0,
      progressMessage: "대기 중입니다",
    })
    .returning();

  await enqueueGrade(submissionId);

  return json({ submission }, { status: 202 });
});

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id: sessionId } = await ctx.params;

  const [session] = await db
    .select({ userId: analysisSessionsTable.userId })
    .from(analysisSessionsTable)
    .where(eq(analysisSessionsTable.id, sessionId))
    .limit(1);
  if (!session) throw new ApiError(404, "세션을 찾을 수 없습니다", "not_found");
  if (session.userId !== user.id && user.isAdmin !== 1) {
    throw new ApiError(403, "접근 권한이 없습니다", "forbidden");
  }

  const submissions = await db
    .select()
    .from(essaySubmissionsTable)
    .where(eq(essaySubmissionsTable.sessionId, sessionId))
    .orderBy(desc(essaySubmissionsTable.submittedAt));

  return json({ submissions });
});
