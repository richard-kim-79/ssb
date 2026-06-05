import { and, desc, eq, isNull } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { essaySubmissionsTable, analysisResultsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [submission] = await db
    .select()
    .from(essaySubmissionsTable)
    .where(eq(essaySubmissionsTable.id, id))
    .limit(1);
  if (!submission) throw new ApiError(404, "제출물을 찾을 수 없습니다", "not_found");
  if (submission.userId !== user.id && user.isAdmin !== 1) {
    throw new ApiError(403, "접근 권한이 없습니다", "forbidden");
  }

  let result = null;
  if (submission.status === "completed") {
    const [r] = await db
      .select()
      .from(analysisResultsTable)
      .where(and(eq(analysisResultsTable.submissionId, id), isNull(analysisResultsTable.revisionId)))
      .orderBy(desc(analysisResultsTable.createdAt))
      .limit(1);
    result = r ?? null;
  }

  return json({ submission, result });
});
