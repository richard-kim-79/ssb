/**
 * Subscription + payment service layer.
 *
 * Centralizes the DB side-effects of payment flows so the route handlers stay
 * thin and the same logic is reused by the cron auto-renewal job. Everything
 * here runs in a trusted server context (Node runtime).
 */
import { and, eq, gte, inArray, isNotNull, lte, desc, lt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  subscriptionPlansTable,
  subscriptionsTable,
  paymentTransactionsTable,
  paymentIntentsTable,
  usageTrackingTable,
  type SubscriptionPlan,
  type Subscription,
  type User,
} from "@/lib/db/schema";
import { chargeBillingKey, TossError, type TossPayment } from "@/lib/payments/toss";

export type BillingPeriod = "monthly" | "yearly";

/** Add one billing period to a date (calendar month / year). */
export function addBillingPeriod(from: Date, period: BillingPeriod): Date {
  const d = new Date(from);
  if (period === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export async function getPlan(planId: string): Promise<SubscriptionPlan | null> {
  const [plan] = await db
    .select()
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, planId))
    .limit(1);
  return plan ?? null;
}

/** The user's most recent subscription row, or null. */
export async function getLatestSubscription(userId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);
  return sub ?? null;
}

/**
 * Reset/realign the usage-tracking row for a new billing period (best-effort —
 * the access gate counts submissions, this table is for invoicing/audit).
 */
async function resetUsageTracking(
  userId: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usageTrackingTable.id })
      .from(usageTrackingTable)
      .where(
        and(
          eq(usageTrackingTable.userId, userId),
          eq(usageTrackingTable.subscriptionId, subscriptionId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(usageTrackingTable)
        .set({ essayCount: 0, periodStart, periodEnd, lastResetAt: new Date(), updatedAt: new Date() })
        .where(eq(usageTrackingTable.id, existing.id));
    } else {
      await db.insert(usageTrackingTable).values({
        userId,
        subscriptionId,
        essayCount: 0,
        periodStart,
        periodEnd,
        lastResetAt: new Date(),
      });
    }
  } catch (err) {
    console.error("[payments] resetUsageTracking failed:", err);
  }
}

/**
 * Create or update the user's subscription to an active, paid state.
 * Used by both the one-time confirm and the billing-key issue flows.
 */
export async function activateSubscription(args: {
  userId: string;
  plan: SubscriptionPlan;
  paymentMethod: "toss_onetime" | "toss_billing";
  billingKey?: string | null;
  customerKey?: string | null;
}): Promise<Subscription> {
  const { userId, plan, paymentMethod } = args;
  const now = new Date();
  const endDate = addBillingPeriod(now, plan.billingPeriod);
  const autoRenew = paymentMethod === "toss_billing" ? 1 : 0;

  const existing = await getLatestSubscription(userId);

  let subscription: Subscription;
  if (existing) {
    [subscription] = await db
      .update(subscriptionsTable)
      .set({
        planId: plan.id,
        status: "active",
        paymentMethod,
        autoRenew,
        startDate: now,
        endDate,
        renewsAt: autoRenew ? endDate : null,
        canceledAt: null,
        nextPlanId: null,
        planChangeScheduledAt: null,
        tossBillingKey: args.billingKey ?? existing.tossBillingKey ?? null,
        tossCustomerKey: args.customerKey ?? existing.tossCustomerKey ?? null,
        updatedAt: now,
      })
      .where(eq(subscriptionsTable.id, existing.id))
      .returning();
  } else {
    [subscription] = await db
      .insert(subscriptionsTable)
      .values({
        userId,
        planId: plan.id,
        status: "active",
        paymentMethod,
        autoRenew,
        startDate: now,
        endDate,
        renewsAt: autoRenew ? endDate : null,
        tossBillingKey: args.billingKey ?? null,
        tossCustomerKey: args.customerKey ?? null,
      })
      .returning();
  }

  await resetUsageTracking(userId, subscription.id, now, endDate);
  return subscription;
}

/** Record a payment transaction (idempotent on orderId via the unique index). */
export async function recordTransaction(args: {
  subscriptionId: string;
  userId: string;
  planId: string;
  orderId: string;
  amount: number;
  status: "success" | "failed" | "pending";
  paymentKey?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
}): Promise<void> {
  const now = new Date();
  await db.insert(paymentTransactionsTable).values({
    subscriptionId: args.subscriptionId,
    userId: args.userId,
    planId: args.planId,
    orderId: args.orderId,
    amount: args.amount,
    status: args.status,
    paymentKey: args.paymentKey ?? null,
    failureCode: args.failureCode ?? null,
    failureReason: args.failureReason ?? null,
    capturedAt: args.status === "success" ? now : null,
  });
}

/** Mark a one-time payment intent as consumed. */
export async function markIntentUsed(intentId: string): Promise<void> {
  await db
    .update(paymentIntentsTable)
    .set({ used: 1 })
    .where(eq(paymentIntentsTable.intentId, intentId));
}

// ---------------------------------------------------------------------------
// Cron jobs
// ---------------------------------------------------------------------------

