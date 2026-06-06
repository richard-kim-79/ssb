import { handle, json } from "@/lib/http";
import { createGuestUser, sanitizeUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceAbuseGuard, trackAbuseSuccess } from "@/lib/abuse/guard";

export const runtime = "nodejs";

export const POST = handle(async (req: Request) => {
  // Each guest gets a free trial quota, so spinning up many guests is the main
  // abuse vector. Cap how many guest accounts a single device/IP can create.
  const ctx = await enforceAbuseGuard(req, {
    action: "guest_login",
    ipLimitPerDay: 10,
    deviceLimitPerDay: 3,
  });

  const user = await createGuestUser();
  await setSessionCookie({ userId: user.id, isGuest: true, isAdmin: false });
  await trackAbuseSuccess(ctx, "guest_login");
  return json({ user: sanitizeUser(user) }, { status: 201 });
});
