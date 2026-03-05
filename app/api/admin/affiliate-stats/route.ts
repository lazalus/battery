import { NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { ensureMarketingSchema } from "@/lib/ensure-marketing-schema";
import { findUserById } from "@/lib/user-repository";
import { getAffiliateCtrSummary } from "@/lib/marketing-repository";

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

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") || "30");

    await ensureMarketingSchema();
    const summary = await getAffiliateCtrSummary(days);

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        message: "제휴 클릭 통계를 불러오지 못했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
