"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Session, Usage, SubscriptionInfo } from "@/lib/client/types";
import { Alert, Button, Card, Field, Spinner } from "@/components/ui";

// 플랜 표시 이름 (스키마를 클라이언트로 import하지 않기 위해 인라인)
const PLAN_LABELS: Record<string, string> = {
  trial: "무료 체험",
  individual: "개인",
  individual_yearly: "개인 (연간)",
  educator: "교육자",
  educator_yearly: "교육자 (연간)",
  business: "비즈니스",
};

function planLabel(planId: string | null | undefined, isGuest: boolean): string {
  if (isGuest) return "게스트";
  if (!planId) return "무료 체험";
  return PLAN_LABELS[planId] ?? planId;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function summarize(text: string, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t || "(내용 없음)";
}

export default function MyWorkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);

  // create-session form state
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const promptFilesRef = useRef<HTMLInputElement>(null);
  const criteriaFilesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 세 호출은 서로 의존하지 않으므로 병렬 실행 (순차 대비 약 3배 빠름)
        const [meRes, sessionsRes, subRes] = await Promise.allSettled([
          api.me(),
          api.listSessions(),
          api.getSubscription(),
        ]);
        if (!alive) return;

        // 인증 확인: me 실패 또는 비로그인 → 로그인 페이지로
        if (meRes.status !== "fulfilled" || !meRes.value.user) {
          router.replace("/login");
          return;
        }
        setIsGuest(meRes.value.user.isGuest === 1);
        setUsage(meRes.value.usage ?? null);

        // 세션 목록은 실패해도 페이지는 계속 동작
        if (sessionsRes.status === "fulfilled") {
          setSessions(sessionsRes.value.sessions);
        }
        // 구독 정보는 부가 정보 — 없거나 조회 실패해도 무시
        if (subRes.status === "fulfilled") {
          setSubscription(subRes.value.subscription);
        }
      } catch {
        if (alive) router.replace("/login");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const promptFiles = promptFilesRef.current?.files;
    const criteriaFiles = criteriaFilesRef.current?.files;

    if (!promptFiles || promptFiles.length === 0) {
      setError("문제(지문) 파일을 업로드해주세요");
      return;
    }
    if (!criteriaFiles || criteriaFiles.length === 0) {
      setError("채점 기준 파일을 업로드해주세요");
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      for (const f of Array.from(promptFiles)) form.append("promptFiles", f);
      for (const f of Array.from(criteriaFiles)) form.append("criteriaFiles", f);
      const { session } = await api.createSessionForm(form);
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "세션 생성에 실패했습니다");
      setCreating(false);
    }
  }

  async function cancelBilling() {
    if (!window.confirm("정기결제를 해지하시겠어요? 남은 기간까지는 계속 이용할 수 있습니다.")) {
      return;
    }
    setCanceling(true);
    setBillingMsg(null);
    try {
      const res = await api.cancelBilling();
      setBillingMsg(res.message || "정기결제가 해지되었습니다.");
      // 최신 구독 상태로 갱신
      try {
        const sub = await api.getSubscription();
        setSubscription(sub.subscription);
      } catch {
        /* 갱신 실패는 무시 */
      }
    } catch (err) {
      setBillingMsg(err instanceof ApiError ? err.message : "정기결제 해지에 실패했습니다.");
    } finally {
      setCanceling(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  const remaining = usage?.remaining ?? 0;
  const limit = usage?.limit ?? 0;
  const used = usage?.current ?? 0;
  const unlimited = limit >= 999999;
  // 등록 사용자인데 활성 구독(체험 포함)이 없음 = 무료 체험 종료/미가입
  const trialEnded = !isGuest && usage != null && usage.planId == null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">내 작업</h1>
        <p className="mt-1 text-sm text-slate-500">새 채점 세션을 만들고 지난 세션을 확인하세요</p>
      </div>

      {/* Usage banner */}
      {usage && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="text-sm text-slate-500">현재 플랜</div>
            <div className="text-lg font-semibold text-slate-900">
              {trialEnded ? "체험 종료" : planLabel(usage.planId, isGuest)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">{unlimited ? "이번 달 채점" : "남은 채점 횟수"}</div>
            <div className="text-lg font-semibold text-slate-900">
              {unlimited ? (
                <span className="text-indigo-600">무제한</span>
              ) : (
                <>
                  <span className={remaining === 0 ? "text-red-600" : "text-indigo-600"}>{remaining}</span>
                  <span className="text-slate-400"> / {limit}</span>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {trialEnded ? (
        <Alert tone="info">
          무료 체험(가입 후 30일)이 종료되었습니다. 계속 이용하려면 아래에서 플랜을 구독해주세요.
        </Alert>
      ) : (
        !unlimited &&
        remaining === 0 && (
          <Alert tone="info">
            이번 기간 채점 횟수({limit}회, 사용 {used}회)를 모두 사용했습니다. 더 채점하려면 플랜을 업그레이드하세요.
          </Alert>
        )
      )}

      {/* Subscription / billing */}
      {subscription ? (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-500">구독 상태</div>
              <div className="text-lg font-semibold text-slate-900">
                {planLabel(subscription.planId, isGuest)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {subscription.autoRenew === 1 && subscription.status === "active"
                    ? "· 매월 자동결제"
                    : subscription.status === "canceled"
                      ? "· 해지 예약됨"
                      : ""}
                </span>
              </div>
            </div>
            {subscription.autoRenew === 1 && subscription.status === "active" ? (
              <Button variant="secondary" onClick={cancelBilling} disabled={canceling}>
                {canceling ? <Spinner className="h-4 w-4" /> : "정기결제 해지"}
              </Button>
            ) : (
              <Link href="/plans">
                <Button variant="secondary">플랜 변경</Button>
              </Link>
            )}
          </div>

          {subscription.autoRenew === 1 && subscription.renewsAt && (
            <p className="text-sm text-slate-500">
              다음 결제일: {formatDate(subscription.renewsAt)}
            </p>
          )}
          {subscription.status === "canceled" && (
            <p className="text-sm text-slate-500">
              {formatDate(subscription.endDate)}까지 이용할 수 있습니다.
            </p>
          )}
          {billingMsg && (
            <div className="mt-1">
              <Alert tone="info">{billingMsg}</Alert>
            </div>
          )}
        </Card>
      ) : (
        !isGuest && (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="text-sm text-slate-500">정기결제</div>
              <div className="text-base font-medium text-slate-800">
                매월 자동결제로 더 많이 채점하세요
              </div>
            </div>
            <Link href="/plans">
              <Button>요금제 보기</Button>
            </Link>
          </Card>
        )
      )}

      {/* Create session */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">새 채점 세션 만들기</h2>
        <form onSubmit={createSession} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="문제 (지문) 파일" hint="PDF · 사진 · docx · txt — 사진·PDF는 AI가 자동으로 글자를 읽어옵니다">
            <input
              ref={promptFilesRef}
              type="file"
              multiple
              accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </Field>
          <Field label="채점 기준 파일" hint="PDF · 사진 · docx · txt">
            <input
              ref={criteriaFilesRef}
              type="file"
              multiple
              accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </Field>
          <Button type="submit" disabled={creating}>
            {creating ? <Spinner className="h-4 w-4" /> : "세션 만들기"}
          </Button>
        </form>
      </Card>

      {/* Session list */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">지난 세션</h2>
        {sessions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">아직 만든 세션이 없습니다.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`}>
                  <Card className="p-5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-medium text-slate-800">{summarize(s.promptContent)}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatDate(s.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{summarize(s.criteriaContent, 60)}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
