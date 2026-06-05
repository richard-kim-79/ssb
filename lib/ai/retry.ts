/** Shared retry/timeout helpers for AI providers. */

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Transient errors worth retrying (network blips, timeouts, rate limits, 5xx). */
export function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /timeout|timed out|abort|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(msg) ||
    /\b429\b|quota|rate.?limit|overloaded|unavailable|\b50[0-4]\b/i.test(msg)
  );
}

/** Reject if `promise` does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`AI 응답 시간이 초과되었습니다 (timeout ${ms}ms)`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
