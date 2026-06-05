"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { AnalysisResult, Submission } from "@/lib/client/types";
import { Alert, Button, Card, ProgressBar, Spinner } from "@/components/ui";

const ACTIVE = new Set(["pending", "analyzing"]);

function scoreTone(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 60) return "text-indigo-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-600";
}

function isImageContent(text: string): boolean {
  return text.trim().startsWith("[IMAGE_DATA:");
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const submissionId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const refresh = useCallback(async () => {
    const data = await api.getSubmission(submissionId);
    setSubmission(data.submission);
    setResult(data.result);
    return data.submission;
  }, [submissionId]);

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
        setLoadError(err instanceof ApiError ? err.message : "리포트를 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh, router]);

  // Poll while still grading.
  useEffect(() => {
    if (!submission || !ACTIVE.has(submission.status)) return;
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [submission, refresh]);

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  if (loadError || !submission) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert>{loadError ?? "제출물을 찾을 수 없습니다"}</Alert>
        <div className="mt-4">
          <Link href="/my-work" className="text-sm font-medium text-indigo-600 hover:underline">
            ← 내 작업으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const backHref = `/sessions/${submission.sessionId}`;

  // Still grading / pending
  if (ACTIVE.has(submission.status)) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <Spinner className="h-8 w-8 text-indigo-600" />
          <div>
            <p className="font-semibold text-slate-900">채점 중입니다</p>
            <p className="mt-1 text-sm text-slate-500">{submission.progressMessage ?? "잠시만 기다려주세요…"}</p>
          </div>
          <div className="w-full max-w-sm">
            <ProgressBar value={submission.progress} />
          </div>
        </Card>
      </main>
    );
  }

  // Error
  if (submission.status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert>{submission.progressMessage ?? "채점 중 오류가 발생했습니다. 다시 시도해주세요."}</Alert>
        <div className="mt-4">
          <Link href={backHref} className="text-sm font-medium text-indigo-600 hover:underline">
            ← 세션으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  // Completed but no result row yet (rare)
  if (!result) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="info">채점은 완료됐지만 결과를 불러오지 못했습니다. 새로고침해주세요.</Alert>
        <div className="mt-4">
          <Link href={backHref} className="text-sm font-medium text-indigo-600 hover:underline">
            ← 세션으로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const pct = result.maxScore > 0 ? Math.round((result.overallScore / result.maxScore) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="no-print flex items-center justify-between">
        <Link href={backHref} className="text-sm font-medium text-indigo-600 hover:underline">
          ← 세션으로 돌아가기
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/submissions/${submissionId}/patch`}>
            <Button size="sm">패치 · 첨삭하기</Button>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            인쇄 / PDF 저장
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">채점 결과</h1>
        {submission.studentName && (
          <p className="mt-1 text-sm text-slate-500">{submission.studentName} 학생</p>
        )}
      </div>

      {/* Overall score */}
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <span className="text-sm text-slate-500">총점</span>
        <div className={"text-5xl font-bold " + scoreTone(pct)}>
          {result.overallScore}
          <span className="text-2xl text-slate-400"> / {result.maxScore}</span>
        </div>
        <div className="mt-2 w-full max-w-xs">
          <ProgressBar value={pct} />
        </div>
        {result.model && (
          <p className="mt-2 text-xs text-slate-400">
            채점 모델: {result.model}
            {result.tier ? ` (${result.tier})` : ""}
          </p>
        )}
      </Card>

      {/* Category scores */}
      {result.categoryScores?.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">영역별 점수</h2>
          <ul className="flex flex-col gap-4">
            {result.categoryScores.map((c, i) => {
              const cpct = c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0;
              return (
                <li key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {c.score} / {c.maxScore}
                    </span>
                  </div>
                  <ProgressBar value={cpct} />
                  {c.feedback && <p className="mt-1.5 text-xs leading-5 text-slate-500">{c.feedback}</p>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Strengths + improvements */}
      <div className="grid gap-4 sm:grid-cols-2">
        {result.strengths?.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-emerald-700">강점</h2>
            <ul className="flex flex-col gap-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <span className="text-emerald-500">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {result.improvementAreas?.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-amber-700">개선점</h2>
            <ul className="flex flex-col gap-2">
              {result.improvementAreas.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-6 text-slate-700">
                  <span className="text-amber-500">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Detailed feedback */}
      {result.detailedFeedback && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">상세 피드백</h2>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{result.detailedFeedback}</p>
        </Card>
      )}

      {/* Suggestions */}
      {result.suggestions?.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">개선 방안</h2>
          <ul className="flex flex-col gap-2">
            {result.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-indigo-500">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Original answer */}
      <Card className="p-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">제출한 답안</h2>
        {isImageContent(submission.essayContent) ? (
          <p className="text-sm text-slate-500">이미지로 제출된 답안입니다 (손글씨 인식 후 채점).</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{submission.essayContent}</p>
        )}
      </Card>
    </main>
  );
}
