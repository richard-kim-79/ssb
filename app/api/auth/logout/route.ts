import { handle, json } from "@/lib/http";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handle(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
