import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { users, userLoginSchema } from "@/lib/db/schema";
import { findByUsername, sanitizeUser } from "@/lib/auth/users";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => null);
  const parsed = userLoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const user = await findByUsername(parsed.data.username);
  if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
    throw new ApiError(401, "사용자명 또는 비밀번호가 올바르지 않습니다", "invalid_credentials");
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await setSessionCookie({ userId: user.id, isGuest: user.isGuest === 1, isAdmin: user.isAdmin === 1 });

  return json({ user: sanitizeUser(user) });
});
