import * as React from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// --- Button ---------------------------------------------------------------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700",
  secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...props} />;
}

// --- Inputs ---------------------------------------------------------------
const fieldBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-[120px] resize-y leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-slate-700", className)} {...props} />;
}

export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// --- Card -----------------------------------------------------------------
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

// --- Spinner --------------------------------------------------------------
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

// --- Status badge ---------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  analyzing: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기 중",
  analyzing: "채점 중",
  completed: "완료",
  error: "오류",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// --- Progress bar ---------------------------------------------------------
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// --- Alert ----------------------------------------------------------------
export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", styles)}>{children}</div>;
}
