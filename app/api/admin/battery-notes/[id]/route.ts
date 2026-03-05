import { NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { findUserById } from "@/lib/user-repository";
import {
  deleteBatteryNoteById,
  updateBatteryNoteStatus,
} from "@/lib/battery-note-repository";

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

    const nextStatus = body.action === "publish" ? "PUBLISHED" : "DRAFT";

    const updated = await updateBatteryNoteStatus({
      id,
      status: nextStatus,
      reviewerId: admin.id,
    });

    if (!updated) {
      return NextResponse.json(
        { message: "게시글을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: updated });
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
    const deleted = await deleteBatteryNoteById(id);

    if (!deleted) {
      return NextResponse.json(
        { message: "이미 삭제되었거나 존재하지 않는 글입니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        message: "글 삭제에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
