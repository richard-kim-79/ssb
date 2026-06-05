import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptionsTable } from "@/lib/db/schema";

/**
 * Returns the plan id of the user's current (active/trial, non-expired) subscription,
 * or null if none. Used to resolve the AI model tier at grade time.
 */
export async function getUserActivePlanId(userId: string): Promise<string | null> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.userId, userId), inArray(subscriptionsTable.status, ["active", "trial"])))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!sub) return null;
  if (sub.endDate && sub.endDate.getTime() < Date.now()) return null;
  return sub.planId;
}
