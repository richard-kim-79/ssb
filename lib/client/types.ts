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
