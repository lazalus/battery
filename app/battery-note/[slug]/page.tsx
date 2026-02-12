import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeNoteImageUrl, safeStringArray } from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";

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

export default async function BatteryNoteDetailPage({ params }: PageProps) {
  await ensureBatteryNoteSchema();

  const { slug } = await params;
  const post = await prisma.batteryNotePost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      excerpt: true,
      content: true,
      thumbnailUrl: true,
      bodyImageUrls: true,
      tags: true,
      publishedAt: true,
    },
  });

  if (!post) {
    notFound();
  }

  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const bodyImages = safeStringArray(post.bodyImageUrls).map((url, index) =>
    normalizeNoteImageUrl(url, index + 2, `${post.title} ${index + 1}`),
  );
  const tags = safeStringArray(post.tags);
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <article className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5">
          <Link href="/" className="text-xs font-semibold text-brand hover:underline">
            배터리노트 목록으로
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {tags.map((tag) => (
            <span key={tag} className="font-semibold text-brand">
              {tag}
            </span>
          ))}
          <span>·</span>
          <span>{formatKoreanDate(post.publishedAt)}</span>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-slate-900">
          {post.title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base font-semibold leading-relaxed text-slate-700">
            {subtitle}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{post.excerpt}</p>
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-slate-100">
          <Image
            src={thumbnailUrl}
            alt={post.title}
            width={1600}
            height={900}
            className="h-auto w-full object-cover"
            priority
          />
        </div>

        <div className="mt-7 space-y-4 text-[15px] leading-8 text-slate-700">
          {contentBlocks.map((paragraph, index) => {
            const headingMatch = paragraph.match(/^##\s+(.+)$/m);
            const heading = headingMatch ? headingMatch[1].trim() : "";
            const body = heading
              ? paragraph.replace(/^##\s+.+$/m, "").trim()
              : paragraph;

            return (
            <div key={`${index}-${paragraph.slice(0, 20)}`}>
              {heading ? (
                <h2 className="mb-1 text-lg font-bold leading-snug text-slate-900">
                  {heading}
                </h2>
              ) : null}
              {body ? <p>{body}</p> : null}
              {(imageIndexesByParagraph.get(index) ?? []).map((imageIndex) => (
                <div
                  key={`body-image-${index}-${imageIndex}`}
                  className="my-5 overflow-hidden rounded-xl border border-line bg-slate-100"
                >
                  <Image
                    src={bodyImages[imageIndex]}
                    alt={`본문 이미지 ${imageIndex + 1}`}
                    width={1600}
                    height={900}
                    className="h-auto w-full object-cover"
                  />
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
