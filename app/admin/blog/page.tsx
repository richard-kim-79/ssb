"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";
import type { BlogPost } from "@/lib/client/types";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { BLOG_CATEGORIES } from "@/components/admin/BlogEditor";
import { Alert, Button, Card, Spinner } from "@/components/ui";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  BLOG_CATEGORIES.map((c) => [c.value, c.label]),
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function AdminBlogList() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .adminListPosts()
      .then((r) => alive && setPosts(r.posts))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "글을 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function remove(post: BlogPost) {
    if (!window.confirm(`"${post.title}" 글을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setError(null);
    try {
      await api.adminDeletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "삭제에 실패했습니다.");
    }
  }

  async function togglePublish(post: BlogPost) {
    setError(null);
    try {
      const { post: updated } = await api.adminUpdatePost(post.id, {
        isPublished: post.isPublished === 1 ? 0 : 1,
      });
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "상태 변경에 실패했습니다.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:underline">
            ← 관리자
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">블로그 관리</h1>
        </div>
        <Link href="/admin/blog/new">
          <Button>새 글</Button>
        </Link>
      </div>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="mt-8 p-10 text-center text-sm text-slate-500">
          아직 작성한 글이 없습니다. &quot;새 글&quot;로 첫 글을 작성해보세요.
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        post.isPublished === 1
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {post.isPublished === 1 ? "게시됨" : "초안"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-medium text-slate-800">{post.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    /{post.slug} · {formatDate(post.createdAt)} · 조회 {post.viewCount}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => togglePublish(post)}>
                    {post.isPublished === 1 ? "비공개로" : "게시"}
                  </Button>
                  <Link href={`/admin/blog/${post.id}`}>
                    <Button variant="secondary" size="sm">
                      수정
                    </Button>
                  </Link>
                  <Button variant="danger" size="sm" onClick={() => remove(post)}>
                    삭제
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function AdminBlogPage() {
  return (
    <AdminGuard>
      <AdminBlogList />
    </AdminGuard>
  );
}
