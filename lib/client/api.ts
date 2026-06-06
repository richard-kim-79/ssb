/**
 * Thin browser-side API client. Cookies (the HttpOnly ssb_session) are sent
 * automatically for same-origin requests, so callers never touch auth headers.
 */
import type {
  ApiKey,
  AuthUser,
  MeResponse,
  Session,
  Submission,
  AnalysisResult,
  Annotation,
  Revision,
  RevisionWithResult,
  NewAnnotationInput,
  UpdateAnnotationInput,
  BlogPost,
  BlogPostInput,
  AdminUser,
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

  // --- api keys (Custom GPT 연동) ---
  listApiKeys: () => request<{ apiKeys: ApiKey[] }>("/api/api-keys"),
  createApiKey: (name: string) =>
    request<{ key: string; apiKey: ApiKey }>("/api/api-keys", jsonInit("POST", { name })),
  deleteApiKey: (id: string) =>
    request<{ ok: true; id: string }>(`/api/api-keys/${id}`, { method: "DELETE" }),

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

  // --- patch: inline 첨삭 ---
  /** Generate AI annotations (synchronous; replaces prior AI annotations). */
  patchAnnotate: (submissionId: string, revisionId?: string | null) =>
    request<{ annotations: Annotation[] }>(
      `/api/submissions/${submissionId}/patch/annotate`,
      jsonInit("POST", { revisionId: revisionId ?? null }),
    ),
  listAnnotations: (submissionId: string, revisionId?: string | null) =>
    request<{ annotations: Annotation[] }>(
      `/api/submissions/${submissionId}/patch/annotations${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ""}`,
    ),
  addAnnotation: (submissionId: string, input: NewAnnotationInput) =>
    request<{ annotation: Annotation }>(
      `/api/submissions/${submissionId}/patch/annotations`,
      jsonInit("POST", input),
    ),
  updateAnnotation: (submissionId: string, annotationId: string, input: UpdateAnnotationInput) =>
    request<{ annotation: Annotation }>(
      `/api/submissions/${submissionId}/patch/annotations/${annotationId}`,
      jsonInit("PATCH", input),
    ),
  deleteAnnotation: (submissionId: string, annotationId: string) =>
    request<{ ok: true }>(`/api/submissions/${submissionId}/patch/annotations/${annotationId}`, {
      method: "DELETE",
    }),

  // --- patch: 재채점 (revisions) ---
  listRevisions: (submissionId: string) =>
    request<{ revisions: RevisionWithResult[] }>(`/api/submissions/${submissionId}/patch/revisions`),
  createRevision: (submissionId: string, content: string, parentRevisionId?: string | null) =>
    request<{ revision: Revision }>(
      `/api/submissions/${submissionId}/patch/revisions`,
      jsonInit("POST", { content, parentRevisionId: parentRevisionId ?? null }),
    ),

  // --- admin: blog ---
  adminListPosts: () => request<{ posts: BlogPost[] }>("/api/admin/blog/posts"),
  adminGetPost: (id: string) => request<{ post: BlogPost }>(`/api/admin/blog/posts/${id}`),
  adminCreatePost: (input: BlogPostInput) =>
    request<{ post: BlogPost }>("/api/admin/blog/posts", jsonInit("POST", input)),
  adminUpdatePost: (id: string, input: Partial<BlogPostInput>) =>
    request<{ post: BlogPost }>(`/api/admin/blog/posts/${id}`, jsonInit("PUT", input)),
  adminDeletePost: (id: string) =>
    request<void>(`/api/admin/blog/posts/${id}`, { method: "DELETE" }),

  // --- admin: users ---
  adminListUsers: () => request<{ users: AdminUser[] }>("/api/admin/users"),
  adminSetUserAdmin: (id: string, isAdmin: 0 | 1) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}`, jsonInit("PATCH", { isAdmin })),
};
