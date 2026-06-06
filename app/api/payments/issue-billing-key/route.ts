import { handle, json, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getPlan, activateSubscription, recordTransaction } from "@/lib/payments/subscription";
import { issueBillingKey, chargeBillingKey, TossError } from "@/lib/payments/toss";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Issue a durable billing key from the browser-issued authKey, charge the first
 * month immediately, and activate the recurring subscription. Renewals are then
 * handled by the Vercel cron job (processAutoRenewals).
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (user.isGuest === 1) {
    throw new ApiError(403, "결제는 회원가입 후 이용할 수 있습니다", "registration_required");
  }

  const body = (await req.json().catch(() => ({}))) as {
    authKey?: unknown;
    customerKey?: unknown;
    planId?: unknown;
  };
  const authKey = typeof body.authKey === "string" ? body.authKey : "";
  const customerKey = typeof body.customerKey === "string" ? body.customerKey : "";
  const planId = typeof body.planId === "string" ? body.planId : "";
  if (!authKey || !customerKey || !planId) {
    throw new ApiError(400, "정기결제 정보가 올바르지 않습니다", "invalid_billing");
  }

  const plan = await getPlan(planId);
  if (!plan || plan.isActive !== 1) throw new ApiError(404, "유효하지 않은 플랜입니다", "invalid_plan");
  if (plan.price <= 0) throw new ApiError(400, "결제가 필요 없는 플랜입니다", "free_plan");

  // 1) Exchange the one-time authKey for a durable billing key.
  let billing;
  try {
    billing = await issueBillingKey({ authKey, customerKey });
  } catch (err) {
    if (err instanceof TossError) throw new ApiError(400, err.message, err.code);
    throw err;
  }

  // 2) Charge the first month before granting access.
  const orderId = `first_${user.id.replace(/-/g, "").slice(0, 16)}_${Date.now()}`;
  let payment;
  try {
    payment = await chargeBillingKey(billing.billingKey, {
      customerKey,
      amount: plan.price,
      orderId,
      orderName: `써봄 ${plan.name} - 첫 결제`,
      customerEmail: user.email,
      customerName: user.displayName || user.username,
    });
  } catch (err) {
    if (err instanceof TossError) {
      throw new ApiError(402, `첫 결제에 실패했습니다: ${err.message}`, err.code);
    }
    throw err;
  }

  // 3) Activate the recurring subscription and persist the billing key.
  const subscription = await activateSubscription({
    userId: user.id,
    plan,
    paymentMethod: "toss_billing",
    billingKey: billing.billingKey,
    customerKey,
  });

  await recordTransaction({
    subscriptionId: subscription.id,
    userId: user.id,
    planId: plan.id,
    orderId,
    amount: plan.price,
    status: "success",
    paymentKey: payment.paymentKey,
  });

  return json({
    success: true,
    message: "정기결제가 등록되었습니다.",
    subscription: {
      planId: subscription.planId,
      status: subscription.status,
      paymentMethod: subscription.paymentMethod,
      autoRenew: subscription.autoRenew === 1,
      expiresAt: subscription.endDate.toISOString(),
      renewsAt: subscription.renewsAt?.toISOString() ?? null,
    },
    cardInfo: billing.card
      ? { cardType: billing.card.cardType ?? null, number: billing.card.number ?? null }
      : null,
    payment: {
      orderId: payment.orderId,
      amount: payment.totalAmount,
      approvedAt: payment.approvedAt ?? null,
    },
  });
});
