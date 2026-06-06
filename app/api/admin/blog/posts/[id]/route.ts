import { handle, json, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/guards";
import { updateBlogPostSchema } from "@/lib/db/schema";
import { getPostById, updatePost, deletePost } from "@/lib/blog";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: fetch a single post by id (including unpublished). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const post = await getPostById(id);
  if (!post) throw new ApiError(404, "게시글을 찾을 수 없습니다", "not_found");
  return json({ post });
});

/** Admin: update a post. */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const existing = await getPostById(id);
  if (!existing) throw new ApiError(404, "게시글을 찾을 수 없습니다", "not_found");

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = updateBlogPostSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const data = { ...parsed.data };
  // First-time publish stamps publishedAt.
  if (data.isPublished === 1 && existing.isPublished !== 1 && !data.publishedAt) {
    data.publishedAt = new Date();
  }

  const post = await updatePost(id, data);
  return json({ post });
});

/** Admin: delete a post. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const existing = await getPostById(id);
  if (!existing) throw new ApiError(404, "게시글을 찾을 수 없습니다", "not_found");

  await deletePost(id);
  return new Response(null, { status: 204 });
});
