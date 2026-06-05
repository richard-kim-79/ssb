import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { subscriptionPlansTable } from "@/lib/db/schema";
import { SUBSCRIPTION_PLANS } from "@/lib/db/seed";
import { Button, Card } from "@/components/ui";

export const runtime = "nodejs";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "요금제",
  description: "써봄의 요금제를 확인하세요. 무료 체험부터 개인·교사·비즈니스 플랜까지, 필요에 맞는 AI 논술 첨삭 플랜을 선택할 수 있습니다.",
  alternates: { canonical: "/plans" },
};

interface PlanView {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingPeriod: string;
  maxEssaysPerMonth: number;
  features: string[];
}

function formatPrice(price: number): string {
  if (price <= 0) return "무료";
  return `₩${price.toLocaleString("ko-KR")}`;
}

function quota(max: number): string {
  return max >= 999999 ? "무제한 첨삭" : `월 ${max.toLocaleString("ko-KR")}편 첨삭`;
}

async function loadPlans(): Promise<Map<string, PlanView>> {
  let rows: PlanView[];
  try {
    const dbRows = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.isActive, 1));
    rows = dbRows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      billingPeriod: r.billingPeriod,
      maxEssaysPerMonth: r.maxEssaysPerMonth,
      features: (r.features as string[]) ?? [],
    }));
    if (rows.length === 0) throw new Error("empty");
  } catch {
    // DB not seeded / unavailable — fall back to the canonical plan list.
    rows = SUBSCRIPTION_PLANS.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      price: r.price,
      billingPeriod: r.billingPeriod ?? "monthly",
      maxEssaysPerMonth: r.maxEssaysPerMonth,
      features: (r.features as string[]) ?? [],
    }));
  }
  return new Map(rows.map((r) => [r.id, r]));
}

// Curated display tiers (monthly id + optional yearly id).
const TIERS: { id: string; yearlyId?: string; highlight?: boolean; cta: string }[] = [
  { id: "trial", cta: "무료로 시작하기" },
  { id: "individual", yearlyId: "individual_yearly", highlight: true, cta: "시작하기" },
  { id: "educator", yearlyId: "educator_yearly", cta: "시작하기" },
  { id: "business", cta: "시작하기" },
];

export default async function PlansPage() {
  const plans = await loadPlans();

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">요금제</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg leading-8 text-slate-600">
          무료 체험으로 시작하고, 필요에 맞는 플랜으로 언제든 업그레이드하세요. 모든 플랜에 AI 채점과 인라인 첨삭이
          포함됩니다.
        </p>
      </section>

      <section className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const plan = plans.get(tier.id);
          if (!plan) return null;
          const yearly = tier.yearlyId ? plans.get(tier.yearlyId) : undefined;
          return (
            <Card
              key={tier.id}
              className={
                "flex flex-col p-6 " + (tier.highlight ? "border-indigo-300 ring-2 ring-indigo-200" : "")
              }
            >
              {tier.highlight && (
                <span className="mb-3 inline-block w-fit rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-medium text-white">
                  인기
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
              {plan.description && (
                <p className="mt-1 min-h-[40px] text-sm leading-6 text-slate-500">{plan.description}</p>
              )}

              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900">{formatPrice(plan.price)}</span>
                {plan.price > 0 && <span className="text-sm text-slate-500"> / 월</span>}
              </div>
              {yearly && (
                <p className="mt-1 text-xs text-indigo-600">
                  연간 결제 시 {formatPrice(yearly.price)} (2개월 무료)
                </p>
              )}

              <p className="mt-4 text-sm font-medium text-slate-700">{quota(plan.maxEssaysPerMonth)}</p>
              <ul className="mt-3 flex flex-1 flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/register" className="mt-6">
                <Button variant={tier.highlight ? "primary" : "secondary"} className="w-full">
                  {tier.cta}
                </Button>
              </Link>
            </Card>
          );
        })}
      </section>

      <p className="mt-8 text-center text-sm text-slate-500">
        비즈니스·기관 대량 도입(전국 모의고사 등)은 가입 후 문의해 주세요. 결제는 토스페이먼츠로 안전하게
        처리됩니다.
      </p>
    </main>
  );
}
