import * as React from "react";
import type { DiffOp } from "@/lib/client/types";
import { cn } from "@/components/ui";

export interface RevisionDiffProps {
  ops: DiffOp[];
  className?: string;
}

/**
 * Inline render of a token diff (lib/patch/diff): inserts are green, deletes are
 * struck-through red, unchanged text is plain. Drives the "무엇이 개선됐나" view.
 */
export function RevisionDiff({ ops, className }: RevisionDiffProps) {
  return (
    <div className={cn("whitespace-pre-wrap text-sm leading-8 text-slate-800", className)}>
      {ops.map((o, i) => {
        if (o.op === "equal") return <span key={i}>{o.text}</span>;
        if (o.op === "insert") {
          return (
            <ins key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-800 no-underline">
              {o.text}
            </ins>
          );
        }
        return (
          <del key={i} className="rounded bg-red-100 px-0.5 text-red-700 line-through">
            {o.text}
          </del>
        );
      })}
    </div>
  );
}
