"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function BillingSuccessInner() {
  const params = useSearchParams();
  const authKey = params.get("authKey") ?? "";
  const customerKey = params.get("customerKey") ?? "";
  const planId = params.get("planId") ?? "";

  const valid = Boolean(authKey && customerKey && planId);
  const [status, setStatus] = useState<"working" | "done" | "error">(valid ? "working" : "error");
  const [message, setMessage] = useState<string>(valid ? "" : "정기결제 정보가 올바르지 않습니다.");
  const ran = useRef(false);

  useEffect(() => {
    if (!valid || ran.current) return; // exchange the authKey exactly once
    ran.current = true;
    (async () => {
      try {
        const res = await api.issueBillingKey(authKey, customerKey, planId);
        setMessage(res.message || "정기결제가 등록되었습니다.");
        setStatus("done");
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : "정기결제 등록에 실패했습니다.");
        setStatus("error");
      }
    })();
  }, [valid, authKey, customerKey, planId]);

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        {status === "working" && (
          <>
            <Spinner className="h-8 w-8 text-indigo-600" />
            <p className="font-semibold text-slate-900">정기결제를 등록하는 중입니다…</p>
            <p className="text-sm text-slate-500">잠시만 기다려주세요. 창을 닫지 마세요.</p>
          </>
        )}
        {status === "done" && (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">
              ✓
            </div>
            <p className="text-lg font-bold text-slate-900">정기결제가 등록되었습니다</p>
            <p className="text-sm text-slate-500">{message}</p>
            <Link href="/my-work" className="w-full">
              <Button className="w-full">내 작업으로 이동</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <Alert>{message}</Alert>
            <Link href="/plans" className="w-full">
              <Button variant="secondary" className="w-full">
                요금제로 돌아가기
              </Button>
            </Link>
          </>
        )}
      </Card>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </main>
      }
    >
      <BillingSuccessInner />
    </Suspense>
  );
}
