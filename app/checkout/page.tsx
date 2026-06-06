"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { loadTossPayments, isUserCancel } from "@/lib/client/toss";
import type { Plan } from "@/lib/client/types";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function formatPrice(price: number): string {
  return `₩${price.toLocaleString("ko-KR")}`;
}

function periodLabel(p: string): string {
  return p === "yearly" ? "년" : "월";
}

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();
  const planId = params.get("plan") ?? "";

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<null | "billing" | "onetime">(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { user } = await api.me();
        if (!user) {
          router.replace(`/login?next=${encodeURIComponent(`/checkout?plan=${planId}`)}`);
          return;
        }
        const { plans } = await api.getPlans();
        if (!alive) return;
        const found = plans.find((p) => p.id === planId) ?? null;
        setPlan(found);
        if (!found) setError("유효하지 않은 플랜입니다.");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : "플랜을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [planId, router]);

  async function startBilling() {
    if (!plan) return;
    setError(null);
    setWorking("billing");
    try {
      const auth = await api.billingAuth(plan.id);
      const toss = await loadTossPayments(auth.clientKey);
      const origin = window.location.origin;
      await toss.requestBillingAuth("카드", {
        customerKey: auth.customerKey,
        successUrl: `${origin}/payment/billing-success?planId=${encodeURIComponent(plan.id)}`,
        failUrl: `${origin}/payment/billing-fail`,
        customerEmail: auth.customerEmail,
        customerName: auth.customerName,
      });
    } catch (err) {
      if (isUserCancel(err)) {
        setWorking(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "결제 요청에 실패했습니다.");
      setWorking(null);
    }
  }

  async function startOneTime() {
    if (!plan) return;
    setError(null);
    setWorking("onetime");
    try {
      const intent = await api.createIntent(plan.id);
      const toss = await loadTossPayments(intent.clientKey);
      const origin = window.location.origin;
      await toss.requestPayment("카드", {
        amount: intent.amount,
        orderId: intent.orderId,
        orderName: intent.orderName,
        successUrl: `${origin}/payment/success`,
        failUrl: `${origin}/payment/fail`,
        customerEmail: intent.customerEmail,
        customerName: intent.customerName,
      });
    } catch (err) {
      if (isUserCancel(err)) {
        setWorking(null);
        return;
      }
      setError(err instanceof ApiError ? err.message : "결제 요청에 실패했습니다.");
      setWorking(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Alert>{error ?? "플랜을 찾을 수 없습니다."}</Alert>
        <div className="mt-4">
          <Link href="/plans" className="text-sm font-medium text-indigo-600 hover:underline">
            ← 요금제로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const isYearly = plan.billingPeriod === "yearly";

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/plans" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 요금제
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">결제</h1>

      <Card className="mt-6 p-6">
        <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
        {plan.description && <p className="mt-1 text-sm text-slate-500">{plan.description}</p>}
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">{formatPrice(plan.price)}</span>
          <span className="text-sm text-slate-500">/ {periodLabel(plan.billingPeriod)}</span>
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={startBilling} disabled={working !== null} className="w-full">
            {working === "billing" ? (
              <Spinner className="h-4 w-4" />
            ) : (
              `${isYearly ? "매년" : "매월"} 자동결제 시작`
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={startOneTime}
            disabled={working !== null}
            className="w-full"
          >
            {working === "onetime" ? <Spinner className="h-4 w-4" /> : "이번 한 번만 결제"}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          자동결제는 {isYearly ? "1년" : "1개월"}마다 자동으로 갱신되며 언제든 해지할 수 있습니다. 결제는
          토스페이먼츠로 안전하게 처리됩니다.
        </p>
      </Card>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </main>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
