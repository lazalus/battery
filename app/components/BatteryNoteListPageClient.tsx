"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { normalizeNoteImageUrl } from "@/lib/battery-note";

type BatteryNotePostPreview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnailUrl: string;
  tags: string[];
  publishedAt: string;
};

function formatKoreanDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function isInlineDataImageUrl(url: string) {
  return typeof url === "string" && url.startsWith("data:image/");
}

export default function BatteryNoteListPageClient() {
  const [posts, setPosts] = useState<BatteryNotePostPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const run = async () => {
      try {
        const response = await fetch("/api/battery-notes?limit=20");
        if (!response.ok) {
          throw new Error(`Battery notes API failed: ${response.status}`);
        }
        const payload = (await response.json()) as {
          items?: BatteryNotePostPreview[];
        };
        if (!cancelled) {
          setPosts(Array.isArray(payload.items) ? payload.items : []);
        }
      } catch {
        if (!cancelled) {
          setPosts([]);
          setError("배터리노트 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/4 p-4 shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:p-5 lg:p-6">
      <h2 className="text-lg font-bold text-white/90">전체 글</h2>
      <p className="mt-1 text-xs text-white/40">
        차량 배터리 관리법, 교체 팁, 배터리 규격 정보를 정리한 콘텐츠입니다.
      </p>

      {isLoading && <p className="mt-3 text-sm text-white/40">글 목록을 불러오는 중입니다.</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 space-y-3 lg:space-y-3.5">
        {posts.map((post) => {
          const rawThumb = normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title);
          const thumb = isInlineDataImageUrl(rawThumb) ? "/apple-icon.svg" : rawThumb;
          return (
            <Link
              key={post.id}
              href={`/battery-note/${post.slug}`}
              className="block rounded-xl border border-white/10 bg-white/3 p-3.5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/6 sm:p-3 lg:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:gap-4">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 sm:h-24 sm:w-32 sm:aspect-auto lg:h-28 lg:w-40">
                  <Image
                    src={thumb}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 128px, 160px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-white/40">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span key={`${post.id}-${tag}`} className="font-semibold text-brand">
                        {tag}
                      </span>
                    ))}
                    <span>·</span>
                    <span>{formatKoreanDate(post.publishedAt)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-white/90 sm:mt-1 sm:text-sm lg:text-[15px]">
                    {post.title}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-6 text-white/50 sm:mt-1 sm:text-xs sm:leading-5 lg:line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!isLoading && posts.length === 0 && !error && (
        <p className="mt-3 text-sm text-white/40">아직 발행된 배터리노트가 없습니다.</p>
      )}
    </article>
  );
}
