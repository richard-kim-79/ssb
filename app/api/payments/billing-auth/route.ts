import { randomUUID } from "crypto";
import { handle, json, ApiError } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getPlan } from "@/lib/payments/subscription";
import { isTossConfigured, tossClientKey } from "@/lib/payments/toss";

export const runtime = "nodejs";

/** Start the billing-key (recurring) auth flow: returns a fresh customerKey. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (user.isGuest === 1) {
    throw new ApiError(403, "결제는 회원가입 후 이용할 수 있습니다", "registration_required");
  }
  if (!isTossConfigured() || !tossClientKey()) {
    throw new ApiError(503, "결제가 아직 설정되지 않았습니다", "payments_unavailable");
  }

  const body = (await req.json().catch(() => ({}))) as { planId?: unknown };
  const planId = typeof body.planId === "string" ? body.planId : "";
  if (!planId) throw new ApiError(400, "플랜을 선택해주세요", "missing_plan");

  const plan = await getPlan(planId);
  if (!plan || plan.isActive !== 1) throw new ApiError(404, "유효하지 않은 플랜입니다", "invalid_plan");
  if (plan.price <= 0) throw new ApiError(400, "결제가 필요 없는 플랜입니다", "free_plan");

  // customerKey must be unique per customer; a UUID avoids leaking the user id.
  const customerKey = randomUUID();

  return json({
    customerKey,
    planId: plan.id,
    planName: plan.name,
    price: plan.price,
    billingPeriod: plan.billingPeriod,
    clientKey: tossClientKey(),
    customerEmail: user.email,
    customerName: user.displayName || user.username,
  });
});
