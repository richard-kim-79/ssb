import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { essaySubmissionsTable, subscriptionPlansTable, type User } from "@/lib/db/schema";
import { getUserActivePlanId } from "@/lib/usage/plan";
import { ApiError } from "@/lib/http";

/**
 * Usage limits for the grading loop.
 *
 * Counting strategy: we derive the current usage by counting rows in
 * `essay_submissions` rather than maintaining a separate counter. Each
 * submission inserts exactly one row, so the count is naturally idempotent —
 * a QStash redelivery or worker retry never double-counts (it doesn't insert).
 * Phase 3 layers billing-period-aligned `usage_tracking` on top for invoicing;
 * this module is the access gate.
 */

const GUEST_LIMIT = 3; // ephemeral guest accounts
const TRIAL_LIMIT = 10; // registered user with no active paid subscription

export interface UsageStatus {
  current: number;
  limit: number;
  remaining: number;
  planId: string | null;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function getUsageStatus(user: User): Promise<UsageStatus> {
  const isGuest = user.isGuest === 1;
  const planId = isGuest ? null : await getUserActivePlanId(user.id);

  let limit: number;
  if (isGuest) {
    limit = GUEST_LIMIT;
  } else if (planId) {
    const [plan] = await db
      .select({ max: subscriptionPlansTable.maxEssaysPerMonth })
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .limit(1);
    limit = plan?.max ?? TRIAL_LIMIT;
  } else {
    limit = TRIAL_LIMIT;
  }

  // Guests: count all-time (the account itself is short-lived).
  // Registered: count the current calendar month.
  const since = isGuest ? null : startOfMonth();
  const whereClause = since
    ? and(eq(essaySubmissionsTable.userId, user.id), gte(essaySubmissionsTable.submittedAt, since))
    : eq(essaySubmissionsTable.userId, user.id);

  const [row] = await db.select({ c: count() }).from(essaySubmissionsTable).where(whereClause);
  const current = Number(row?.c ?? 0);

  return { current, limit, remaining: Math.max(0, limit - current), planId };
}

/** Throws 429 if the user is at/over their limit; otherwise returns the status. */
export async function assertUnderUsageLimit(user: User): Promise<UsageStatus> {
  const status = await getUsageStatus(user);
  if (status.current >= status.limit) {
    throw new ApiError(
      429,
      `이번 기간에 사용 가능한 첨삭 횟수(${status.limit}회)를 모두 사용했습니다`,
      "usage_limit_exceeded",
    );
  }
  return status;
}
