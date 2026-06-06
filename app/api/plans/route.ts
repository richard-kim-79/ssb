import { eq } from "drizzle-orm";
import { handle, json } from "@/lib/http";
import { db } from "@/lib/db/client";
import { subscriptionPlansTable } from "@/lib/db/schema";
import { SUBSCRIPTION_PLANS } from "@/lib/db/seed";

export const runtime = "nodejs";

/** Public: list active subscription plans (falls back to canonical seed list). */
export const GET = handle(async () => {
  try {
    const rows = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, 1));
    if (rows.length > 0) return json({ plans: rows });
  } catch {
    /* DB unavailable — fall through to seed list */
  }
  return json({ plans: SUBSCRIPTION_PLANS });
});
