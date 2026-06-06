/**
 * Client-facing shapes mirroring the JSON the API returns (timestamps arrive as
 * ISO strings, not Date objects). Kept separate from the Drizzle row types so the
 * frontend never has to wrestle with server-only types.
 */

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  isAdmin: number;
  isGuest: number;
  guestUsageCount: number;
  createdAt: string;
}

export interface Usage {
  current: number;
  limit: number;
  remaining: number;
  planId: string;
}

export interface MeResponse {
  user: AuthUser | null;
  usage?: Usage;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: number;
  expiresAt: string | null;
  createdAt: string;
}

export type BlogCategory = "essay-tips" | "admission-info" | "platform-guide" | "education-news";

/** A blog post row as returned by the admin API (timestamps as ISO strings). */
export interface BlogPost {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  tags: string[] | null;
  featuredImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: number;
  publishedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: BlogCategory;
  tags: string[];
  featuredImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: number;
}

/** A user row as returned by the admin users API (no password hash). */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  isAdmin: number;
  isGuest: number;
  guestUsageCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Session {
  id: string;
  promptContent: string;
  criteriaContent: string;
  promptFilenames: string[];
  criteriaFilenames: string[];
  createdAt: string;
}

export type SubmissionStatus = "pending" | "analyzing" | "completed" | "error";

export interface Submission {
  id: string;
  sessionId: string;
  studentName: string | null;
  studentId: string | null;
  essayContent: string;
  essayFilename: string | null;
  status: SubmissionStatus;
  progress: number;
  progressMessage: string | null;
  submittedAt: string;
}

export interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface AnalysisResult {
  id: string;
  submissionId: string;
  revisionId?: string | null;
  overallScore: number;
  maxScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  improvementAreas: string[];
  detailedFeedback: string;
  suggestions: string[];
  model: string | null;
  tier: string | null;
  createdAt: string;
}

// --- Patch (inline 첨삭 + 재채점) ---

export type AnnotationType = "correction" | "highlight" | "comment";
export type AnnotationSeverity = "minor" | "major" | "suggestion";
export type AnnotationSource = "ai" | "user";

export interface Annotation {
  id: string;
  submissionId: string;
  revisionId: string | null;
  type: AnnotationType;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  prefix: string | null;
  suffix: string | null;
  suggestedText: string | null;
  comment: string | null;
  color: string | null;
  severity: AnnotationSeverity | null;
  source: AnnotationSource;
  orphaned: number; // 1 = couldn't re-anchor after a revision
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type DiffOpKind = "equal" | "insert" | "delete";
export interface DiffOp {
  op: DiffOpKind;
  text: string;
}

export interface ImprovedCategory {
  name: string;
  before: number | null;
  after: number;
  delta: number | null;
}

export type RevisionStatus = "pending" | "analyzing" | "completed" | "error";

export interface Revision {
  id: string;
  submissionId: string;
  versionNumber: number;
  parentRevisionId: string | null;
  content: string;
  diffFromParent: DiffOp[] | null;
  resultId: string | null;
  overallScore: number | null;
  maxScore: number | null;
  scoreDelta: number | null;
  improvedCategories: ImprovedCategory[] | null;
  status: RevisionStatus;
  progress: number;
  progressMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** A revision row plus its (joined) grading result, as returned by the list endpoint. */
export interface RevisionWithResult {
  revision: Revision;
  result: AnalysisResult | null;
}

export interface NewAnnotationInput {
  type: AnnotationType;
  quotedText: string;
  before?: string | null;
  suggestedText?: string | null;
  comment?: string | null;
  color?: string | null;
  severity?: AnnotationSeverity | null;
  revisionId?: string | null;
}

export interface UpdateAnnotationInput {
  type?: AnnotationType;
  comment?: string | null;
  suggestedText?: string | null;
  color?: string | null;
  severity?: AnnotationSeverity | null;
}
