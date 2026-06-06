import { z } from "zod";
import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  isAdmin: z.union([z.literal(0), z.literal(1)]),
});

/** Admin: grant or revoke admin rights for another user. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  // Guard against self-demotion (avoids locking yourself out of the admin area).
  if (id === admin.id) {
    throw new ApiError(400, "본인의 관리자 권한은 변경할 수 없습니다", "self_change_forbidden");
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new ApiError(404, "사용자를 찾을 수 없습니다", "not_found");
  if (target.isGuest === 1) {
    throw new ApiError(400, "게스트 계정은 관리자로 지정할 수 없습니다", "guest_forbidden");
  }

  const [row] = await db
    .update(users)
    .set({ isAdmin: parsed.data.isAdmin })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      isGuest: users.isGuest,
      guestUsageCount: users.guestUsageCount,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    });

  return json({ user: row });
});
