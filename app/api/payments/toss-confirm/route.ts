import { eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { paymentIntentsTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import {
  getPlan,
  activateSubscription,
  recordTransaction,
  markIntentUsed,
} from "@/lib/payments/subscription";
import { confirmPayment, TossError } from "@/lib/payments/toss";

export const runtime = "nodejs";

/** Confirm a one-time Toss payment, then activate the subscription. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();

  const body = (await req.json().catch(() => ({}))) as {
    paymentKey?: unknown;
    orderId?: unknown;
  };
  const paymentKey = typeof body.paymentKey === "string" ? body.paymentKey : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!paymentKey || !orderId) {
    throw new ApiError(400, "결제 정보가 올바르지 않습니다", "invalid_payment");
  }

  // Look up + validate the intent (server-trusted amount).
  const [intent] = await db
    .select()
    .from(paymentIntentsTable)
    .where(eq(paymentIntentsTable.intentId, orderId))
    .limit(1);

  if (!intent || intent.userId !== user.id) {
    throw new ApiError(404, "결제 요청을 찾을 수 없습니다", "intent_not_found");
  }
  if (intent.used === 1) {
    throw new ApiError(409, "이미 처리된 결제입니다", "intent_used");
  }
  if (intent.expiresAt.getTime() < Date.now()) {
    await db.delete(paymentIntentsTable).where(eq(paymentIntentsTable.intentId, orderId));
    throw new ApiError(410, "결제 요청이 만료되었습니다. 다시 시도해주세요", "intent_expired");
  }

  const plan = await getPlan(intent.planId);
  if (!plan) throw new ApiError(404, "플랜 정보를 찾을 수 없습니다", "invalid_plan");

  // Confirm with Toss using the trusted amount from the intent.
  let payment;
  try {
    payment = await confirmPayment({ paymentKey, orderId, amount: intent.amount });
  } catch (err) {
    if (err instanceof TossError) {
      throw new ApiError(400, err.message, err.code);
    }
    throw err;
  }

  // Consume the intent first (prevents replay even if later steps retry).
  await markIntentUsed(orderId);

  const subscription = await activateSubscription({
    userId: user.id,
    plan,
    paymentMethod: "toss_onetime",
  });

  await recordTransaction({
    subscriptionId: subscription.id,
    userId: user.id,
    planId: plan.id,
    orderId,
    amount: intent.amount,
    status: "success",
    paymentKey: payment.paymentKey,
  });

  return json({
    success: true,
    message: "결제가 완료되었습니다.",
    subscription: {
      planId: subscription.planId,
      status: subscription.status,
      expiresAt: subscription.endDate.toISOString(),
    },
    payment: {
      orderId: payment.orderId,
      orderName: payment.orderName ?? null,
      method: payment.method ?? null,
      totalAmount: payment.totalAmount,
      approvedAt: payment.approvedAt ?? null,
    },
  });
});
