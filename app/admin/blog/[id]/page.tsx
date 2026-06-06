"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import type { BlogPost } from "@/lib/client/types";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { BlogEditor } from "@/components/admin/BlogEditor";
import { Alert, Spinner } from "@/components/ui";

function EditBlogPost() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .adminGetPost(id)
      .then((r) => alive && setPost(r.post))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "글을 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/admin/blog" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 블로그 관리
      </Link>
      <h1 className="mt-2 mb-8 text-2xl font-bold tracking-tight text-slate-900">글 수정</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : error ? (
        <Alert>{error}</Alert>
      ) : post ? (
        <BlogEditor post={post} />
      ) : null}
    </main>
  );
}

export default function EditBlogPostPage() {
  return (
    <AdminGuard>
      <EditBlogPost />
    </AdminGuard>
  );
}
