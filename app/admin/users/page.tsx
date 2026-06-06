"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";
import type { AdminUser } from "@/lib/client/types";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function roleBadge(u: AdminUser) {
  if (u.isAdmin === 1) return { label: "관리자", cls: "bg-indigo-100 text-indigo-700" };
  if (u.isGuest === 1) return { label: "게스트", cls: "bg-amber-100 text-amber-700" };
  return { label: "일반", cls: "bg-slate-100 text-slate-600" };
}

function AdminUsersList() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, usersRes] = await Promise.all([api.me(), api.adminListUsers()]);
        if (!alive) return;
        setMeId(meRes.user?.id ?? null);
        setUsers(usersRes.users);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : "사용자를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function toggleAdmin(u: AdminUser) {
    const next: 0 | 1 = u.isAdmin === 1 ? 0 : 1;
    const verb = next === 1 ? "관리자로 지정" : "관리자 권한 회수";
    if (!window.confirm(`"${u.username}" 사용자를 ${verb}할까요?`)) return;
    setError(null);
    setBusyId(u.id);
    try {
      const { user } = await api.adminSetUserAdmin(u.id, next);
      setUsers((prev) => prev.map((p) => (p.id === user.id ? user : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "권한 변경에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:underline">
        ← 관리자
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">사용자 관리</h1>
      <p className="mt-1 text-sm text-slate-500">가입한 사용자 {users.length}명</p>

      {error && (
        <div className="mt-6">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner className="h-6 w-6 text-indigo-600" />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {users.map((u) => {
            const badge = roleBadge(u);
            const isSelf = u.id === meId;
            return (
              <li key={u.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{u.displayName || u.username}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {isSelf && <span className="text-xs text-slate-400">(나)</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      @{u.username}
                      {u.isGuest !== 1 && ` · ${u.email}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDate(u.createdAt)} 가입 · 최근 로그인 {formatDate(u.lastLoginAt)}
                      {u.isGuest === 1 && ` · 게스트 사용 ${u.guestUsageCount}회`}
                    </p>
                  </div>
                  {u.isGuest !== 1 && !isSelf && (
                    <Button
                      variant={u.isAdmin === 1 ? "secondary" : "primary"}
                      size="sm"
                      disabled={busyId === u.id}
                      onClick={() => toggleAdmin(u)}
                    >
                      {busyId === u.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : u.isAdmin === 1 ? (
                        "관리자 해제"
                      ) : (
                        "관리자 지정"
                      )}
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      <AdminUsersList />
    </AdminGuard>
  );
}
