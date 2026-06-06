import { randomUUID, createHash } from "crypto";
import { cookies } from "next/headers";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { devicesTable, abuseTrackingTable, type Device } from "@/lib/db/schema";
import { getClientIp, getGeoLocation } from "@/lib/abuse/ip";

export const DEVICE_COOKIE = "ssb_device";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export interface SecurityChallenge {
  requiresCaptcha: boolean;
  requiresEmailVerification: boolean;
  reason: string;
}

export interface DeviceContext {
  device: Device;
  deviceToken: string;
  clientIp: string;
  fingerprint: string;
  riskScore: number;
  challenge: SecurityChallenge;
}

/**
 * Stable-ish browser fingerprint from request headers. Not a strong signal on
 * its own (headers are spoofable) — it's combined with IP + cookie + rate
 * limits. Hashed so we never store raw header strings.
 */
export function generateFingerprint(req: Request): string {
  const h = req.headers;
  const components = [
    h.get("user-agent") ?? "",
    h.get("accept-language") ?? "",
    h.get("accept-encoding") ?? "",
    h.get("sec-ch-ua") ?? "",
    h.get("sec-ch-ua-platform") ?? "",
  ];
  return createHash("sha256").update(components.join("|")).digest("hex");
}

/** Risk heuristic (0-100). Ported from the legacy deviceService. */
export function calculateRiskScore(
  usageCount: number,
  ipChanges: number,
  fingerprintChanges: number,
  velocityScore: number,
): number {
  let risk = 0;
  if (usageCount > 10) risk += 20;
  if (usageCount > 20) risk += 30;
  if (ipChanges > 3) risk += 25;
  if (ipChanges > 5) risk += 35;
  if (fingerprintChanges > 2) risk += 30;
  risk += Math.min(velocityScore, 30);
  return Math.min(risk, 100);
}

/** Decide whether a device should face a CAPTCHA / email-verification challenge. */
export function requiresSecurityChallenge(riskScore: number, usageCount: number): SecurityChallenge {
  if (riskScore > 60) {
    return { requiresCaptcha: true, requiresEmailVerification: true, reason: "high_risk_detected" };
  }
  if (usageCount <= 3) {
    return { requiresCaptcha: false, requiresEmailVerification: false, reason: "trial_period" };
  }
  return { requiresCaptcha: true, requiresEmailVerification: true, reason: "limit_reached" };
}

async function getDeviceByToken(token: string): Promise<Device | null> {
  const [d] = await db.select().from(devicesTable).where(eq(devicesTable.deviceToken, token)).limit(1);
  return d ?? null;
}

async function findSimilarDevices(fingerprint: string, ipAddress: string): Promise<Device[]> {
  return db
    .select()
    .from(devicesTable)
    .where(and(eq(devicesTable.fingerprint, fingerprint), eq(devicesTable.ipAddress, ipAddress)))
    .orderBy(desc(devicesTable.lastSeenAt));
}

async function abuseHistory(opts: {
  deviceId?: string;
  ipAddress?: string;
  hours: number;
}): Promise<{ ipAddress: string; eventType: string }[]> {
  const conditions = [];
  if (opts.deviceId) conditions.push(eq(abuseTrackingTable.deviceId, opts.deviceId));
  if (opts.ipAddress) conditions.push(eq(abuseTrackingTable.ipAddress, opts.ipAddress));
  conditions.push(gte(abuseTrackingTable.detectedAt, new Date(Date.now() - opts.hours * 3600 * 1000)));
  return db
    .select({ ipAddress: abuseTrackingTable.ipAddress, eventType: abuseTrackingTable.eventType })
    .from(abuseTrackingTable)
    .where(and(...conditions));
}

async function computeRisk(device: Device, clientIp: string): Promise<number> {
  const deviceEvents = await abuseHistory({ deviceId: device.id, hours: 24 });
  const ipChanges = Math.max(0, new Set(deviceEvents.map((e) => e.ipAddress)).size - 1);

  const recent = await abuseHistory({ ipAddress: clientIp, hours: 1 });
  const velocity = Math.min(
    recent.filter((e) => e.eventType === "successful_usage" || e.eventType.includes("rate_limit"))
      .length * 2,
    50,
  );

  return calculateRiskScore(device.requestCount, ipChanges, 0, velocity);
}

/**
 * Resolve the current device: from the cookie, else a fingerprint+IP match
 * (covers cleared cookies), else create a new row. Persists the device cookie
 * and computes a fresh risk score. Never throws — abuse tracking is advisory.
 */
export async function identifyDevice(req: Request): Promise<DeviceContext> {
  const clientIp = getClientIp(req);
  const fingerprint = generateFingerprint(req);
  const geo = getGeoLocation(req);

  const store = await cookies();
  let deviceToken = store.get(DEVICE_COOKIE)?.value ?? null;

  let device: Device | null = null;
  if (deviceToken) device = await getDeviceByToken(deviceToken);

  if (!device) {
    const similar = await findSimilarDevices(fingerprint, clientIp);
    if (similar.length > 0) {
      device = similar[0];
      deviceToken = device.deviceToken;
    }
  }

  if (!device) {
    // Reuse the cookie token issued by middleware if present, so the browser's
    // cookie matches the persisted device row; otherwise mint a new one.
    deviceToken = deviceToken ?? randomUUID();
    [device] = await db
      .insert(devicesTable)
      .values({
        deviceToken,
        fingerprint,
        ipAddress: clientIp,
        country: geo.country,
        city: geo.city,
        region: geo.region,
        userAgent: req.headers.get("user-agent") ?? null,
        language: req.headers.get("accept-language") ?? null,
      })
      .returning();
  }

  // Persist / refresh the cookie so this browser keeps mapping to one device.
  if (deviceToken && store.get(DEVICE_COOKIE)?.value !== deviceToken) {
    store.set(DEVICE_COOKIE, deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  const riskScore = await computeRisk(device, clientIp);
  const challenge = requiresSecurityChallenge(riskScore, device.requestCount);
  return { device, deviceToken: deviceToken as string, clientIp, fingerprint, riskScore, challenge };
}

/** Append an abuse-tracking event. Best-effort: swallows its own errors. */
export async function recordAbuse(entry: {
  deviceId?: string | null;
  ipAddress: string;
  eventType: string;
  description?: string;
  riskScore?: number;
  actionTaken?: string;
}): Promise<void> {
  try {
    let deviceId = entry.deviceId ?? null;
    if (deviceId) {
      const [d] = await db
        .select({ id: devicesTable.id })
        .from(devicesTable)
        .where(eq(devicesTable.id, deviceId))
        .limit(1);
      if (!d) deviceId = null; // avoid FK violation
    }
    await db.insert(abuseTrackingTable).values({
      deviceId,
      ipAddress: entry.ipAddress,
      eventType: entry.eventType,
      description: entry.description ?? null,
      riskScore: entry.riskScore ?? 0,
      actionTaken: entry.actionTaken ?? null,
    });
  } catch (err) {
    console.error("[abuse] failed to record event:", err);
  }
}

/** Bump the device's usage counter + lastSeen, and store the latest risk score. */
export async function incrementDeviceUsage(deviceId: string, riskScore?: number): Promise<void> {
  const now = new Date();
  await db
    .update(devicesTable)
    .set({
      requestCount: sql`${devicesTable.requestCount} + 1`,
      lastSeenAt: now,
      updatedAt: now,
      ...(riskScore !== undefined ? { riskScore } : {}),
    })
    .where(eq(devicesTable.id, deviceId));
}
