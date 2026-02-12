import { NextResponse } from "next/server";
import { applySessionCookie, hashPassword, type UserRole } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import {
  countAdminUsers,
  createUser,
  findUserByEmail,
} from "@/lib/user-repository";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveRole(email: string): UserRole {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email) ? "ADMIN" : "USER";
}

export async function POST(request: Request) {
  try {
    await ensureAuthSchema();

    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = (body.name || "").trim();
    const email = normalizeEmail(body.email || "");
    const password = body.password || "";

    if (name.length < 2 || email.length < 5 || password.length < 8) {
      return NextResponse.json(
        { message: "이름, 이메일, 비밀번호(8자 이상)를 확인해주세요." },
        { status: 400 },
      );
    }

    const exists = await findUserByEmail(email);
    if (exists) {
      return NextResponse.json(
        { message: "이미 가입된 이메일입니다." },
        { status: 409 },
      );
    }

    let role = resolveRole(email);
    if (role !== "ADMIN") {
      const adminCount = await countAdminUsers();
      if (adminCount === 0) {
        role = "ADMIN";
      }
    }
    const passwordHash = await hashPassword(password);
    const created = await createUser({
      name,
      email,
      passwordHash,
      role,
    });

    const response = NextResponse.json({ user: created });
    applySessionCookie(response, created.id, created.role as UserRole);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: "회원가입에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
