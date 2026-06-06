import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimitsTable } from "@/lib/db/schema";

/**
 * Fixed-window rate limiting backed by the `rate_limits` table.
 *
 * A row tracks (identifier, type, action) with a count and a window. When the
 * window expires the count resets. This is intentionally DB-backed (not
 * in-memory) so it survives the stateless serverless model — every invocation
 * sees the same counters.
 */

export type RateLimitType = "ip" | "device";

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  resetAt: Date;
}

export async function checkRateLimit(
  identifier: string,
  type: RateLimitType,
  action: string,
  limit: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;
  const cutoff = new Date(now.getTime() - windowMs);

  const [existing] = await db
    .select()
    .from(rateLimitsTable)
    .where(
      and(
        eq(rateLimitsTable.identifier, identifier),
        eq(rateLimitsTable.type, type),
        eq(rateLimitsTable.action, action),
      ),
    )
    .limit(1);

  // No row yet, or the existing window has expired → start a fresh window.
  if (!existing || existing.windowStart < cutoff) {
    const resetAt = new Date(now.getTime() + windowMs);
    if (existing) {
      await db
        .update(rateLimitsTable)
        .set({ count: 1, windowStart: now, resetAt, updatedAt: now })
        .where(eq(rateLimitsTable.id, existing.id));
    } else {
      await db.insert(rateLimitsTable).values({
        identifier,
        type,
        action,
        count: 1,
        windowStart: now,
        resetAt,
      });
    }
    return { allowed: true, current: 1, limit, resetAt };
  }

  // Window is active — enforce the cap.
  if (existing.count >= limit) {
    return { allowed: false, current: existing.count, limit, resetAt: existing.resetAt };
  }

  const next = existing.count + 1;
  await db
    .update(rateLimitsTable)
    .set({ count: next, updatedAt: now })
    .where(eq(rateLimitsTable.id, existing.id));
  return { allowed: true, current: next, limit, resetAt: existing.resetAt };
}

/** Remove expired windows. Intended for the hourly cron cleanup. */
export async function cleanupExpiredRateLimits(): Promise<void> {
  await db.delete(rateLimitsTable).where(lt(rateLimitsTable.resetAt, new Date()));
}
