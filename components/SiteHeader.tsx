"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import type { AuthUser } from "@/lib/client/types";
import { Button } from "@/components/ui";

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-check auth on every navigation so the header reflects login/logout
  // performed via client-side routing (router.push from the auth pages).
  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((r) => alive && setUser(r.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pathname]);

  async function handleLogout() {
    await api.logout().catch(() => {});
    setUser(null);
    router.push("/");
    router.refresh();
  }

  const displayName = user?.displayName || user?.username;

  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-sm text-white">써</span>
          써봄
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/plans" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              요금제
            </Button>
          </Link>
          <Link href="/blog" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              블로그
            </Button>
          </Link>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : user ? (
            <>
              {user.isAdmin === 1 && (
                <Link href="/admin" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    관리자
                  </Button>
                </Link>
              )}
              <Link href="/my-work">
                <Button variant="ghost" size="sm">
                  내 작업
                </Button>
              </Link>
              <span className="hidden text-sm text-slate-500 sm:inline">
                {user.isGuest ? "게스트" : displayName}
              </span>
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  로그인
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">회원가입</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
