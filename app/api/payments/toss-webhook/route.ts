import { createHmac, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { handle, json } from "@/lib/http";
import { db } from "@/lib/db/client";
import { paymentTransactionsTable, subscriptionsTable } from "@/lib/db/schema";
import { getPayment, isTossConfigured, TossError } from "@/lib/payments/toss";

export const runtime = "nodejs";

/**
 * Toss webhook — a durable, out-of-band source of truth for payment status.
 *
 * We don't trust the payload blindly: when configured, we verify the optional
 * HMAC signature (TOSS_SECURITY_KEY), and we ALWAYS re-fetch the payment from
 * the Toss API before mutating anything. Reconciliation is idempotent — a
 * transaction already marked success is left untouched. Always returns 200 for
 * handled/ignored events so Toss doesn't retry endlessly; returns 500 only on
 * unexpected server errors (which Toss will retry).
 */

/** Optional HMAC-SHA256 verification over the raw body using the security key. */
function signatureValid(rawBody: string, header: string | null): boolean {
  const key = process.env.TOSS_SECURITY_KEY;
  if (!key || !header) return true; // not configured / no signature header → skip
  try {
    const expected = createHmac("sha256", key).update(rawBody).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const POST = handle(async (req: Request) => {
  const rawBody = await req.text();

  const sig =
    req.headers.get("tosspayments-webhook-signature") ||
    req.headers.get("x-tosspayments-webhook-signature") ||
    req.headers.get("toss-signature");
  if (!signatureValid(rawBody, sig)) {
    return json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: { eventType?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: true, ignored: "unparseable" });
  }

  const data = payload.data ?? {};
  const paymentKey = typeof data.paymentKey === "string" ? data.paymentKey : "";
  const orderId = typeof data.orderId === "string" ? data.orderId : "";

  // Only act on payment-status events we can reconcile by orderId.
  if (!orderId) return json({ ok: true, ignored: "no_order_id" });
  if (!isTossConfigured()) return json({ ok: true, ignored: "not_configured" });

  // Re-fetch from Toss (source of truth) before mutating.
  let realStatus = typeof data.status === "string" ? data.status : "";
  let verifiedPaymentKey = paymentKey;
  if (paymentKey) {
    try {
      const payment = await getPayment(paymentKey);
      realStatus = payment.status;
      verifiedPaymentKey = payment.paymentKey;
    } catch (err) {
      if (err instanceof TossError && err.httpStatus < 500) {
        return json({ ok: true, ignored: "payment_not_found", code: err.code });
      }
      throw err; // 5xx → let Toss retry
    }
  }

  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.orderId, orderId))
    .limit(1);

  if (!tx) return json({ ok: true, ignored: "unknown_order" });

  if (realStatus === "DONE") {
    if (tx.status !== "success") {
      await db
        .update(paymentTransactionsTable)
        .set({
          status: "success",
          paymentKey: verifiedPaymentKey || tx.paymentKey,
          capturedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentTransactionsTable.id, tx.id));
      // Ensure the subscription is active (in case the client confirm never ran).
      await db
        .update(subscriptionsTable)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, tx.subscriptionId));
    }
    return json({ ok: true, reconciled: "success" });
  }

  if (realStatus === "CANCELED" || realStatus === "ABORTED" || realStatus === "EXPIRED") {
    if (tx.status !== "failed") {
      await db
        .update(paymentTransactionsTable)
        .set({ status: "failed", failureCode: realStatus, updatedAt: new Date() })
        .where(eq(paymentTransactionsTable.id, tx.id));
    }
    return json({ ok: true, reconciled: "failed" });
  }

  return json({ ok: true, ignored: `status_${realStatus || "unknown"}` });
});
