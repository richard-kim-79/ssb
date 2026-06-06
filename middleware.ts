import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: device cookie issuance only.
 *
 * The Edge runtime can't touch the DB or use Node APIs, so this only ensures
 * every visitor carries a stable, opaque `ssb_device` cookie. The heavy lifting
 * (device row upsert, rate limiting, risk scoring) happens server-side in
 * `lib/abuse/*` inside Node route handlers, which read this cookie.
 *
 * Cookie name kept in sync with DEVICE_COOKIE in lib/abuse/device.ts.
 */
const DEVICE_COOKIE = "ssb_device";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  if (!req.cookies.get(DEVICE_COOKIE)) {
    res.cookies.set(DEVICE_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return res;
}

export const config = {
  // Run on pages and API routes, but skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
