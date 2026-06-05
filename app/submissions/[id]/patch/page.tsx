"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type {
  AnalysisResult,
  Annotation,
  AnnotationType,
  RevisionWithResult,
  Submission,
} from "@/lib/client/types";
import { Alert, Button, Card, Field, Spinner, StatusBadge, Textarea, cn } from "@/components/ui";
import { AnnotatedEssay, type SelectionCapture } from "@/components/patch/AnnotatedEssay";
import { RevisionDiff } from "@/components/patch/RevisionDiff";

const ACTIVE = new Set(["pending", "analyzing"]);

const TYPE_LABELS: Record<AnnotationType, string> = {
  correction: "교정",
  highlight: "강조",
  comment: "코멘트",
};

const TYPE_BADGE: Record<AnnotationType, string> = {
  correction: "bg-red-100 text-red-700",
  highlight: "bg-yellow-100 text-yellow-800",
  comment: "bg-sky-100 text-sky-700",
};

function isImageContent(text: string): boolean {
  return text.trim().startsWith("[IMAGE_DATA:");
}

function deltaLabel(delta: number | null | undefined): { text: string; tone: string } | null {
  if (delta === null || delta === undefined) return null;
  if (delta > 0) return { text: `+${delta}`, tone: "text-emerald-600" };
  if (delta < 0) return { text: `${delta}`, tone: "text-red-600" };
  return { text: "±0", tone: "text-slate-500" };
}

