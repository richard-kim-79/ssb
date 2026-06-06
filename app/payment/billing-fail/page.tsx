"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function BillingFailInner() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl">
          ✕
        </div>
        <p className="text-lg font-bold text-slate-900">정기결제에 실패했습니다</p>
        <Alert>{message || "카드 인증이 취소되었거나 실패했습니다. 다시 시도해주세요."}</Alert>
        {code && <p className="text-xs text-slate-400">오류 코드: {code}</p>}
        <Link href="/plans" className="w-full">
          <Button className="w-full">요금제로 돌아가기</Button>
        </Link>
      </Card>
    </main>
  );
}

export default function BillingFailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </main>
      }
    >
      <BillingFailInner />
    </Suspense>
  );
}
