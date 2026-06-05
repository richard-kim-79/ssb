import { handle, json } from "@/lib/http";
import { listPosts, authorName } from "@/lib/blog";

export const runtime = "nodejs";

/** Public: list published blog posts (optionally filtered by category). */
export const GET = handle(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || undefined;

  const posts = await listPosts({ publishedOnly: true, category });

  const nameCache = new Map<string, string>();
  const previews = await Promise.all(
    posts.map(async (p) => {
      let name = nameCache.get(p.authorId);
      if (!name) {
        name = await authorName(p.authorId);
        nameCache.set(p.authorId, name);
      }
      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        category: p.category,
        tags: p.tags,
        featuredImage: p.featuredImage,
        authorName: name,
        publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
        viewCount: p.viewCount,
      };
    }),
  );

  return json({ posts: previews });
});
