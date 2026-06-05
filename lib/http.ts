import { NextResponse } from "next/server";

/** Thrown by guards/handlers; converted to a JSON Response by `handle`. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[api] unhandled error:", err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Wrap a route handler so thrown ApiErrors become proper JSON responses.
 * Usage: export const POST = handle(async (req) => { ... });
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
