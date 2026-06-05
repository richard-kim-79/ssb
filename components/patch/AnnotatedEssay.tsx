"use client";

import * as React from "react";
import { useRef } from "react";
import type { Annotation, AnnotationType } from "@/lib/client/types";
import { cn } from "@/components/ui";

/** Visual style per annotation type. */
const TYPE_STYLES: Record<AnnotationType, string> = {
  correction: "bg-red-100 text-red-800 underline decoration-wavy decoration-red-400",
  highlight: "bg-yellow-100 text-yellow-900",
  comment: "bg-sky-100 text-sky-900",
};

export interface SelectionCapture {
  quotedText: string;
  before: string;
}

export interface AnnotatedEssayProps {
  text: string;
  annotations: Annotation[];
  activeId?: string | null;
  onSelectAnnotation?: (id: string) => void;
  /** Fired when the user selects a range of text (for manual 첨삭 creation). */
  onSelectText?: (sel: SelectionCapture) => void;
  className?: string;
}

/** Derive the selected substring + a short preceding-context hint from the DOM. */
function captureSelection(container: HTMLElement): SelectionCapture | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const quotedText = sel.toString();
  if (!quotedText.trim()) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  return { quotedText, before: pre.toString().slice(-15) };
}

/**
 * Render essay text with inline 첨삭 spans anchored by char offset.
 * Overlapping annotations are resolved greedily (first by start offset wins) so the
 * DOM stays flat; orphaned/zero-width spans are skipped here (shown in the sidebar).
 */
export function AnnotatedEssay({
  text,
  annotations,
  activeId,
  onSelectAnnotation,
  onSelectText,
  className,
}: AnnotatedEssayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const inline = annotations
    .filter(
      (a) =>
        !a.orphaned &&
        a.endOffset > a.startOffset &&
        a.startOffset >= 0 &&
        a.endOffset <= text.length,
    )
    .sort((a, b) => a.startOffset - b.startOffset);

  // Greedily drop overlaps to keep spans non-nested.
  const chosen: Annotation[] = [];
  let lastEnd = 0;
  for (const a of inline) {
    if (a.startOffset >= lastEnd) {
      chosen.push(a);
      lastEnd = a.endOffset;
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const a of chosen) {
    if (a.startOffset > cursor) {
      parts.push(<span key={`t${cursor}`}>{text.slice(cursor, a.startOffset)}</span>);
    }
    const isActive = activeId === a.id;
    parts.push(
      <mark
        key={a.id}
        data-annotation-id={a.id}
        title={a.comment ?? undefined}
        onClick={() => onSelectAnnotation?.(a.id)}
        className={cn(
          "cursor-pointer rounded px-0.5",
          TYPE_STYLES[a.type],
          isActive && "ring-2 ring-offset-1 ring-indigo-500",
        )}
      >
        {text.slice(a.startOffset, a.endOffset)}
      </mark>,
    );
    cursor = a.endOffset;
  }
  if (cursor < text.length) parts.push(<span key={`t${cursor}`}>{text.slice(cursor)}</span>);

  return (
    <div
      ref={containerRef}
      onMouseUp={() => {
        if (!onSelectText || !containerRef.current) return;
        const cap = captureSelection(containerRef.current);
        if (cap) onSelectText(cap);
      }}
      className={cn("whitespace-pre-wrap text-sm leading-8 text-slate-800", className)}
    >
      {parts.length > 0 ? parts : text}
    </div>
  );
}