/** Delete payment intents past their 30-minute expiry. Idempotent by nature. */
export async function cleanupExpiredIntents(): Promise<{ deleted: number }> {
  const rows = await db
    .delete(paymentIntentsTable)
    .where(lt(paymentIntentsTable.expiresAt, new Date()))
    .returning({ id: paymentIntentsTable.intentId });
  return { deleted: rows.length };
}

export interface RenewalSummary {
  ranAt: string;
  due: number;
  charged: number;
  failed: number;
  skipped: number;
}

/**
 * Charge subscriptions due for auto-renewal.
 *
 * Idempotency: the order id is derived deterministically from the subscription
 * and the *period boundary being renewed* (`auto_<subId>_<YYYY-MM-DD>`). We
 * INSERT a `pending` transaction with that order id first; the UNIQUE index on
 * `order_id` makes the insert the claim — if a duplicate cron fire (or two
 * concurrent runners) tries the same renewal, its insert is a no-op and we skip
 * it. This prevents double-charging even if Vercel Cron fires twice.
 */
export async function processAutoRenewals(): Promise<RenewalSummary> {
  const now = new Date();
  const dueBefore = new Date(now.getTime() + 24 * 60 * 60 * 1000); // within 1 day
  const graceAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // retry window

  const due = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.status, "active"),
        eq(subscriptionsTable.autoRenew, 1),
        isNotNull(subscriptionsTable.tossBillingKey),
        lte(subscriptionsTable.endDate, dueBefore),
        gte(subscriptionsTable.endDate, graceAfter),
      ),
    );

  let charged = 0;
  let failed = 0;
  let skipped = 0;

  for (const sub of due) {
    const periodKey = sub.endDate.toISOString().slice(0, 10);
    const orderId = `auto_${sub.id}_${periodKey}`;

    // Claim this renewal by inserting the pending row. UNIQUE(order_id) makes
    // this atomic; a no-op insert means another runner already claimed it.
    const claimed = await db
      .insert(paymentTransactionsTable)
      .values({
        subscriptionId: sub.id,
        userId: sub.userId,
        planId: sub.planId,
        orderId,
        amount: 0, // updated below once we know the effective plan price
        status: "pending",
      })
      .onConflictDoNothing({ target: paymentTransactionsTable.orderId })
      .returning({ id: paymentTransactionsTable.id });

    if (claimed.length === 0) {
      skipped++;
      continue;
    }

    // Determine the effective plan (apply any scheduled change at renewal).
    const effectivePlanId =
      sub.nextPlanId && (!sub.planChangeScheduledAt || sub.planChangeScheduledAt <= now)
        ? sub.nextPlanId
        : sub.planId;
    const plan = await getPlan(effectivePlanId);
    if (!plan || !sub.tossBillingKey || !sub.tossCustomerKey) {
      await db
        .update(paymentTransactionsTable)
        .set({
          status: "failed",
          failureCode: "MISSING_BILLING_DATA",
          failureReason: "플랜 또는 빌링키 정보가 없습니다",
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactionsTable.orderId, orderId));
      failed++;
      continue;
    }

    try {
      const payment: TossPayment = await chargeBillingKey(sub.tossBillingKey, {
        customerKey: sub.tossCustomerKey,
        amount: plan.price,
        orderId,
        orderName: `${plan.name} 정기결제`,
      });

      // Extend from the existing boundary (not `now`) to avoid drift.
      const newEnd = addBillingPeriod(sub.endDate > now ? sub.endDate : now, plan.billingPeriod);
      await db
        .update(subscriptionsTable)
        .set({
          planId: plan.id,
          status: "active",
          endDate: newEnd,
          renewsAt: newEnd,
          nextPlanId: null,
          planChangeScheduledAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.id, sub.id));

      await db
        .update(paymentTransactionsTable)
        .set({
          amount: plan.price,
          status: "success",
          paymentKey: payment.paymentKey,
          capturedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactionsTable.orderId, orderId));

      await resetUsageTracking(sub.userId, sub.id, now, newEnd);
      charged++;
    } catch (err) {
      const code = err instanceof TossError ? err.code : "RENEWAL_ERROR";
      const reason = err instanceof Error ? err.message : "자동결제에 실패했습니다";
      await db
        .update(paymentTransactionsTable)
        .set({
          amount: plan.price,
          status: "failed",
          failureCode: code,
          failureReason: reason,
          lastRetryAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactionsTable.orderId, orderId));
      failed++;
    }
  }

  return { ranAt: now.toISOString(), due: due.length, charged, failed, skipped };
}

/** Expire subscriptions whose period ended and which are not set to renew. */
export async function expireEndedSubscriptions(): Promise<{ expired: number }> {
  const now = new Date();
  const rows = await db
    .update(subscriptionsTable)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        inArray(subscriptionsTable.status, ["active", "canceled"]),
        lt(subscriptionsTable.endDate, now),
        eq(subscriptionsTable.autoRenew, 0),
      ),
    )
    .returning({ id: subscriptionsTable.id });
  return { expired: rows.length };
}

export type { User };
