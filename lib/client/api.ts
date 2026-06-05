/**
 * Thin browser-side API client. Cookies (the HttpOnly ssb_session) are sent
 * automatically for same-origin requests, so callers never touch auth headers.
 */
import type {
  AuthUser,
  MeResponse,
  Session,
  Submission,
  AnalysisResult,
} from "./types";

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty/non-JSON body */
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(res.status, d.error || `요청 실패 (${res.status})`, d.code);
  }
  return data as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export interface CreateSessionInput {
  promptContent: string;
  criteriaContent: string;
}

export interface CreateSubmissionInput {
  essayContent: string;
  studentName?: string;
  studentId?: string;
}

export const api = {
  // --- auth ---
  me: () => request<MeResponse>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: AuthUser }>("/api/auth/login", jsonInit("POST", { username, password })),
  register: (input: { username: string; email: string; password: string; displayName?: string }) =>
    request<{ user: AuthUser }>("/api/auth/register", jsonInit("POST", input)),
  guest: () => request<{ user: AuthUser }>("/api/auth/guest", { method: "POST" }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  // --- sessions ---
  listSessions: () => request<{ sessions: Session[] }>("/api/sessions"),
  createSession: (input: CreateSessionInput) =>
    request<{ session: Session }>("/api/sessions", jsonInit("POST", input)),
  createSessionForm: (form: FormData) =>
    request<{ session: Session }>("/api/sessions", { method: "POST", body: form }),
  getSession: (id: string) =>
    request<{ session: Session; submissions: Submission[] }>(`/api/sessions/${id}`),

  // --- submissions ---
  createSubmission: (sessionId: string, input: CreateSubmissionInput) =>
    request<{ submission: Submission }>(`/api/sessions/${sessionId}/submissions`, jsonInit("POST", input)),
  createSubmissionForm: (sessionId: string, form: FormData) =>
    request<{ submission: Submission }>(`/api/sessions/${sessionId}/submissions`, { method: "POST", body: form }),
  getSubmission: (id: string) =>
    request<{ submission: Submission; result: AnalysisResult | null }>(`/api/submissions/${id}`),
};
