/**
 * Token-level diff for revision comparison ("what did the student change?").
 *
 * Word/whitespace tokenization + an LCS so the output reads naturally for
 * Korean prose. Essays are short (hundreds of tokens), so the O(n·m) DP is fine.
 * The op list drives the RevisionDiff UI and is stored on the revision row.
 */

export type DiffOp = { op: "equal" | "insert" | "delete"; text: string };

/** Split into alternating word / whitespace runs so spacing changes are visible. */
function tokenize(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

export function diffTokens(before: string, after: string): DiffOp[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Backtrack into a coalesced op list.
  const raw: DiffOp[] = [];
  let i = 0;
  let j = 0;
  const push = (op: DiffOp["op"], text: string) => {
    const last = raw[raw.length - 1];
    if (last && last.op === op) last.text += text;
    else raw.push({ op, text });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", a[i]);
      i++;
    } else {
      push("insert", b[j]);
      j++;
    }
  }
  while (i < n) push("delete", a[i++]);
  while (j < m) push("insert", b[j++]);
  return raw;
}

/** Quick summary counts for a diff (chars added/removed). */
export function diffSummary(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const o of ops) {
    if (o.op === "insert") added += o.text.length;
    else if (o.op === "delete") removed += o.text.length;
  }
  return { added, removed };
}
