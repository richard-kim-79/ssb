import { and, eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { apiKeysTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Revoke an API key (soft-disable). Only the owner may revoke. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const [row] = await db
    .update(apiKeysTable)
    .set({ isActive: 0 })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, user.id)))
    .returning({ id: apiKeysTable.id });

  if (!row) throw new ApiError(404, "API 키를 찾을 수 없습니다", "not_found");
  return json({ ok: true, id: row.id });
});
