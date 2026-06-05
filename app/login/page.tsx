"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.login(username, password);
      router.push("/my-work");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다");
      setBusy(false);
    }
  }

  async function startGuest() {
    setError(null);
    setBusy(true);
    try {
      await api.guest();
      router.push("/my-work");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "게스트 시작에 실패했습니다");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
        <p className="mt-1 text-sm text-slate-500">써봄 계정으로 로그인하세요</p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="사용자명">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              placeholder="아이디"
            />
          </Field>
          <Field label="비밀번호">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="비밀번호"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : "로그인"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          또는
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button variant="secondary" className="w-full" onClick={startGuest} disabled={busy}>
          게스트로 체험하기
        </Button>
      </Card>

      <p className="text-center text-sm text-slate-500">
        아직 계정이 없으신가요?{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
