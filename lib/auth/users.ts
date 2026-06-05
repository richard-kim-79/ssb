import { randomBytes } from "crypto";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/http";

export type PublicUser = Omit<User, "password">;

export function sanitizeUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
}

export async function findByUsername(username: string): Promise<User | null> {
  const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return u ?? null;
}

/** Create a regular account. Throws 409 if the username/email already exists. */
export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  displayName?: string | null;
}): Promise<User> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, input.username), eq(users.email, input.email)))
    .limit(1);
  if (existing.length > 0) throw new ApiError(409, "이미 사용 중인 사용자명 또는 이메일입니다", "user_exists");

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      username: input.username,
      email: input.email,
      password: passwordHash,
      displayName: input.displayName ?? null,
    })
    .returning();
  return user;
}

/** Create an ephemeral guest account with random credentials. */
export async function createGuestUser(): Promise<User> {
  const suffix = randomBytes(6).toString("hex");
  const username = `guest_${suffix}`;
  const email = `${username}@guest.ssb.local`;
  const passwordHash = await hashPassword(randomBytes(16).toString("hex"));
  const [user] = await db
    .insert(users)
    .values({
      username,
      email,
      password: passwordHash,
      displayName: "게스트",
      isGuest: 1,
    })
    .returning();
  return user;
}
