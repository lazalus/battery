import { NextResponse } from "next/server";
import { ensureMarketingSchema } from "@/lib/ensure-marketing-schema";
import { recordMarketingEvent } from "@/lib/marketing-repository";

const DEFAULT_COUPANG_SEARCH_BASE_URL = "https://www.coupang.com/np/search";
const ALLOWED_COUPANG_HOSTS = new Set(["www.coupang.com", "m.coupang.com", "link.coupang.com"]);

function isAllowedCoupangUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return false;
    }
    return ALLOWED_COUPANG_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function buildCoupangSearchUrl(query: string) {
  const configuredBaseUrl =
    process.env.COUPANG_SEARCH_BASE_URL?.trim() ||
    DEFAULT_COUPANG_SEARCH_BASE_URL;

  try {
    const url = new URL(configuredBaseUrl);
    if (!isAllowedCoupangUrl(url.toString())) {
      throw new Error("Invalid Coupang host");
    }
    url.searchParams.set("q", query);
    return url.toString();
  } catch {
    const fallback = new URL(DEFAULT_COUPANG_SEARCH_BASE_URL);
    fallback.searchParams.set("q", query);
    return fallback.toString();
  }
}

function fillTemplate(template: string, params: Record<string, string>) {
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output;
}

function buildPartnersRedirectUrl(query: string) {
  const targetSearchUrl = buildCoupangSearchUrl(query);
  const usePartnersRedirect =
    (process.env.COUPANG_USE_PARTNERS_REDIRECT || "").trim().toLowerCase() ===
    "true";
  if (!usePartnersRedirect) {
    return targetSearchUrl;
  }

  const encodedQuery = encodeURIComponent(query);
  const encodedTargetUrl = encodeURIComponent(targetSearchUrl);
  const partnersId = process.env.COUPANG_PARTNERS_ID?.trim() || "";
  const partnersSubId = process.env.COUPANG_PARTNERS_SUB_ID?.trim() || "";

  const template = process.env.COUPANG_PARTNERS_LINK_TEMPLATE?.trim();
  if (template) {
    const templated = fillTemplate(template, {
      PARTNERS_ID: partnersId,
      QUERY: query,
      ENCODED_QUERY: encodedQuery,
      TARGET_URL: targetSearchUrl,
      ENCODED_TARGET_URL: encodedTargetUrl,
      SUB_ID: partnersSubId,
    });
    if (isAllowedCoupangUrl(templated)) {
      return templated;
    }
  }

  // 템플릿이 없거나 유효하지 않으면 모델명 검색결과로 이동한다.
  return targetSearchUrl;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().slice(0, 100);

  if (!query) {
    return NextResponse.json(
      { message: "검색어(q)가 필요합니다." },
      { status: 400 },
    );
  }

  const redirectUrl = buildPartnersRedirectUrl(query);

  const pageType = (searchParams.get("pageType") || "").trim().slice(0, 50);
  const pagePath = (searchParams.get("pagePath") || "").trim().slice(0, 300);
  const source = (searchParams.get("source") || "").trim().slice(0, 100);
  const brandId = (searchParams.get("brandId") || "").trim().slice(0, 30);
  const brandSlug = (searchParams.get("brandSlug") || "").trim().slice(0, 80);
  const brandName = (searchParams.get("brandName") || "").trim().slice(0, 80);
  const modelId = (searchParams.get("modelId") || "").trim().slice(0, 30);
  const modelName = (searchParams.get("modelName") || "").trim().slice(0, 120);
  const noteSlug = (searchParams.get("noteSlug") || "").trim().slice(0, 140);
  const sessionId = (searchParams.get("sid") || "").trim().slice(0, 80);

  try {
    await ensureMarketingSchema();
    await recordMarketingEvent({
      eventType: "COUPANG_CLICK",
      pageType: pageType || null,
      pagePath: pagePath || null,
      source: source || "coupang-search",
      brandId: brandId || null,
      brandSlug: brandSlug || null,
      brandName: brandName || null,
      modelId: modelId || null,
      modelName: modelName || null,
      noteSlug: noteSlug || null,
      query,
      sessionId: sessionId || null,
    });
  } catch {
    // 추적 저장 실패가 리다이렉트 동작을 막지 않도록 무시한다.
  }

  try {
    if (!isAllowedCoupangUrl(redirectUrl)) {
      return NextResponse.redirect(buildCoupangSearchUrl(query));
    }
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(buildCoupangSearchUrl(query));
  }
}
