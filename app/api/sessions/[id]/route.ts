import { and, desc, eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { analysisSessionsTable, essaySubmissionsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [session] = await db
    .select()
    .from(analysisSessionsTable)
    .where(eq(analysisSessionsTable.id, id))
    .limit(1);

  if (!session) throw new ApiError(404, "세션을 찾을 수 없습니다", "not_found");
  if (session.userId !== user.id && user.isAdmin !== 1) {
    throw new ApiError(403, "접근 권한이 없습니다", "forbidden");
  }

  const submissions = await db
    .select()
    .from(essaySubmissionsTable)
    .where(and(eq(essaySubmissionsTable.sessionId, id)))
    .orderBy(desc(essaySubmissionsTable.submittedAt));

  return json({ session, submissions });
});
