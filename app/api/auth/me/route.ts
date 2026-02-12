import { NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { findUserById } from "@/lib/user-repository";

export async function GET(request: Request) {
  try {
    await ensureAuthSchema();

    const session = readSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await findUserById(session.userId);

    return NextResponse.json({ user: user ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        message: "사용자 정보를 확인하지 못했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
