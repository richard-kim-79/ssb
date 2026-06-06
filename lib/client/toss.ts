"use client";

/**
 * Loads the Toss Payments v1 browser SDK on demand (no npm dependency) and
 * returns an initialized instance for SDK·API individual integration — the
 * recurring-billing path uses `requestBillingAuth`, the one-time path uses
 * `requestPayment`. The widget integration is intentionally not used.
 */

const SDK_URL = "https://js.tosspayments.com/v1/payment";

export interface TossBillingAuthOptions {
  customerKey: string;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  customerName?: string;
}

export interface TossPaymentOptions {
  amount: number;
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
  customerEmail?: string;
  customerName?: string;
}

export interface TossInstance {
  requestBillingAuth(method: "카드", options: TossBillingAuthOptions): Promise<void>;
  requestPayment(method: "카드", options: TossPaymentOptions): Promise<void>;
}

type TossFactory = (clientKey: string) => TossInstance;

declare global {
  interface Window {
    TossPayments?: TossFactory;
  }
}

let scriptPromise: Promise<TossFactory> | null = null;

function loadScript(): Promise<TossFactory> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Toss SDK can only load in the browser"));
  }
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TossFactory>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    const onReady = () => {
      if (window.TossPayments) resolve(window.TossPayments);
      else reject(new Error("Toss SDK loaded but TossPayments is undefined"));
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("Toss SDK 로드 실패")));
      if (window.TossPayments) onReady();
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = onReady;
    script.onerror = () => reject(new Error("Toss SDK 로드 실패"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Initialize a Toss instance with the public client key. */
export async function loadTossPayments(clientKey: string): Promise<TossInstance> {
  const factory = await loadScript();
  return factory(clientKey);
}

/** True when the user cancels the Toss popup (so callers can stay silent). */
export function isUserCancel(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED";
}
