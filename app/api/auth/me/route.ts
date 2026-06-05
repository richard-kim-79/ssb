import { handle, json } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/guards";
import { sanitizeUser } from "@/lib/auth/users";
import { getUsageStatus } from "@/lib/usage/limits";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });

  const usage = await getUsageStatus(user);
  return json({ user: sanitizeUser(user), usage });
});
