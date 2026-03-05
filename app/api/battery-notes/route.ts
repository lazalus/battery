import { NextResponse } from "next/server";
import {
  normalizeNoteImageUrl,
  type BatteryNotePreview,
} from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { listPublishedBatteryNotes } from "@/lib/battery-note-repository";

export async function GET(request: Request) {
  try {
    await ensureBatteryNoteSchema();

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 30)
      : 10;

    const posts = await listPublishedBatteryNotes(limit);

    const items: BatteryNotePreview[] = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      thumbnailUrl: normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title),
      tags: post.tags,
      publishedAt: post.publishedAt,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        message: "배터리노트 목록을 불러오지 못했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
