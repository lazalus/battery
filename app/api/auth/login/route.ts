import { NextResponse } from "next/server";
import {
  applySessionCookie,
  type UserRole,
  verifyPassword,
} from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { findUserByEmail } from "@/lib/user-repository";

export async function POST(request: Request) {
  try {
    await ensureAuthSchema();

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    if (!email || !password) {
      return NextResponse.json(
        { message: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 },
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const matched = await verifyPassword(password, user.passwordHash);
    if (!matched) {
      return NextResponse.json(
        { message: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
    applySessionCookie(response, user.id, user.role as UserRole);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: "로그인에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
