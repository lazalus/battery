import { NextResponse } from "next/server";
import {
  normalizeNoteImageUrl,
  type BatteryNoteDetail,
} from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { findPublishedBatteryNoteBySlug } from "@/lib/battery-note-repository";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await ensureBatteryNoteSchema();

    const { slug } = await params;
    const post = await findPublishedBatteryNoteBySlug(slug);

    if (!post) {
      return NextResponse.json(
        { message: "게시글을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const item: BatteryNoteDetail = {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      thumbnailUrl: normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title),
      bodyImageUrls: post.bodyImageUrls.map((url, index) =>
        normalizeNoteImageUrl(url, index + 2, `${post.title} ${index + 1}`),
      ),
      tags: post.tags,
      publishedAt: post.publishedAt,
    };

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        message: "배터리노트를 불러오지 못했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
