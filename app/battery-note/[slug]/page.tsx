import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findPublishedBatteryNoteBySlug,
} from "@/lib/battery-note-repository";
import { normalizeNoteImageUrl } from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { toAbsoluteUrl } from "@/lib/seo";
import SiteNavigation from "@/app/components/SiteNavigation";
import {
  findRelevantCatalogBrandModelsByText,
  getBrandBatterySlugPath,
  getBrandSlug,
  getCarBatteryLandingPath,
} from "@/lib/vehicle-catalog";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatKoreanDate(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

function isInlineDataImageUrl(url: string) {
  return typeof url === "string" && url.startsWith("data:image/");
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  await ensureBatteryNoteSchema();
  const { slug } = await params;
  const post = await findPublishedBatteryNoteBySlug(slug);

  if (!post) {
    return {
      title: "게시글을 찾을 수 없습니다",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalPath = `/battery-note/${post.slug}`;
  const normalizedThumb = normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title);
  const shareImage = isInlineDataImageUrl(normalizedThumb)
    ? toAbsoluteUrl("/apple-icon.svg")
    : normalizedThumb;

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags.map((tag) => tag.replace(/^#/, "")).filter(Boolean),
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      url: canonicalPath,
      title: post.title,
      description: post.excerpt,
      publishedTime: new Date(post.publishedAt).toISOString(),
      tags: post.tags,
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [shareImage],
    },
  };
}

export default async function BatteryNoteDetailPage({ params }: PageProps) {
  await ensureBatteryNoteSchema();

  const { slug } = await params;
  const post = await findPublishedBatteryNoteBySlug(slug);

  if (!post) {
    notFound();
  }

  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const bodyImages = post.bodyImageUrls.map((url, index) =>
    normalizeNoteImageUrl(url, index + 2, `${post.title} ${index + 1}`),
  );
  const tags = post.tags;
  const thumbnailUrl = normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title);
  const subtitleBlock = paragraphs.find((paragraph) => paragraph.startsWith("부제:"));
  const subtitle = subtitleBlock?.replace(/^부제:\s*/, "").trim() ?? "";
  const contentBlocks = paragraphs.filter((paragraph) => paragraph !== subtitleBlock);
  const bodyImageInsertIndexes = bodyImages.map((_, imageIndex) =>
    Math.max(
      0,
      Math.min(
        Math.max(0, contentBlocks.length - 1),
        Math.floor(((imageIndex + 1) * (contentBlocks.length + 1)) / (bodyImages.length + 1)) -
          1,
      ),
    ),
  );
  const imageIndexesByParagraph = new Map<number, number[]>();
  bodyImageInsertIndexes.forEach((paragraphIndex, imageIndex) => {
    const current = imageIndexesByParagraph.get(paragraphIndex) ?? [];
    current.push(imageIndex);
    imageIndexesByParagraph.set(paragraphIndex, current);
  });

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.publishedAt).toISOString(),
    inLanguage: "ko-KR",
    mainEntityOfPage: toAbsoluteUrl(`/battery-note/${post.slug}`),
    image: isInlineDataImageUrl(thumbnailUrl)
      ? [toAbsoluteUrl("/apple-icon.svg")]
      : [thumbnailUrl],
    author: {
      "@type": "Organization",
      name: "배터리핏",
    },
    publisher: {
      "@type": "Organization",
      name: "배터리핏",
      logo: {
        "@type": "ImageObject",
        url: toAbsoluteUrl("/icon.svg"),
      },
    },
  };

  const noteTextForMatching = [post.title, post.excerpt, ...tags, post.content].join(" ");
  const matchedModels = findRelevantCatalogBrandModelsByText(noteTextForMatching, 3).map(
    ({ brand, model }) => ({
      label: `${brand.name} ${model.name} 배터리`,
      href: getCarBatteryLandingPath(brand.id, model.id),
    }),
  );
  const matchedBrand =
    findRelevantCatalogBrandModelsByText(noteTextForMatching, 1)[0]?.brand ?? null;
  const relatedMapKeyword =
    matchedBrand ? `${matchedBrand.name} 배터리` : "배터리 교체";
  const relatedPurchaseQuery =
    matchedModels[0]?.label ?? `${matchedBrand?.name ?? "자동차"} 배터리`;
  const relatedPurchaseHref = `/api/coupang/search?${new URLSearchParams({
    q: relatedPurchaseQuery,
    pageType: "BATTERY_NOTE",
    pagePath: `/battery-note/${post.slug}`,
    source: "battery-note",
    noteSlug: post.slug,
    ...(matchedBrand
      ? {
          brandId: String(matchedBrand.id),
          brandSlug: getBrandSlug(matchedBrand),
          brandName: matchedBrand.name,
        }
      : {}),
  }).toString()}`;

  return (
    <main className="min-h-dvh bg-[#0a0e17] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pb-8 md:pt-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <SiteNavigation />
      <article className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/4 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-5">
          <Link href="/battery-note" className="text-xs font-semibold text-brand hover:underline">
            배터리노트 목록으로
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
          {tags.map((tag) => (
            <span key={tag} className="font-semibold text-brand">
              {tag}
            </span>
          ))}
          <span>·</span>
          <span>{formatKoreanDate(new Date(post.publishedAt))}</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-white/95">
          {post.title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base font-semibold leading-relaxed text-white/70">
            {subtitle}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-white/50">{post.excerpt}</p>
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          {isInlineDataImageUrl(thumbnailUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={post.title}
              className="h-auto w-full object-cover"
              loading="eager"
            />
          ) : (
            <Image
              src={thumbnailUrl}
              alt={post.title}
              width={1600}
              height={900}
              className="h-auto w-full object-cover"
              priority
            />
          )}
        </div>

        <section className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white/90">관련 바로가기</h2>
            {matchedBrand ? (
              <Link
                href={getBrandBatterySlugPath(getBrandSlug(matchedBrand))}
                className="text-xs font-semibold text-brand hover:underline"
              >
                {matchedBrand.name} 모델 허브 보기
              </Link>
            ) : null}
          </div>

          {matchedModels.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {matchedModels.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-brand/40 hover:text-brand"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href={`/battery-map?q=${encodeURIComponent(relatedMapKeyword)}`}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              주변 배터리 매장 보기
            </Link>
            <a
              href={relatedPurchaseHref}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              관련 배터리 상품구매
            </a>
          </div>
          <p className="mt-2 text-[11px] text-white/30">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </section>

        <div className="mt-7 space-y-4 text-[15px] leading-8 text-white/70">
          {contentBlocks.map((paragraph, index) => {
            const headingMatch = paragraph.match(/^##\s+(.+)$/m);
            const heading = headingMatch ? headingMatch[1].trim() : "";
            const body = heading
              ? paragraph.replace(/^##\s+.+$/m, "").trim()
              : paragraph;

            return (
              <div key={`${index}-${paragraph.slice(0, 20)}`}>
                {heading ? (
                  <h2 className="mb-1 text-lg font-bold leading-snug text-white/90">
                    {heading}
                  </h2>
                ) : null}
                {body ? <p>{body}</p> : null}
                {(imageIndexesByParagraph.get(index) ?? []).map((imageIndex) => (
                  <div
                    key={`body-image-${index}-${imageIndex}`}
                    className="my-5 overflow-hidden rounded-xl border border-white/10 bg-white/5"
                  >
                    {isInlineDataImageUrl(bodyImages[imageIndex]) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bodyImages[imageIndex]}
                        alt={`본문 이미지 ${imageIndex + 1}`}
                        className="h-auto w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Image
                        src={bodyImages[imageIndex]}
                        alt={`본문 이미지 ${imageIndex + 1}`}
                        width={1600}
                        height={900}
                        className="h-auto w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </article>
    </main>
  );
}
