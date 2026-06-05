"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Session, Usage } from "@/lib/client/types";
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

  // create-session form state
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const promptFilesRef = useRef<HTMLInputElement>(null);
  const criteriaFilesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        if (!me.user) {
          router.replace("/login");
          return;
        }
        setIsGuest(me.user.isGuest === 1);
        setUsage(me.usage ?? null);
        const { sessions } = await api.listSessions();
        if (!alive) return;
        setSessions(sessions);
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
            <div className="text-lg font-semibold text-slate-900">{planLabel(usage.planId, isGuest)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">남은 채점 횟수</div>
            <div className="text-lg font-semibold text-slate-900">
              <span className={remaining === 0 ? "text-red-600" : "text-indigo-600"}>{remaining}</span>
              <span className="text-slate-400"> / {limit}</span>
            </div>
          </div>
        </Card>
      )}

      {remaining === 0 && (
        <Alert tone="info">
          이번 기간 채점 횟수({limit}회, 사용 {used}회)를 모두 사용했습니다. 더 채점하려면 플랜을 업그레이드하세요.
        </Alert>
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
