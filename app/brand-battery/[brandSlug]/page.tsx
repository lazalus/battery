import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSenseSlot from "@/app/components/AdSenseSlot";
import MarketingPageViewTracker from "@/app/components/MarketingPageViewTracker";
import SiteNavigation from "@/app/components/SiteNavigation";
import {
  extractModelYearSummary,
  findCatalogBrandBySlug,
  getBrandBatterySlugPath,
  getBrandSlug,
  getCarBatteryLandingPath,
  listCatalogBrands,
} from "@/lib/vehicle-catalog";
import { toAbsoluteUrl } from "@/lib/seo";

type PageProps = {
  params: Promise<{ brandSlug: string }>;
};

export async function generateStaticParams() {
  return listCatalogBrands().map((brand) => ({
    brandSlug: getBrandSlug(brand),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandSlug } = await params;
  const brand = findCatalogBrandBySlug(brandSlug);
  if (!brand) {
    return {
      title: "브랜드 배터리 찾기",
      robots: { index: false, follow: false },
    };
  }

  const pagePath = getBrandBatterySlugPath(brand);
  const title = `${brand.name} 자동차 배터리 모델별 호환 찾기`;
  const description = `${brand.name} 차량 모델별 배터리 규격·호환표를 한눈에 확인하세요. 연식·엔진별 호환 배터리 조회, 주변 매장 검색, 온라인 구매까지 배터리핏에서.`;

  return {
    title,
    description,
    keywords: [
      `${brand.name} 배터리`,
      `${brand.name} 자동차 배터리`,
      `${brand.name} 배터리 교체`,
      `${brand.name} 배터리 규격`,
      "자동차 배터리 호환",
      "배터리핏",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      title,
      description,
      url: pagePath,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BrandBatterySlugPage({ params }: PageProps) {
  const { brandSlug } = await params;
  const brand = findCatalogBrandBySlug(brandSlug);
  if (!brand) {
    notFound();
  }

  const resolvedBrandSlug = getBrandSlug(brand);
  const pagePath = getBrandBatterySlugPath(resolvedBrandSlug);
  const brandHubTopAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BRAND_HUB_TOP?.trim();
  const brandHubInlineAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BRAND_HUB_INLINE?.trim();
  const purchaseHref = `/api/coupang/search?${new URLSearchParams({
    q: `${brand.name} 배터리`,
    pageType: "BRAND_HUB",
    pagePath,
    source: "brand-hub",
    brandId: String(brand.id),
    brandSlug: resolvedBrandSlug,
    brandName: brand.name,
  }).toString()}`;

  const models = [...brand.models]
    .map((model) => ({
      ...model,
      yearSummary: extractModelYearSummary(model.trims),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "배터리핏",
        item: toAbsoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: `${brand.name} 배터리`,
        item: toAbsoluteUrl(pagePath),
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-[#0a0e17] px-3 py-4 text-white/90 sm:px-6 sm:py-7 lg:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <SiteNavigation />
      <MarketingPageViewTracker
        pageType="BRAND_HUB"
        pagePath={pagePath}
        source="brand-hub"
        brandId={String(brand.id)}
        brandSlug={resolvedBrandSlug}
        brandName={brand.name}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-16 md:pb-8 md:pt-20">
        <section className="rounded-2xl border border-white/10 bg-white/4 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
          <p className="text-xs font-semibold text-brand">{brand.origin} / {brand.name}</p>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
            {brand.name} 차량 배터리 모델 허브
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {brand.name} 브랜드 차량의 모델별 배터리 찾기 페이지입니다. 모델을 선택하면 연식,
            엔진/트림 기준으로 호환 배터리를 확인하고 주변 배터리 매장 검색, 상품구매까지 연결할
            수 있습니다.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">브랜드</p>
              <p className="mt-1 text-sm font-semibold">{brand.name}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">원산지</p>
              <p className="mt-1 text-sm font-semibold">{brand.origin}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">모델 수</p>
              <p className="mt-1 text-sm font-semibold">{brand.models.length}개</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/battery-map"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-white/80 shadow-sm"
            >
              주변 배터리 매장 보기
            </Link>
            <a
              href={purchaseHref}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-white/80 shadow-sm"
            >
              {brand.name} 배터리 상품구매
            </a>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </section>

        <AdSenseSlot
          slot={brandHubTopAdSlot}
          label="브랜드 허브 광고"
          minHeightClassName="min-h-[110px]"
        />

        <section className="rounded-2xl border border-white/10 bg-white/4 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{brand.name} 모델별 배터리 찾기</h2>
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-white/4 px-3 text-xs font-semibold text-white/60 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              차량선택으로 찾기
            </Link>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <Link
                key={model.id}
                href={getCarBatteryLandingPath(brand.id, model.id)}
                className="rounded-xl border border-white/10 bg-white/4 px-3 py-3 transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-white/90">
                  {brand.name} {model.name}
                </p>
                <p className="mt-1 text-xs text-white/40">{model.yearSummary.label}</p>
                <p className="mt-1 text-[11px] text-white/30">
                  엔진/트림 데이터 {model.trims.length}개
                </p>
              </Link>
            ))}
          </div>
          <AdSenseSlot
            slot={brandHubInlineAdSlot}
            label="브랜드 모델 목록 하단 광고"
            minHeightClassName="mt-4 min-h-[120px]"
          />
        </section>
      </main>
    </div>
  );
}
