import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { safeStringArray } from "@/lib/battery-note";
import { findUserById } from "@/lib/user-repository";

async function isAdmin(request: Request) {
  await ensureAuthSchema();
  const session = readSessionFromRequest(request);
  if (!session) {
    return false;
  }
  if (session.role === "ADMIN") {
    return true;
  }

  const user = await findUserById(session.userId);
  return user?.role === "ADMIN";
}

export async function GET(request: Request) {
  try {
    if (!(await isAdmin(request))) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await ensureBatteryNoteSchema();

    const posts = await prisma.batteryNotePost.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        status: true,
        tags: true,
        createdAt: true,
        reviewedAt: true,
        publishedAt: true,
      },
    });

    const items = posts.map((post) => ({
      ...post,
      tags: safeStringArray(post.tags),
      createdAt: post.createdAt.toISOString(),
      reviewedAt: post.reviewedAt ? post.reviewedAt.toISOString() : null,
      publishedAt: post.publishedAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        message: "관리자 노트 목록을 불러오지 못했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
