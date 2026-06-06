/**
 * Google reCAPTCHA v3 verification.
 *
 * Optional: when `RECAPTCHA_SECRET_KEY` is unset the feature is treated as not
 * configured and callers skip enforcement (the app still works without a key).
 * In development, verification is bypassed entirely.
 */

interface RecaptchaApiResponse {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

export interface CaptchaResult {
  success: boolean;
  score?: number;
  error?: string;
}

const MIN_SCORE = 0.5;

export function isCaptchaConfigured(): boolean {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

export async function verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaResult> {
  if (process.env.NODE_ENV === "development") {
    return { success: true, score: 0.9 };
  }

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // Not configured → don't block; the guard decides whether to enforce.
    return { success: false, error: "captcha_not_configured" };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown-ip") params.append("remoteip", remoteIp);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) return { success: false, error: `captcha_http_${res.status}` };

    const data = (await res.json()) as RecaptchaApiResponse;
    if (!data.success) {
      return { success: false, error: (data["error-codes"] || []).join(",") || "captcha_failed" };
    }

    const score = data.score ?? 0;
    if (score < MIN_SCORE) {
      return { success: false, score, error: "captcha_low_score" };
    }
    return { success: true, score };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "captcha_error" };
  }
}
