import { createHash, randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { apiKeysTable } from "@/lib/db/schema";
import { ApiError } from "@/lib/http";

const PREFIX = "sk_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generate a new API key. Returns the plaintext (shown once) + storage fields. */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = PREFIX + randomBytes(24).toString("base64url");
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, 8), // e.g. "sk_AbCd"
  };
}

export interface ApiKeyActor {
  apiKeyId: string;
  userId: string;
}

/**
 * Validate a Bearer API key from the request, returning the owning user.
 * Increments usage and updates lastUsedAt. Throws 401 on failure.
 */
export async function requireApiKey(req: Request): Promise<ApiKeyActor> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const key = bearer || req.headers.get("x-api-key");
  if (!key) throw new ApiError(401, "API 키가 필요합니다", "missing_api_key");

  const keyHash = hashApiKey(key.trim());
  const [row] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.keyHash, keyHash)).limit(1);

  if (!row || row.isActive !== 1) throw new ApiError(401, "유효하지 않은 API 키입니다", "invalid_api_key");
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, "만료된 API 키입니다", "expired_api_key");
  }

  await db
    .update(apiKeysTable)
    .set({ usageCount: sql`${apiKeysTable.usageCount} + 1`, lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, row.id));

  return { apiKeyId: row.id, userId: row.userId };
}
