import type { Metadata } from "next";
import Link from "next/link";
import { listPosts, authorName, BLOG_CATEGORY_LABELS } from "@/lib/blog";
import { Card } from "@/components/ui";

export const runtime = "nodejs";
export const revalidate = 600;

export const metadata: Metadata = {
  title: "블로그",
  description: "논술 팁, 입시 정보, 사용 가이드, 교육 소식을 전해드립니다. 써봄 블로그에서 논술 학습과 첨삭에 도움이 되는 글을 확인하세요.",
  alternates: { canonical: "/blog" },
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogListPage() {
  let posts: Awaited<ReturnType<typeof listPosts>> = [];
  try {
    posts = await listPosts({ publishedOnly: true });
  } catch {
    posts = [];
  }

  // Resolve author names with a small cache.
  const nameCache = new Map<string, string>();
  const withNames = await Promise.all(
    posts.map(async (p) => {
      let name = nameCache.get(p.authorId);
      if (!name) {
        name = await authorName(p.authorId).catch(() => "관리자");
        nameCache.set(p.authorId, name);
      }
      return { post: p, author: name };
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">블로그</h1>
        <p className="mt-3 text-lg leading-8 text-slate-600">
          논술 팁, 입시 정보, 사용 가이드, 교육 소식을 전해드립니다.
        </p>
      </header>

      {withNames.length === 0 ? (
        <Card className="mt-12 p-10 text-center text-sm text-slate-500">아직 게시된 글이 없습니다.</Card>
      ) : (
        <ul className="mt-12 flex flex-col gap-4">
          {withNames.map(({ post, author }) => (
            <li key={post.id}>
              <Link href={`/blog/${post.slug}`}>
                <Card className="p-6 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
                      {BLOG_CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                    <span className="text-slate-400">{formatDate(post.publishedAt ?? post.createdAt)}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-slate-900">{post.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{post.excerpt}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    {author} · 조회 {post.viewCount.toLocaleString("ko-KR")}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
