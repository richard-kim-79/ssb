import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { handle, json, ApiError } from "@/lib/http";
import { db } from "@/lib/db/client";
import { apiKeysTable } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { generateApiKey } from "@/lib/auth/apiKey";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1, "키 이름을 입력해주세요").max(100),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  if (user.isGuest === 1) {
    throw new ApiError(403, "게스트는 API 키를 만들 수 없습니다", "guest_forbidden");
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const { key, keyHash, keyPrefix } = generateApiKey();
  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [row] = await db
    .insert(apiKeysTable)
    .values({ userId: user.id, keyHash, keyPrefix, name: parsed.data.name, expiresAt })
    .returning();

  // The plaintext key is returned ONCE and never stored.
  return json(
    {
      key,
      apiKey: {
        id: row.id,
        name: row.name,
        keyPrefix: row.keyPrefix,
        isActive: row.isActive,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      },
    },
    { status: 201 },
  );
});

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      usageCount: apiKeysTable.usageCount,
      lastUsedAt: apiKeysTable.lastUsedAt,
      isActive: apiKeysTable.isActive,
      expiresAt: apiKeysTable.expiresAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, user.id))
    .orderBy(desc(apiKeysTable.createdAt));

  return json({ apiKeys: rows });
});
