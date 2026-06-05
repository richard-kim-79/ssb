import { handle, json, ApiError } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/guards";
import { getPostBySlug, incrementViews, authorName } from "@/lib/blog";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

/** Public: fetch a published post by slug (admins may view unpublished). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const post = await getPostBySlug(slug);
  if (!post) throw new ApiError(404, "게시글을 찾을 수 없습니다", "not_found");

  if (post.isPublished !== 1) {
    const user = await getCurrentUser();
    if (!user || user.isAdmin !== 1) {
      throw new ApiError(404, "게시글을 찾을 수 없습니다", "not_found");
    }
  }

  await incrementViews(post.id);
  const name = await authorName(post.authorId);

  return json({
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      tags: post.tags,
      featuredImage: post.featuredImage,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      authorName: name,
      publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
      viewCount: post.viewCount + 1,
    },
  });
});