export default function PatchWorkspacePage() {
  const params = useParams<{ id: string }>();
  const submissionId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Manual annotation draft
  const [selection, setSelection] = useState<SelectionCapture | null>(null);
  const [newType, setNewType] = useState<AnnotationType>("comment");
  const [newComment, setNewComment] = useState("");
  const [newSuggestion, setNewSuggestion] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // Revisions
  const [revisions, setRevisions] = useState<RevisionWithResult[]>([]);
  const [draft, setDraft] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [openDiffId, setOpenDiffId] = useState<string | null>(null);

  const essayText = submission?.essayContent ?? "";
  const isImage = useMemo(() => isImageContent(essayText), [essayText]);

  const loadAll = useCallback(async () => {
    const data = await api.getSubmission(submissionId);
    setSubmission(data.submission);
    setResult(data.result);
    setDraft((prev) => (prev ? prev : data.submission.essayContent));
    if (data.submission.status === "completed" && !isImageContent(data.submission.essayContent)) {
      const [{ annotations: anns }, { revisions: revs }] = await Promise.all([
        api.listAnnotations(submissionId),
        api.listRevisions(submissionId),
      ]);
      setAnnotations(anns);
      setRevisions(revs);
    }
  }, [submissionId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadAll();
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "작업공간을 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadAll, router]);

  // Poll revisions while any re-grade is running.
  const hasActiveRevision = revisions.some((r) => ACTIVE.has(r.revision.status));
  useEffect(() => {
    if (!hasActiveRevision) return;
    const t = setInterval(() => {
      api
        .listRevisions(submissionId)
        .then(({ revisions: revs }) => setRevisions(revs))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [hasActiveRevision, submissionId]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setActionError(null);
    try {
      const { annotations: anns } = await api.patchAnnotate(submissionId);
      setAnnotations(anns);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "AI 첨삭 생성에 실패했습니다");
    } finally {
      setGenerating(false);
    }
  }, [submissionId]);

  const handleSelectText = useCallback((cap: SelectionCapture) => {
    setSelection(cap);
    setNewType("comment");
    setNewComment("");
    setNewSuggestion("");
  }, []);

  const handleSaveAnnotation = useCallback(async () => {
    if (!selection) return;
    setSavingAnnotation(true);
    setActionError(null);
    try {
      const { annotation } = await api.addAnnotation(submissionId, {
        type: newType,
        quotedText: selection.quotedText,
        before: selection.before,
        comment: newComment || null,
        suggestedText: newType === "correction" ? newSuggestion || null : null,
      });
      setAnnotations((prev) => [...prev, annotation].sort((a, b) => a.startOffset - b.startOffset));
      setSelection(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "첨삭 저장에 실패했습니다");
    } finally {
      setSavingAnnotation(false);
    }
  }, [selection, newType, newComment, newSuggestion, submissionId]);

  const handleDeleteAnnotation = useCallback(
    async (annotationId: string) => {
      setActionError(null);
      try {
        await api.deleteAnnotation(submissionId, annotationId);
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : "첨삭 삭제에 실패했습니다");
      }
    },
    [submissionId],
  );

  const handleSubmitRevision = useCallback(async () => {
    if (!draft.trim() || draft.length < 5) {
      setActionError("수정한 답안 내용을 입력해주세요");
      return;
    }
    setSubmittingRevision(true);
    setActionError(null);
    try {
      await api.createRevision(submissionId, draft);
      const { revisions: revs } = await api.listRevisions(submissionId);
      setRevisions(revs);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "재채점 요청에 실패했습니다");
    } finally {
      setSubmittingRevision(false);
    }
  }, [draft, submissionId]);

  if (loading) {
    return (
      <main className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24">
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

  if (submission.status !== "completed") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="info">먼저 채점이 완료되어야 첨삭을 시작할 수 있습니다.</Alert>
        <div className="mt-4">
          <Link href={`/submissions/${submissionId}`} className="text-sm font-medium text-indigo-600 hover:underline">
            ← 채점 결과로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const orphaned = annotations.filter((a) => a.orphaned);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href={`/submissions/${submissionId}`} className="text-sm font-medium text-indigo-600 hover:underline">
          ← 채점 결과로 돌아가기
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">패치 · 첨삭 작업공간</h1>
        <p className="mt-1 text-sm text-slate-500">
          답안에 인라인 첨삭(빨간펜)을 달고, 수정한 답안을 다시 채점해 점수 변화를 확인하세요.
        </p>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      {isImage ? (
        <Alert tone="info">이미지로 제출된 답안은 인라인 첨삭을 지원하지 않습니다.</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Essay with inline annotations */}
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">답안 첨삭</h2>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Spinner className="h-4 w-4" /> 생성 중…
                  </>
                ) : annotations.length > 0 ? (
                  "AI 첨삭 다시 생성"
                ) : (
                  "AI 첨삭 생성"
                )}
              </Button>
            </div>
            <p className="mb-3 text-xs text-slate-400">텍스트를 드래그하면 직접 첨삭을 추가할 수 있습니다.</p>
            <AnnotatedEssay
              text={essayText}
              annotations={annotations}
              activeId={activeId}
              onSelectAnnotation={setActiveId}
              onSelectText={handleSelectText}
            />

            {selection && (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <p className="mb-2 text-xs text-slate-500">
                  선택한 구간: <span className="font-medium text-slate-700">“{selection.quotedText}”</span>
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(["correction", "highlight", "comment"] as AnnotationType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          newType === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-300",
                        )}
                      >
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  {newType === "correction" && (
                    <Field label="고친 표현 (빨간펜)">
                      <Textarea
                        value={newSuggestion}
                        onChange={(e) => setNewSuggestion(e.target.value)}
                        placeholder="이렇게 고치면 좋겠어요"
                        className="min-h-[60px]"
                      />
                    </Field>
                  )}
                  <Field label="코멘트">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="첨삭 내용을 적어주세요"
                      className="min-h-[60px]"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveAnnotation} disabled={savingAnnotation}>
                      {savingAnnotation ? "저장 중…" : "첨삭 추가"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Annotation list sidebar */}
          <div className="flex flex-col gap-3">
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">첨삭 목록 ({annotations.length})</h3>
              {annotations.length === 0 ? (
                <p className="text-xs text-slate-400">아직 첨삭이 없습니다. AI 첨삭을 생성하거나 직접 추가해보세요.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {annotations.map((a) => (
                    <li
                      key={a.id}
                      onClick={() => setActiveId(a.id)}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3 text-xs transition-colors",
                        activeId === a.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className={cn("rounded-full px-2 py-0.5 font-medium", TYPE_BADGE[a.type])}>
                          {TYPE_LABELS[a.type]}
                          {a.source === "user" ? " · 직접" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAnnotation(a.id);
                          }}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="첨삭 삭제"
                        >
                          삭제
                        </button>
                      </div>
                      {a.orphaned ? (
                        <p className="italic text-amber-600">수정으로 위치를 찾지 못한 첨삭입니다.</p>
                      ) : (
                        <p className="font-medium text-slate-700">“{a.quotedText}”</p>
                      )}
                      {a.suggestedText && <p className="mt-1 text-emerald-700">→ {a.suggestedText}</p>}
                      {a.comment && <p className="mt-1 leading-5 text-slate-500">{a.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {orphaned.length > 0 && (
                <p className="mt-3 text-[11px] text-amber-600">
                  ⚠ {orphaned.length}개 첨삭은 수정된 부분이라 위치를 찾지 못했습니다.
                </p>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Revisions / re-grade */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">수정 & 재채점</h2>
        <p className="mb-4 text-sm text-slate-500">
          첨삭을 반영해 답안을 고친 뒤 다시 채점하면 점수가 얼마나 올랐는지 확인할 수 있습니다.
        </p>

        <Field label="수정한 답안">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[180px]"
            disabled={isImage}
          />
        </Field>
        <div className="mt-3">
          <Button onClick={handleSubmitRevision} disabled={submittingRevision || isImage}>
            {submittingRevision ? "요청 중…" : "수정본 제출 & 재채점"}
          </Button>
        </div>

        {result && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-slate-900">버전 1 · 원본</span>
            <span className="text-sm font-semibold text-slate-900">
              {result.overallScore} / {result.maxScore}
            </span>
          </div>
        )}

        {revisions.length > 0 && (
          <ul className="mt-4 flex flex-col gap-4">
            {revisions.map(({ revision: r, result: rr }) => {
              const delta = deltaLabel(r.scoreDelta);
              const diffOpen = openDiffId === r.id;
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">버전 {r.versionNumber}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.status === "completed" && r.overallScore !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-900">
                          {r.overallScore} / {r.maxScore}
                        </span>
                        {delta && <span className={cn("font-semibold", delta.tone)}>{delta.text}</span>}
                      </div>
                    )}
                  </div>

                  {ACTIVE.has(r.status) && (
                    <p className="mt-2 text-xs text-slate-500">{r.progressMessage ?? "재채점 중입니다…"}</p>
                  )}
                  {r.status === "error" && (
                    <p className="mt-2 text-xs text-red-600">{r.progressMessage ?? "재채점 중 오류가 발생했습니다."}</p>
                  )}

                  {r.status === "completed" && r.improvedCategories && r.improvedCategories.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1">
                      {r.improvedCategories.map((c, i) => {
                        const cd = deltaLabel(c.delta);
                        return (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{c.name}</span>
                            <span className="text-slate-500">
                              {c.before ?? "-"} → <span className="font-medium text-slate-800">{c.after}</span>{" "}
                              {cd && <span className={cn("font-semibold", cd.tone)}>{cd.text}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {rr?.detailedFeedback && (
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">{rr.detailedFeedback}</p>
                  )}

                  {r.diffFromParent && r.diffFromParent.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setOpenDiffId(diffOpen ? null : r.id)}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        {diffOpen ? "변경 내용 숨기기" : "변경 내용 보기 (diff)"}
                      </button>
                      {diffOpen && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-3">
                          <RevisionDiff ops={r.diffFromParent} />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </main>
  );
}
