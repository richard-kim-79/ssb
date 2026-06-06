import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { subscriptionsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { getLatestSubscription } from "@/lib/payments/subscription";

export const runtime = "nodejs";

/**
 * Cancel auto-renewal. Access is kept until the current period ends; the billing
 * key is retained so the user can re-enable without re-authenticating their card.
 */
export const POST = handle(async () => {
  const user = await requireUser();
  const sub = await getLatestSubscription(user.id);
  if (!sub || sub.autoRenew !== 1) {
    throw new ApiError(400, "취소할 정기결제가 없습니다", "no_active_billing");
  }

  const [updated] = await db
    .update(subscriptionsTable)
    .set({ autoRenew: 0, status: "canceled", canceledAt: new Date(), renewsAt: null, updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, sub.id))
    .returning();

  return json({
    success: true,
    message: "정기결제가 취소되었습니다. 현재 구독 기간이 끝나면 자동으로 종료됩니다.",
    subscription: {
      status: updated.status,
      autoRenew: updated.autoRenew === 1,
      expiresAt: updated.endDate.toISOString(),
    },
  });
});
