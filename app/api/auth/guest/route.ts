import { handle, json } from "@/lib/http";
import { createGuestUser, sanitizeUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export const POST = handle(async () => {
  const user = await createGuestUser();
  await setSessionCookie({ userId: user.id, isGuest: true, isAdmin: false });
  return json({ user: sanitizeUser(user) }, { status: 201 });
});
