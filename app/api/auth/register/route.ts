import { z } from "zod";
import { handle, json, ApiError } from "@/lib/http";
import { createUser, sanitizeUser } from "@/lib/auth/users";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().min(3, "사용자명은 3자 이상이어야 합니다").max(50),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  displayName: z.string().max(100).optional(),
});

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const user = await createUser(parsed.data);
  await setSessionCookie({ userId: user.id, isGuest: false, isAdmin: user.isAdmin === 1 });

  return json({ user: sanitizeUser(user) }, { status: 201 });
});
