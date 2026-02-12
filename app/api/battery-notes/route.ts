import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeNoteImageUrl,
  safeStringArray,
  type BatteryNotePreview,
} from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";

export async function GET(request: Request) {
  try {
    await ensureBatteryNoteSchema();

    const { searchParams } = new URL(request.url);
    const rawLimit = Number(searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 30)
      : 10;

    const posts = await prisma.batteryNotePost.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        thumbnailUrl: true,
        tags: true,
        publishedAt: true,
      },
    });

    const items: BatteryNotePreview[] = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      thumbnailUrl: normalizeNoteImageUrl(post.thumbnailUrl, 1, post.title),
      tags: safeStringArray(post.tags),
      publishedAt: post.publishedAt.toISOString(),
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
