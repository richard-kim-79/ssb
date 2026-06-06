import { desc } from "drizzle-orm";
import { handle, json } from "@/lib/http";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/guards";

export const runtime = "nodejs";

/** Admin: list all users (newest first). Excludes password hashes. */
export const GET = handle(async () => {
  await requireAdmin();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      displayName: users.displayName,
      isAdmin: users.isAdmin,
      isGuest: users.isGuest,
      guestUsageCount: users.guestUsageCount,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return json({ users: rows });
});
