"use client";

import Link from "next/link";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Card } from "@/components/ui";

const SECTIONS = [
  {
    href: "/admin/blog",
    title: "블로그 관리",
    desc: "공개 블로그 글을 작성·수정·게시하고 삭제합니다.",
  },
  {
    href: "/admin/users",
    title: "사용자 관리",
    desc: "가입한 사용자를 조회하고 관리자 권한을 부여·회수합니다.",
  },
];

export default function AdminHomePage() {
  return (
    <AdminGuard>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">관리자</h1>
        <p className="mt-1 text-sm text-slate-500">써봄 운영 도구입니다.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href}>
              <Card className="h-full p-6 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30">
                <h2 className="text-lg font-bold text-slate-900">{s.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </AdminGuard>
  );
}
