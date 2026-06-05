import { handle, json, ApiError } from "@/lib/http";
import { requireAdmin } from "@/lib/auth/guards";
import { insertBlogPostSchema } from "@/lib/db/schema";
import { listPosts, getPostBySlug, createPost } from "@/lib/blog";

export const runtime = "nodejs";

/** Admin: list all posts (including unpublished), optional category filter. */
export const GET = handle(async (req: Request) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;
  const posts = await listPosts({ category });
  return json({ posts });
});

/** Admin: create a post. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const isPublished = body.isPublished === 1 || body.isPublished === true ? 1 : 0;
  const parsed = insertBlogPostSchema.safeParse({
    ...body,
    authorId: admin.id,
    isPublished,
    publishedAt: isPublished ? new Date() : null,
  });
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "잘못된 요청입니다", "invalid_input");
  }

  const existing = await getPostBySlug(parsed.data.slug);
  if (existing) throw new ApiError(409, "이미 사용 중인 슬러그입니다", "slug_exists");

  const post = await createPost(parsed.data);
  return json({ post }, { status: 201 });
});
