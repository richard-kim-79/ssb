import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { analysisSessionsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { cleanText } from "@/lib/parsing/document";
import { processUploads, filesFromForm } from "@/lib/parsing/uploads";

export const runtime = "nodejs";
// 사진·PDF 문제/기준 파일은 업로드 시 멀티모달 AI로 전사(OCR)하므로 시간이 더 걸릴 수 있다.
export const maxDuration = 300;

interface SessionInput {
  promptContent: string;
  criteriaContent: string;
  promptFilenames: string[];
  criteriaFilenames: string[];
  promptFilePaths: string[];
  criteriaFilePaths: string[];
}

async function readInput(req: Request, sessionId: string): Promise<SessionInput> {
  const ct = req.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      promptContent: cleanText(String(body.promptContent ?? "")),
      criteriaContent: cleanText(String(body.criteriaContent ?? "")),
      promptFilenames: [],
      criteriaFilenames: [],
      promptFilePaths: [],
      criteriaFilePaths: [],
    };
  }

  const form = await req.formData();
  const base = `permanent/sessions/${sessionId}`;
  const prompt = await processUploads(filesFromForm(form, "promptFiles"), `${base}/prompt`);
  const criteria = await processUploads(filesFromForm(form, "criteriaFiles"), `${base}/criteria`);

  const promptText = cleanText(String(form.get("promptText") ?? ""));
  const criteriaText = cleanText(String(form.get("criteriaText") ?? ""));

  return {
    promptContent: [promptText, prompt.text].filter(Boolean).join("\n\n"),
    criteriaContent: [criteriaText, criteria.text].filter(Boolean).join("\n\n"),
    promptFilenames: prompt.filenames,
    criteriaFilenames: criteria.filenames,
    promptFilePaths: prompt.paths,
    criteriaFilePaths: criteria.paths,
  };
}

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const sessionId = randomUUID();
  const input = await readInput(req, sessionId);

  if (input.promptContent.length < 5) {
    throw new ApiError(400, "문제(지문) 내용을 입력하거나 파일을 업로드해주세요", "missing_prompt");
  }
  if (input.criteriaContent.length < 5) {
    throw new ApiError(400, "채점 기준 내용을 입력하거나 파일을 업로드해주세요", "missing_criteria");
  }

  const [session] = await db
    .insert(analysisSessionsTable)
    .values({
      id: sessionId,
      userId: user.id,
      promptContent: input.promptContent,
      criteriaContent: input.criteriaContent,
      promptFilenames: input.promptFilenames,
      criteriaFilenames: input.criteriaFilenames,
      promptFilePaths: input.promptFilePaths,
      criteriaFilePaths: input.criteriaFilePaths,
    })
    .returning();

  return json({ session }, { status: 201 });
});

export const GET = handle(async () => {
  const user = await requireUser();
  const sessions = await db
    .select()
    .from(analysisSessionsTable)
    .where(eq(analysisSessionsTable.userId, user.id))
    .orderBy(desc(analysisSessionsTable.createdAt));
  return json({ sessions });
});
