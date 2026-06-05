"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Session, Submission } from "@/lib/client/types";
import { Alert, Button, Card, Field, Input, ProgressBar, Spinner, StatusBadge, Textarea } from "@/components/ui";

const ACTIVE = new Set(["pending", "analyzing"]);

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function fileToImageMarker(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return `[IMAGE_DATA:${file.type || "image/jpeg"};base64,${b64}]`;
}

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // submit form
  const [studentName, setStudentName] = useState("");
  const [essayText, setEssayText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const essayFilesRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const { session, submissions } = await api.getSession(sessionId);
    setSession(session);
    setSubmissions(submissions);
    return submissions;
  }, [sessionId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "세션을 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh, router]);

  // Poll while any submission is still pending/analyzing.
  useEffect(() => {
    const anyActive = submissions.some((s) => ACTIVE.has(s.status));
    if (!anyActive) return;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [submissions, refresh]);

  async function submitEssay(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const files = essayFilesRef.current?.files;
    const imageFiles = files ? Array.from(files).filter((f) => f.type.startsWith("image/")) : [];
    const docFiles = files ? Array.from(files).filter((f) => !f.type.startsWith("image/")) : [];
    const hasText = essayText.trim().length >= 5;

    if (!hasText && imageFiles.length === 0 && docFiles.length === 0) {
      setSubmitError("답안을 입력하거나 파일을 업로드해주세요");
      return;
    }

    setSubmitting(true);
    try {
      // Image answers are sent as inline [IMAGE_DATA:...] markers via JSON so the
      // vision pipeline picks them up; document/text uploads go through multipart.
      if (imageFiles.length > 0 && docFiles.length === 0) {
        const marker = await fileToImageMarker(imageFiles[0]);
        const essayContent = hasText ? `${essayText}\n\n${marker}` : marker;
        await api.createSubmission(sessionId, {
          essayContent,
          studentName: studentName || undefined,
        });
      } else if (docFiles.length > 0 || imageFiles.length > 0) {
        const form = new FormData();
        if (hasText) form.set("essayContent", essayText);
        if (studentName) form.set("studentName", studentName);
        for (const f of [...docFiles, ...imageFiles]) form.append("essayFiles", f);
        await api.createSubmissionForm(sessionId, form);
      } else {
        await api.createSubmission(sessionId, {
          essayContent: essayText,
          studentName: studentName || undefined,
        });
      }

      setEssayText("");
      setStudentName("");
      if (essayFilesRef.current) essayFilesRef.current.value = "";
      await refresh();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "제출에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  if (loadError || !session) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert>{loadError ?? "세션을 찾을 수 없습니다"}</Alert>
        <div className="mt-4">
          <Link href="/my-work" className="text-sm font-medium text-indigo-600 hover:underline">
            ← 내 작업으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <Link href="/my-work" className="text-sm font-medium text-indigo-600 hover:underline">
          ← 내 작업
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">채점 세션</h1>
      </div>

      {/* Prompt + criteria */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">문제 (지문)</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{session.promptContent}</p>
          {session.promptFilenames?.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">첨부: {session.promptFilenames.join(", ")}</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">채점 기준</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{session.criteriaContent}</p>
          {session.criteriaFilenames?.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">첨부: {session.criteriaFilenames.join(", ")}</p>
          )}
        </Card>
      </div>

      {/* Submit essay */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">학생 답안 제출</h2>
        <form onSubmit={submitEssay} className="flex flex-col gap-4">
          {submitError && <Alert>{submitError}</Alert>}
          <Field label="학생 이름 (선택)">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="홍길동" />
          </Field>
          <Field label="답안" hint="텍스트로 붙여넣거나 아래에서 파일(손글씨 사진 포함)을 올리세요">
            <Textarea
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="학생 답안을 붙여넣으세요"
            />
          </Field>
          <Field label="답안 파일 (선택)" hint="txt · docx · pdf · 이미지(손글씨)">
            <input
              ref={essayFilesRef}
              type="file"
              multiple
              accept=".txt,.docx,.pdf,.png,.jpg,.jpeg,.webp"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4" /> : "채점 요청"}
          </Button>
        </form>
      </Card>

      {/* Submissions list */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">제출 답안 ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">아직 제출된 답안이 없습니다.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {submissions.map((s) => {
              const active = ACTIVE.has(s.status);
              const inner = (
                <Card
                  className={
                    "p-5 " +
                    (s.status === "completed"
                      ? "transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
                      : "")
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {s.studentName || "이름 없음"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(s.submittedAt)}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  {active && (
                    <div className="mt-3">
                      <ProgressBar value={s.progress} />
                      <p className="mt-1 text-xs text-slate-500">{s.progressMessage ?? "처리 중…"}</p>
                    </div>
                  )}
                  {s.status === "error" && (
                    <p className="mt-2 text-xs text-red-600">{s.progressMessage ?? "채점 중 오류가 발생했습니다"}</p>
                  )}
                  {s.status === "completed" && (
                    <p className="mt-2 text-xs font-medium text-indigo-600">결과 보기 →</p>
                  )}
                </Card>
              );
              return (
                <li key={s.id}>
                  {s.status === "completed" ? (
                    <Link href={`/submissions/${s.id}`}>{inner}</Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
