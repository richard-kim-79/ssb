import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { ApiError } from "@/lib/http";
import { getSession, type SessionPayload } from "@/lib/auth/session";

/** Returns the current session payload or throws 401. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "로그인이 필요합니다", "unauthorized");
  return session;
}

/** Returns the full current user row from the DB, or throws 401. */
export async function requireUser(): Promise<User> {
  const session = await requireAuth();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) throw new ApiError(401, "사용자를 찾을 수 없습니다", "unauthorized");
  return user;
}

/** Returns the current user only if admin, else throws 403. */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.isAdmin !== 1) throw new ApiError(403, "관리자 권한이 필요합니다", "forbidden");
  return user;
}

/** Returns the current user or null (no throw) — for optional-auth endpoints. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return user ?? null;
}
