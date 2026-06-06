import { ApiError } from "@/lib/http";
import {
  identifyDevice,
  recordAbuse,
  incrementDeviceUsage,
  type DeviceContext,
} from "@/lib/abuse/device";
import { checkRateLimit } from "@/lib/abuse/rateLimit";
import { isCaptchaConfigured, verifyCaptcha } from "@/lib/abuse/captcha";

const DAY_MINUTES = 24 * 60;

export interface AbuseGuardOptions {
  /** Logical action name, used as the rate-limit bucket (e.g. "guest_login"). */
  action: string;
  /** Per-IP daily cap (default 5). Relaxed ×100 in development. */
  ipLimitPerDay?: number;
  /** Per-device daily cap (default 3). Relaxed ×100 in development. */
  deviceLimitPerDay?: number;
  /** reCAPTCHA token from the client, if any. */
  captchaToken?: string | null;
  /**
   * The acting user. Registered (non-guest) users skip rate limiting and
   * challenges — their quota is enforced by usage limits instead.
   */
  user?: { isGuest: number } | null;
}

function effective(limit: number): number {
  return process.env.NODE_ENV === "development" ? limit * 100 : limit;
}

/**
 * Run device identification + IP/device rate limiting + (optional) CAPTCHA
 * challenge for a sensitive action. Throws ApiError (429/400) when blocked,
 * otherwise returns the device context. Call `trackAbuseSuccess` afterwards on
 * the success path.
 */
export async function enforceAbuseGuard(
  req: Request,
  opts: AbuseGuardOptions,
): Promise<DeviceContext> {
  const ctx = await identifyDevice(req);

  // Registered users are gated by usage limits, not abuse rate limits.
  if (opts.user && opts.user.isGuest === 0) {
    return ctx;
  }

  const ipLimit = effective(opts.ipLimitPerDay ?? 5);
  const deviceLimit = effective(opts.deviceLimitPerDay ?? 3);

  // 1) IP rate limit
  const ip = await checkRateLimit(ctx.clientIp, "ip", opts.action, ipLimit, DAY_MINUTES);
  if (!ip.allowed) {
    await recordAbuse({
      deviceId: ctx.device.id,
      ipAddress: ctx.clientIp,
      eventType: "rate_limit_hit",
      description: `IP rate limit exceeded for ${opts.action}`,
      riskScore: ctx.riskScore,
      actionTaken: "blocked",
    });
    throw new ApiError(429, "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.", "rate_limited", {
      resetAt: ip.resetAt.toISOString(),
      current: ip.current,
      limit: ip.limit,
    });
  }

  // 2) Device rate limit
  const dev = await checkRateLimit(ctx.device.id, "device", opts.action, deviceLimit, DAY_MINUTES);
  if (!dev.allowed) {
    await recordAbuse({
      deviceId: ctx.device.id,
      ipAddress: ctx.clientIp,
      eventType: "device_rate_limit_hit",
      description: `Device rate limit exceeded for ${opts.action}`,
      riskScore: ctx.riskScore,
      actionTaken: "blocked",
    });
    throw new ApiError(
      429,
      "이 기기에서 사용 가능한 무료 체험을 모두 사용했습니다. 회원가입하시면 더 많은 첨삭을 받으실 수 있습니다.",
      "device_limited",
      { resetAt: dev.resetAt.toISOString(), current: dev.current, limit: dev.limit, upgradeRequired: true },
    );
  }

  // 3) CAPTCHA challenge (only when configured and risk warrants it)
  if (isCaptchaConfigured() && ctx.challenge.requiresCaptcha) {
    if (!opts.captchaToken) {
      await recordAbuse({
        deviceId: ctx.device.id,
        ipAddress: ctx.clientIp,
        eventType: "captcha_required",
        description: `CAPTCHA required: ${ctx.challenge.reason}`,
        riskScore: ctx.riskScore,
        actionTaken: "captcha_required",
      });
      throw new ApiError(400, "안전한 서비스 이용을 위해 간단한 확인이 필요합니다.", "captcha_required", {
        requiresCaptcha: true,
        reason: ctx.challenge.reason,
      });
    }

    const result = await verifyCaptcha(opts.captchaToken, ctx.clientIp);
    if (!result.success) {
      await recordAbuse({
        deviceId: ctx.device.id,
        ipAddress: ctx.clientIp,
        eventType: "captcha_failed",
        description: `CAPTCHA verification failed: ${result.error}`,
        riskScore: ctx.riskScore,
        actionTaken: "blocked",
      });
      throw new ApiError(400, "확인 과정에서 문제가 발생했습니다. 다시 시도해 주세요.", "captcha_failed", {
        requiresCaptcha: true,
      });
    }
  }

  return ctx;
}

/** Record a successful action: bump device usage + log it. Best-effort. */
export async function trackAbuseSuccess(ctx: DeviceContext, action: string): Promise<void> {
  await incrementDeviceUsage(ctx.device.id, ctx.riskScore);
  await recordAbuse({
    deviceId: ctx.device.id,
    ipAddress: ctx.clientIp,
    eventType: "successful_usage",
    description: `Successful ${action}`,
    riskScore: ctx.riskScore,
    actionTaken: "allowed",
  });
}
