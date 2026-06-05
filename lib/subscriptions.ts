import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptionPlansTable, subscriptionsTable, type Subscription } from "@/lib/db/schema";

const TRIAL_DAYS = 30;

/**
 * Create a trial subscription for a newly registered user.
 * Best-effort: if the "trial" plan isn't seeded yet, returns null rather than
 * failing registration (the usage gate falls back to a default trial limit).
 */
export async function createTrialSubscription(userId: string): Promise<Subscription | null> {
  const [trialPlan] = await db
    .select({ id: subscriptionPlansTable.id })
    .from(subscriptionPlansTable)
    .where(eq(subscriptionPlansTable.id, "trial"))
    .limit(1);
  if (!trialPlan) return null;

  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const [subscription] = await db
    .insert(subscriptionsTable)
    .values({
      userId,
      planId: "trial",
      status: "trial",
      autoRenew: 0,
      startDate: now,
      endDate: ends,
      trialEndsAt: ends,
    })
    .returning();

  return subscription ?? null;
}
