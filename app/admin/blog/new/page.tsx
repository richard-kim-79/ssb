"use client";

import Link from "next/link";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { BlogEditor } from "@/components/admin/BlogEditor";

export default function NewBlogPostPage() {
  return (
    <AdminGuard>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/admin/blog" className="text-sm font-medium text-indigo-600 hover:underline">
          ← 블로그 관리
        </Link>
        <h1 className="mt-2 mb-8 text-2xl font-bold tracking-tight text-slate-900">새 글 작성</h1>
        <BlogEditor />
      </main>
    </AdminGuard>
  );
}
