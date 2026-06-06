export { getClientIp, getGeoLocation, type GeoLocation } from "@/lib/abuse/ip";
export { checkRateLimit, cleanupExpiredRateLimits, type RateLimitResult } from "@/lib/abuse/rateLimit";
export { verifyCaptcha, isCaptchaConfigured, type CaptchaResult } from "@/lib/abuse/captcha";
export {
  DEVICE_COOKIE,
  identifyDevice,
  recordAbuse,
  incrementDeviceUsage,
  generateFingerprint,
  calculateRiskScore,
  requiresSecurityChallenge,
  type DeviceContext,
  type SecurityChallenge,
} from "@/lib/abuse/device";
export {
  enforceAbuseGuard,
  trackAbuseSuccess,
  type AbuseGuardOptions,
} from "@/lib/abuse/guard";
