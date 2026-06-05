import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { essayRevisionsTable, essaySubmissionsTable, type EssayRevision, type EssaySubmission, type User } from "@/lib/db/schema";
import { ApiError } from "@/lib/http";

/** Load a submission and assert the current user owns it (admins bypass). */
export async function loadOwnedSubmission(id: string, user: User): Promise<EssaySubmission> {
  const [submission] = await db
    .select()
    .from(essaySubmissionsTable)
    .where(eq(essaySubmissionsTable.id, id))
    .limit(1);
  if (!submission) throw new ApiError(404, "제출물을 찾을 수 없습니다", "not_found");
  if (submission.userId !== user.id && user.isAdmin !== 1) {
    throw new ApiError(403, "접근 권한이 없습니다", "forbidden");
  }
  return submission;
}

/** Load a revision and assert it belongs to the given submission. */
export async function loadRevisionForSubmission(submissionId: string, revisionId: string): Promise<EssayRevision> {
  const [revision] = await db
    .select()
    .from(essayRevisionsTable)
    .where(eq(essayRevisionsTable.id, revisionId))
    .limit(1);
  if (!revision || revision.submissionId !== submissionId) {
    throw new ApiError(404, "수정본을 찾을 수 없습니다", "not_found");
  }
  return revision;
}

/**
 * The text that annotations anchor against:
 *  - revisionId null → the original submission's essay
 *  - revisionId set  → that revision's content snapshot
 */
export async function resolveAnchorText(submission: EssaySubmission, revisionId: string | null): Promise<string> {
  if (!revisionId) return submission.essayContent;
  const revision = await loadRevisionForSubmission(submission.id, revisionId);
  return revision.content;
}
