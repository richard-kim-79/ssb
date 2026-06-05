import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { listPosts } from "@/lib/blog";

export const runtime = "nodejs";
// Re-generate at most hourly; blog posts change infrequently.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/plans`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/gpt-guide`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let postRoutes: MetadataRoute.Sitemap = [];
  try {
    const posts = await listPosts({ publishedOnly: true });
    postRoutes = posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? p.createdAt,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
  } catch {
    // DB unavailable at generation time — still return the static routes.
  }

  return [...staticRoutes, ...postRoutes];
}
