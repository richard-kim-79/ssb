/**
 * Toss Payments server-side API client.
 *
 * All calls authenticate with HTTP Basic auth where the username is the secret
 * key and the password is empty — i.e. `base64(TOSS_SECRET_KEY + ":")`.
 * The client key is public and handed to the browser SDK only.
 *
 * Docs: https://docs.tosspayments.com/reference
 */

const TOSS_API_BASE = "https://api.tosspayments.com";

export function isTossConfigured(): boolean {
  return Boolean(process.env.TOSS_SECRET_KEY);
}

/** Public client key for the browser SDK (NEXT_PUBLIC_ so it ships to the client). */
export function tossClientKey(): string | null {
  return process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || null;
}

function authHeader(): string {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error("TOSS_SECRET_KEY is not set");
  // username = secret key, password = empty
  const encoded = Buffer.from(`${secret}:`).toString("base64");
  return `Basic ${encoded}`;
}

/** A normalized Toss error so handlers can surface a Korean message + code. */
export class TossError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "TossError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function tossFetch<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${TOSS_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Never cache payment calls.
      cache: "no-store",
    });
  } catch (err) {
    throw new TossError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "결제 서버에 연결하지 못했습니다",
      502,
    );
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.code === "string" ? data.code : "TOSS_ERROR";
    const message = typeof data.message === "string" ? data.message : "결제 처리에 실패했습니다";
    throw new TossError(code, message, res.status);
  }
  return data as T;
}

async function tossGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${TOSS_API_BASE}${path}`, {
      method: "GET",
      headers: { Authorization: authHeader() },
      cache: "no-store",
    });
  } catch (err) {
    throw new TossError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "결제 서버에 연결하지 못했습니다",
      502,
    );
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.code === "string" ? data.code : "TOSS_ERROR";
    const message = typeof data.message === "string" ? data.message : "결제 조회에 실패했습니다";
    throw new TossError(code, message, res.status);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Response shapes (only the fields we use)
// ---------------------------------------------------------------------------

export interface TossPayment {
  paymentKey: string;
  orderId: string;
  orderName?: string;
  status: string; // "DONE" | "CANCELED" | "ABORTED" | ...
  method?: string;
  totalAmount: number;
  approvedAt?: string;
  requestedAt?: string;
}

export interface TossBillingAuth {
  billingKey: string;
  customerKey: string;
  card?: { cardType?: string; number?: string; ownerType?: string; issuerCode?: string };
}

// ---------------------------------------------------------------------------
// One-time payment
// ---------------------------------------------------------------------------

/** Confirm a one-time payment. Server passes the trusted amount from the intent. */
export function confirmPayment(args: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<TossPayment> {
  return tossFetch<TossPayment>("/v1/payments/confirm", args);
}

/** Look up a payment by its key (source of truth for the webhook). */
export function getPayment(paymentKey: string): Promise<TossPayment> {
  return tossGet<TossPayment>(`/v1/payments/${encodeURIComponent(paymentKey)}`);
}

// ---------------------------------------------------------------------------
// Billing key (recurring) payment
// ---------------------------------------------------------------------------

/** Exchange the browser-issued authKey for a durable billingKey. */
export function issueBillingKey(args: {
  authKey: string;
  customerKey: string;
}): Promise<TossBillingAuth> {
  return tossFetch<TossBillingAuth>("/v1/billing/authorizations/issue", args);
}

/** Charge a stored billing key (first charge and recurring renewals). */
export function chargeBillingKey(
  billingKey: string,
  args: {
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
    customerEmail?: string;
    customerName?: string;
  },
): Promise<TossPayment> {
  return tossFetch<TossPayment>(`/v1/billing/${encodeURIComponent(billingKey)}`, args);
}
