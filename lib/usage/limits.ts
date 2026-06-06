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
    // 활성 구독(체험 포함). 한도는 해당 플랜값을 따른다(체험 = 무제한).
    const [plan] = await db
      .select({ max: subscriptionPlansTable.maxEssaysPerMonth })
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .limit(1);
    limit = plan?.max ?? 0;
  } else {
    // 등록 사용자지만 활성 구독이 없음 = 무료 체험 종료/미가입 → 구독 필요(차단).
    limit = 0;
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
    if (user.isGuest === 1) {
      throw new ApiError(
        429,
        `게스트는 최대 ${status.limit}회까지 체험할 수 있습니다. 회원가입하면 한 달간 무료로 이용할 수 있어요`,
        "guest_limit_exceeded",
      );
    }
    if (!status.planId) {
      throw new ApiError(
        429,
        "무료 체험이 종료되었습니다. 계속 이용하려면 플랜을 구독해주세요",
        "trial_ended",
      );
    }
    throw new ApiError(
      429,
      `이번 기간에 사용 가능한 첨삭 횟수(${status.limit}회)를 모두 사용했습니다`,
      "usage_limit_exceeded",
    );
  }
  return status;
}
