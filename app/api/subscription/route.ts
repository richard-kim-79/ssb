import { handle, json } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLatestSubscription, getPlan } from "@/lib/payments/subscription";
import { getUsageStatus } from "@/lib/usage/limits";

export const runtime = "nodejs";

/** Current user's subscription + plan + usage status. */
export const GET = handle(async () => {
  const user = await requireUser();
  const subscription = await getLatestSubscription(user.id);
  const plan = subscription ? await getPlan(subscription.planId) : null;
  const usage = await getUsageStatus(user);
  return json({ subscription, plan, usage });
});
