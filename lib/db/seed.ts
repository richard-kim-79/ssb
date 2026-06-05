import { db } from "@/lib/db/client";
import { subscriptionPlansTable, type InsertSubscriptionPlan } from "@/lib/db/schema";

/**
 * Canonical subscription plans (ported from the original app).
 * Idempotent: `seedPlans()` skips insert if any plan already exists.
 */
export const SUBSCRIPTION_PLANS: InsertSubscriptionPlan[] = [
  {
    id: "trial",
    name: "무료 체험",
    description: "10편의 무료 첨삭으로 서비스를 체험해보세요",
    price: 0,
    currency: "KRW",
    billingPeriod: "monthly",
    maxEssaysPerMonth: 10,
    maxUsers: 1,
    features: ["기본 첨삭", "점수 분석", "1개월 히스토리"],
    isActive: 1,
  },
  {
    id: "individual",
    name: "개인 플랜",
    description: "논술 학습자를 위한 기본 플랜",
    price: 2000,
    currency: "KRW",
    billingPeriod: "monthly",
    maxEssaysPerMonth: 999999,
    maxUsers: 1,
    features: ["무제한 논술 분석", "상세 피드백 리포트", "히스토리 관리", "파일 업로드 (TXT·DOCX)", "동시 첨삭 3개"],
    isActive: 1,
  },
  {
    id: "individual_yearly",
    name: "개인 플랜 (연간)",
    description: "논술 학습자를 위한 기본 플랜 (연간 결제)",
    price: 20000,
    currency: "KRW",
    billingPeriod: "yearly",
    maxEssaysPerMonth: 999999,
    maxUsers: 1,
    features: ["무제한 논술 분석", "상세 피드백 리포트", "히스토리 관리", "파일 업로드 (TXT·DOCX)", "동시 첨삭 3개"],
    isActive: 1,
  },
  {
    id: "educator",
    name: "교사 플랜",
    description: "교사·과외 강사를 위한 전문 플랜",
    price: 5000,
    currency: "KRW",
    billingPeriod: "monthly",
    maxEssaysPerMonth: 999999,
    maxUsers: 1,
    features: ["개인 플랜 모든 기능", "배치 첨삭 (최대 50편 동시)", "무제한 히스토리", "우선 고객 지원"],
    isActive: 1,
  },
  {
    id: "educator_yearly",
    name: "교사 플랜 (연간)",
    description: "교사·과외 강사를 위한 전문 플랜 (연간 결제)",
    price: 50000,
    currency: "KRW",
    billingPeriod: "yearly",
    maxEssaysPerMonth: 999999,
    maxUsers: 1,
    features: ["개인 플랜 모든 기능", "배치 첨삭 (최대 50편 동시)", "무제한 히스토리", "우선 고객 지원"],
    isActive: 1,
  },
  {
    id: "business",
    name: "비즈니스 플랜",
    description: "대량 처리가 필요한 기관·기업을 위한 맞춤 플랜",
    price: 299000,
    currency: "KRW",
    billingPeriod: "monthly",
    maxEssaysPerMonth: 999999,
    maxUsers: 1,
    features: ["동시 첨삭 10,000건 이상", "전국 모의고사 대규모 처리", "맞춤 성적 산출 방식", "맞춤 분석 리포트·성적표", "전담 계정 매니저"],
    isActive: 1,
  },
];

export async function seedPlans(): Promise<{ inserted: number }> {
  const existing = await db.select({ id: subscriptionPlansTable.id }).from(subscriptionPlansTable).limit(1);
  if (existing.length > 0) {
    return { inserted: 0 };
  }
  await db.insert(subscriptionPlansTable).values(SUBSCRIPTION_PLANS);
  return { inserted: SUBSCRIPTION_PLANS.length };
}
