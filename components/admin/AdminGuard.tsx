"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { Spinner } from "@/components/ui";

/**
 * Client-side gate for /admin pages. The real authorization is enforced by the
 * admin API routes (requireAdmin → 403); this just avoids rendering admin UI to
 * non-admins and redirects them home.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((r) => {
        if (!alive) return;
        if (r.user?.isAdmin === 1) setOk(true);
        else router.replace("/");
      })
      .catch(() => alive && router.replace("/"));
    return () => {
      alive = false;
    };
  }, [router]);

  if (!ok) {
    return (
      <main className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  return <>{children}</>;
}
