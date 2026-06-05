"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.register({
        username: form.username,
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
      });
      router.push("/my-work");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">회원가입</h1>
        <p className="mt-1 text-sm text-slate-500">가입하면 무료 체험으로 바로 채점할 수 있습니다</p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="사용자명" hint="3자 이상">
            <Input value={form.username} onChange={update("username")} autoComplete="username" required minLength={3} />
          </Field>
          <Field label="이메일">
            <Input type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
          </Field>
          <Field label="비밀번호" hint="6자 이상">
            <Input
              type="password"
              value={form.password}
              onChange={update("password")}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </Field>
          <Field label="표시 이름 (선택)">
            <Input value={form.displayName} onChange={update("displayName")} placeholder="홍길동" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : "회원가입"}
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
