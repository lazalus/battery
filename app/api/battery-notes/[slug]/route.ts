import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeStringArray, type BatteryNoteDetail } from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await ensureBatteryNoteSchema();

    const { slug } = await params;
    const post = await prisma.batteryNotePost.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
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
      thumbnailUrl: post.thumbnailUrl,
      bodyImageUrls: safeStringArray(post.bodyImageUrls),
      tags: safeStringArray(post.tags),
      publishedAt: post.publishedAt.toISOString(),
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
