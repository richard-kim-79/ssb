import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, incrementViews, authorName, BLOG_CATEGORY_LABELS } from "@/lib/blog";
import { Markdown } from "@/components/Markdown";

export const runtime = "nodejs";
// Render fresh so view counts increment and edits show immediately.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post || post.isPublished !== 1) {
    return { title: "게시글을 찾을 수 없습니다" };
  }
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${post.slug}`,
      images: post.featuredImage ? [{ url: post.featuredImage }] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: Ctx) {
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post || post.isPublished !== 1) notFound();

  const author = await authorName(post.authorId).catch(() => "관리자");
  // Best-effort view count bump; never block rendering on it.
  await incrementViews(post.id).catch(() => {});

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/blog" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 블로그
      </Link>

      <article className="mt-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
            {BLOG_CATEGORY_LABELS[post.category] ?? post.category}
          </span>
          <span className="text-slate-400">{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {author} · 조회 {(post.viewCount + 1).toLocaleString("ko-KR")}
        </p>

        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImage} alt={post.title} className="mt-6 w-full rounded-xl" />
        )}

        <div className="mt-6">
          <Markdown>{post.content}</Markdown>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-slate-200 pt-6">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}
