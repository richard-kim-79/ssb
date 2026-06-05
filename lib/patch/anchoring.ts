/**
 * Span anchoring for inline 첨삭 (annotations).
 *
 * Char offsets alone are fragile: when a student edits their answer, every
 * offset after the edit shifts. So each annotation stores a *redundant* anchor —
 * the quoted span plus a little surrounding context — and we re-resolve it
 * against the current (normalized) text. Resolution order:
 *
 *   1. trust the stored offsets if the slice still equals the quote
 *   2. search `prefix + quote + suffix` (context-disambiguated)
 *   3. search the bare quote, picking the occurrence nearest the old offset
 *   4. give up → mark `orphaned` (surfaced in the sidebar, never silently dropped)
 *
 * Text must be normalized once (lib/parsing/document `cleanText`) before
 * anchoring so offsets are stable across the pipeline.
 */

export const CONTEXT_LEN = 24;

export interface AnchorSpec {
  quotedText: string;
  prefix?: string | null;
  suffix?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
}

export interface ResolvedSpan {
  startOffset: number;
  endOffset: number;
  prefix: string;
  suffix: string;
  orphaned: boolean;
}

/** Capture up to CONTEXT_LEN chars on each side of [start, end) as context anchors. */
export function makeContext(text: string, start: number, end: number): { prefix: string; suffix: string } {
  return {
    prefix: text.slice(Math.max(0, start - CONTEXT_LEN), start),
    suffix: text.slice(end, Math.min(text.length, end + CONTEXT_LEN)),
  };
}

function allIndexesOf(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + 1; // allow overlapping starts; we only need positions
  }
  return out;
}

function found(text: string, start: number, end: number): ResolvedSpan {
  const { prefix, suffix } = makeContext(text, start, end);
  return { startOffset: start, endOffset: end, prefix, suffix, orphaned: false };
}

/**
 * Resolve an annotation anchor against `text`. Never throws; returns
 * `orphaned: true` (with the best-guess old offsets) when the span is gone.
 */
export function resolveAnchor(text: string, spec: AnchorSpec): ResolvedSpan {
  const quote = spec.quotedText ?? "";
  if (!quote) {
    return { startOffset: 0, endOffset: 0, prefix: "", suffix: "", orphaned: true };
  }

  // 1. Stored offsets still valid.
  if (
    typeof spec.startOffset === "number" &&
    typeof spec.endOffset === "number" &&
    spec.startOffset >= 0 &&
    spec.endOffset <= text.length &&
    text.slice(spec.startOffset, spec.endOffset) === quote
  ) {
    return found(text, spec.startOffset, spec.endOffset);
  }

  // 2. Context-disambiguated search (prefix + quote + suffix).
  const prefix = spec.prefix ?? "";
  const suffix = spec.suffix ?? "";
  if (prefix || suffix) {
    const needle = prefix + quote + suffix;
    const idx = text.indexOf(needle);
    if (idx !== -1) {
      const start = idx + prefix.length;
      return found(text, start, start + quote.length);
    }
  }

  // 3. Bare quote — pick the occurrence nearest the old start offset.
  const occ = allIndexesOf(text, quote);
  if (occ.length > 0) {
    const hint = typeof spec.startOffset === "number" ? spec.startOffset : 0;
    let best = occ[0];
    for (const i of occ) {
      if (Math.abs(i - hint) < Math.abs(best - hint)) best = i;
    }
    return found(text, best, best + quote.length);
  }

  // 4. Orphaned — the student likely rewrote this span (a "feedback applied" signal).
  return {
    startOffset: typeof spec.startOffset === "number" ? spec.startOffset : 0,
    endOffset: typeof spec.endOffset === "number" ? spec.endOffset : 0,
    prefix,
    suffix,
    orphaned: true,
  };
}

/** Anchor a fresh span by its quoted text (used for AI + manual annotations). */
export function anchorByQuote(
  text: string,
  quotedText: string,
  opts?: { hintBefore?: string | null; hintOffset?: number | null },
): ResolvedSpan {
  return resolveAnchor(text, {
    quotedText,
    prefix: opts?.hintBefore ?? null,
    suffix: null,
    startOffset: opts?.hintOffset ?? null,
    endOffset: null,
  });
}
