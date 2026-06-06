/**
 * Client IP + geolocation extraction.
 *
 * On Vercel the platform injects trusted `x-vercel-*` headers, so we use those
 * instead of the old Express `req.ip` + `geoip-lite` lookup (the geoip binary
 * is large and unnecessary in a serverless function).
 */

export interface GeoLocation {
  country: string | null;
  city: string | null;
  region: string | null;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  // Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  return trimmed;
}

/**
 * Best-effort client IP. Prefers Vercel's forwarded header, falls back to the
 * standard `x-forwarded-for` (first hop) / `x-real-ip`. Returns "unknown-ip"
 * for localhost or when nothing is present so callers always have a stable key.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const candidate =
    h.get("x-vercel-forwarded-for") ||
    h.get("x-forwarded-for") ||
    h.get("x-real-ip") ||
    "";

  // x-forwarded-for may be a comma-separated chain; the left-most is the client.
  const first = candidate.split(",")[0] ?? "";
  const ip = first ? normalizeIp(first) : "";

  if (!ip || ip === "::1" || ip === "127.0.0.1") return "unknown-ip";
  return ip;
}

/** Geolocation from Vercel edge headers. All fields null when unavailable. */
export function getGeoLocation(req: Request): GeoLocation {
  const h = req.headers;
  const decode = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return decodeURIComponent(v) || null;
    } catch {
      return v || null;
    }
  };
  return {
    country: decode(h.get("x-vercel-ip-country")),
    city: decode(h.get("x-vercel-ip-city")),
    region: decode(h.get("x-vercel-ip-country-region")),
  };
}
