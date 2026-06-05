"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { ApiKey } from "@/lib/client/types";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

type KeyState = "active" | "expired" | "revoked";

function keyState(k: ApiKey): KeyState {
  if (k.isActive !== 1) return "revoked";
  if (k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

const STATE_LABELS: Record<KeyState, string> = {
  active: "활성",
  expired: "만료됨",
  revoked: "해지됨",
};

const STATE_STYLES: Record<KeyState, string> = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-amber-100 text-amber-700",
  revoked: "bg-slate-100 text-slate-500",
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([]);

  // create form
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the plaintext key, shown exactly once right after creation
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        if (!me.user) {
          router.replace("/login");
          return;
        }
        setIsGuest(me.user.isGuest === 1);
        const { apiKeys } = await api.listApiKeys();
        if (!alive) return;
        setKeys(apiKeys);
      } catch {
        if (alive) router.replace("/login");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("키 이름을 입력해주세요");
      return;
    }

    setCreating(true);
    try {
      const { key } = await api.createApiKey(trimmed);
      setNewKey(key);
      setCopied(false);
      setName("");
      const { apiKeys } = await api.listApiKeys();
      setKeys(apiKeys);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "API 키 생성에 실패했습니다");
    } finally {
      setCreating(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function deleteKey(id: string, label: string) {
    if (!window.confirm(`"${label}" 키를 삭제할까요? 이 키로 보낸 요청은 즉시 차단됩니다.`)) return;
    try {
      await api.deleteApiKey(id);
      const { apiKeys } = await api.listApiKeys();
      setKeys(apiKeys);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "API 키 삭제에 실패했습니다");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <Spinner className="h-6 w-6 text-indigo-600" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <Link href="/gpt-guide" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Custom GPT 연동 가이드
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">API 키 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          ChatGPT Custom GPT 연동에 사용할 API 키를 생성하고 관리하세요.
        </p>
      </div>

      {/* The new key, shown exactly once */}
      {newKey && (
        <Card className="border-emerald-200 bg-emerald-50/40 p-6">
          <h2 className="text-lg font-semibold text-slate-900">새 API 키가 생성되었습니다</h2>
          <p className="mt-1 text-sm text-red-600">
            이 키는 지금 한 번만 표시됩니다. 안전한 곳에 복사해두세요. 창을 닫으면 다시 볼 수 없습니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="flex-1 break-all rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-sm text-slate-100">
              {newKey}
            </code>
            <Button type="button" variant="secondary" onClick={copyKey}>
              {copied ? "복사됨!" : "복사"}
            </Button>
          </div>
          <div className="mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setNewKey(null)}>
              복사를 완료했어요
            </Button>
          </div>
        </Card>
      )}

      {/* Create */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">새 API 키 생성</h2>
        {isGuest ? (
          <Alert tone="info">게스트 계정은 API 키를 만들 수 없습니다. 회원가입 후 이용해주세요.</Alert>
        ) : (
          <form onSubmit={createKey} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="키 이름" hint="용도를 알아보기 쉬운 이름을 적어주세요 (예: Custom GPT 연동용)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Custom GPT 연동용"
                disabled={creating}
              />
            </Field>
            <Button type="submit" disabled={creating}>
              {creating ? <Spinner className="h-4 w-4" /> : "API 키 생성"}
            </Button>
          </form>
        )}
      </Card>

      {/* List */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">내 API 키</h2>
        {keys.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">아직 생성한 API 키가 없습니다.</Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {keys.map((k) => {
              const state = keyState(k);
              return (
                <li key={k.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{k.name}</p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}
                        >
                          {STATE_LABELS[state]}
                        </span>
                      </div>
                      <code className="mt-1 block font-mono text-sm text-slate-500">
                        {k.keyPrefix}••••••••
                      </code>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(k.createdAt)} 생성 · 사용 {k.usageCount}회
                        {k.expiresAt ? ` · ${formatDate(k.expiresAt)} 만료` : ""}
                      </p>
                    </div>
                    {state !== "revoked" && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => deleteKey(k.id, k.name)}
                      >
                        삭제
                      </Button>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
