import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { findUserById } from "@/lib/user-repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function requireAdmin(request: Request) {
  await ensureAuthSchema();
  const session = readSessionFromRequest(request);
  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user || user.role !== "ADMIN") {
    return null;
  }
  return user;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await ensureBatteryNoteSchema();

    const { id } = await params;
    const body = (await request.json()) as {
      action?: "publish" | "draft";
    };

    if (!body.action) {
      return NextResponse.json(
        { message: "action 값이 필요합니다." },
        { status: 400 },
      );
    }

    const now = new Date();
    const nextStatus = body.action === "publish" ? "PUBLISHED" : "DRAFT";

    const updated = await prisma.batteryNotePost.update({
      where: { id },
      data: {
        status: nextStatus,
        reviewedAt: now,
        reviewerId: admin.id,
        ...(nextStatus === "PUBLISHED" ? { publishedAt: now } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({
      item: {
        ...updated,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "검수 상태 변경에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    await ensureBatteryNoteSchema();

    const { id } = await params;
    await prisma.batteryNotePost.delete({
      where: { id },
    });

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("record to delete does not exist")
    ) {
      return NextResponse.json(
        { message: "이미 삭제되었거나 존재하지 않는 글입니다." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "글 삭제에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
