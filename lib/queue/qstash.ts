import { Client, Receiver } from "@upstash/qstash";

/** Absolute public base URL used for QStash callbacks. */
export function appBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function qstashConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

let _client: Client | null = null;
function getClient(): Client {
  if (_client) return _client;
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  _client = new Client({ token });
  return _client;
}

export async function publishJob(jobPath: string, body: unknown, opts?: { retries?: number }): Promise<void> {
  const client = getClient();
  await client.publishJSON({
    url: `${appBaseUrl()}${jobPath}`,
    body,
    retries: opts?.retries ?? 3,
  });
}

let _receiver: Receiver | null | undefined;
function getReceiver(): Receiver | null {
  if (_receiver !== undefined) return _receiver;
  const cur = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  _receiver = cur && next ? new Receiver({ currentSigningKey: cur, nextSigningKey: next }) : null;
  return _receiver;
}

/**
 * Authorize a worker request.
 * - If QStash signing keys are configured: require a valid `upstash-signature`.
 * - Otherwise (local dev without QStash): allow, since enqueue uses an in-process fallback.
 */
export async function assertJobAuthorized(req: Request, bodyText: string): Promise<void> {
  const receiver = getReceiver();
  if (!receiver) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("QStash signing keys are not configured");
    }
    return; // dev fallback
  }
  const signature = req.headers.get("upstash-signature") || "";
  await receiver.verify({ signature, body: bodyText });
}
