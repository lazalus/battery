import { NextResponse } from "next/server";
import { ensureMarketingSchema } from "@/lib/ensure-marketing-schema";
import { recordMarketingEvent } from "@/lib/marketing-repository";

type Payload = {
  eventType?: "PAGE_VIEW" | "CTA_CLICK";
  pageType?: string;
  pagePath?: string;
  source?: string;
  brandId?: string;
  brandSlug?: string;
  brandName?: string;
  modelId?: string;
  modelName?: string;
  noteSlug?: string;
  query?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    if (!payload?.eventType || !["PAGE_VIEW", "CTA_CLICK"].includes(payload.eventType)) {
      return NextResponse.json({ message: "Invalid eventType" }, { status: 400 });
    }

    await ensureMarketingSchema();
    await recordMarketingEvent({
      eventType: payload.eventType,
      pageType: payload.pageType,
      pagePath: payload.pagePath,
      source: payload.source,
      brandId: payload.brandId,
      brandSlug: payload.brandSlug,
      brandName: payload.brandName,
      modelId: payload.modelId,
      modelName: payload.modelName,
      noteSlug: payload.noteSlug,
      query: payload.query,
      sessionId: payload.sessionId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message: "마케팅 이벤트 저장 실패",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
