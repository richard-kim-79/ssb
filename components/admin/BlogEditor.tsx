"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/client/api";
import type { BlogCategory, BlogPost, BlogPostInput } from "@/lib/client/types";
import { Alert, Button, Field, Input, Spinner, Textarea } from "@/components/ui";

export const BLOG_CATEGORIES: { value: BlogCategory; label: string }[] = [
  { value: "essay-tips", label: "논술 팁" },
  { value: "admission-info", label: "입시 정보" },
  { value: "platform-guide", label: "사용 가이드" },
  { value: "education-news", label: "교육 소식" },
];

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function BlogEditor({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const editing = !!post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [category, setCategory] = useState<BlogCategory>(post?.category ?? "essay-tips");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [featuredImage, setFeaturedImage] = useState(post?.featuredImage ?? "");
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [published, setPublished] = useState(post?.isPublished === 1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const input: BlogPostInput = {
      title: title.trim(),
      slug: slug.trim(),
      excerpt: excerpt.trim(),
      content,
      category,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      featuredImage: featuredImage.trim() || null,
      metaTitle: metaTitle.trim() || null,
      metaDescription: metaDescription.trim() || null,
      isPublished: published ? 1 : 0,
    };

    if (!input.title || !input.slug || !input.excerpt || !input.content) {
      setError("제목, 슬러그, 요약, 본문은 필수입니다.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(input.slug)) {
      setError("슬러그는 영소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.adminUpdatePost(post.id, input);
      } else {
        await api.adminCreatePost(input);
      }
      router.push("/admin/blog");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {error && <Alert>{error}</Alert>}

      <Field label="제목">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={saving} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="슬러그 (URL)" hint="영소문자·숫자·하이픈만. 예: essay-writing-tips">
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="essay-writing-tips"
            disabled={saving}
          />
        </Field>
        <Field label="카테고리">
          <select
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value as BlogCategory)}
            disabled={saving}
          >
            {BLOG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="요약" hint="목록과 검색결과에 표시됩니다.">
        <Textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="min-h-[80px]"
          maxLength={500}
          disabled={saving}
        />
      </Field>

      <Field label="본문" hint="마크다운을 지원합니다 (제목, 목록, 표, 코드 등).">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[320px] font-mono"
          disabled={saving}
        />
      </Field>

      <Field label="태그" hint="쉼표(,)로 구분. 예: 논술, 입시, 작성법">
        <Input value={tags} onChange={(e) => setTags(e.target.value)} disabled={saving} />
      </Field>

      <Field label="대표 이미지 URL" hint="선택 사항.">
        <Input
          value={featuredImage}
          onChange={(e) => setFeaturedImage(e.target.value)}
          placeholder="https://..."
          disabled={saving}
        />
      </Field>

      <details className="rounded-lg border border-slate-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">SEO 설정 (선택)</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Field label="메타 제목" hint="비우면 제목을 사용합니다.">
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </Field>
          <Field label="메타 설명" hint="비우면 요약을 사용합니다.">
            <Textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
              disabled={saving}
            />
          </Field>
        </div>
      </details>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          disabled={saving}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        지금 게시하기 (체크 해제 시 비공개 초안으로 저장)
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4" /> : editing ? "변경사항 저장" : "글 저장"}
        </Button>
        <Link href="/admin/blog">
          <Button type="button" variant="ghost">
            취소
          </Button>
        </Link>
      </div>
    </form>
  );
}
