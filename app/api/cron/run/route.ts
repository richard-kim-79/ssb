import { handle, json, ApiError } from "@/lib/http";
import {
  cleanupExpiredIntents,
  processAutoRenewals,
  expireEndedSubscriptions,
} from "@/lib/payments/subscription";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Hourly maintenance job (Vercel Cron → vercel.json).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
 * is set in the project env. We also accept `x-cron-secret` for manual triggers.
 * If CRON_SECRET is unset (local dev), the job runs unauthenticated.
 */
function assertCronAuthorized(req: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, "CRON_SECRET is not configured", "cron_misconfigured");
    }
    return; // dev: allow
  }
  const bearer = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const ok = bearer === `Bearer ${secret}` || headerSecret === secret;
  if (!ok) throw new ApiError(401, "Unauthorized", "unauthorized");
}

async function run(req: Request) {
  assertCronAuthorized(req);
  const intents = await cleanupExpiredIntents();
  const renewals = await processAutoRenewals();
  const expired = await expireEndedSubscriptions();
  return json({ ok: true, ranAt: new Date().toISOString(), intents, renewals, expired });
}

// Vercel Cron issues GET requests; allow POST for manual triggering too.
export const GET = handle(run);
export const POST = handle(run);
