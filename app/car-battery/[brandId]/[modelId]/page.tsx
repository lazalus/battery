import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSenseSlot from "@/app/components/AdSenseSlot";
import MarketingPageViewTracker from "@/app/components/MarketingPageViewTracker";
import SiteNavigation from "@/app/components/SiteNavigation";
import {
  extractModelYearSummary,
  getBrandBatterySlugPath,
  getBrandSlug,
  findCatalogBrandModel,
  getCarBatteryLandingPath,
  listAllCatalogBrandModels,
} from "@/lib/vehicle-catalog";
import { toAbsoluteUrl } from "@/lib/seo";

type PageProps = {
  params: Promise<{ brandId: string; modelId: string }>;
};

export async function generateStaticParams() {
  return listAllCatalogBrandModels().map(({ brand, model }) => ({
    brandId: String(brand.id),
    modelId: String(model.id),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brandId, modelId } = await params;
  const pair = findCatalogBrandModel(brandId, modelId);
  if (!pair) {
    return {
      title: "차량 배터리 정보",
      robots: { index: false, follow: false },
    };
  }

  const { brand, model } = pair;
  const pagePath = getCarBatteryLandingPath(brand.id, model.id);
  const title = `${brand.name} ${model.name} 배터리 호환 찾기`;
  const description = `${brand.name} ${model.name} 차량의 배터리 호환 모델을 배터리핏에서 확인하고, 주변 매장 검색 및 쿠팡 상품구매까지 연결하세요.`;

  return {
    title,
    description,
    keywords: [
      `${brand.name} ${model.name} 배터리`,
      `${model.name} 배터리`,
      `${brand.name} 배터리 교체`,
      "차량모델 배터리",
      "배터리핏",
    ],
    alternates: { canonical: pagePath },
    openGraph: {
      type: "article",
      locale: "ko_KR",
      title,
      description,
      url: pagePath,
      images: [toAbsoluteUrl("/apple-icon.svg")],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [toAbsoluteUrl("/apple-icon.svg")],
    },
  };
}

export default async function CarBatteryLandingPage({ params }: PageProps) {
  const { brandId, modelId } = await params;
  const pair = findCatalogBrandModel(brandId, modelId);
  if (!pair) {
    notFound();
  }

  const { brand, model } = pair;
  const yearSummary = extractModelYearSummary(model.trims);
  const trimCount = model.trims.length;
  const path = getCarBatteryLandingPath(brand.id, model.id);
  const brandSlug = getBrandSlug(brand);
  const brandHubPath = getBrandBatterySlugPath(brandSlug);
  const modelTopAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_MODEL_LANDING_TOP?.trim();
  const modelInlineAdSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_MODEL_LANDING_INLINE?.trim();
  const purchaseQuery = `${brand.name} ${model.name} 배터리`;
  const purchaseHref = `/api/coupang/search?${new URLSearchParams({
    q: purchaseQuery,
    pageType: "MODEL_LANDING",
    pagePath: path,
    source: "model-landing",
    brandId: String(brand.id),
    brandSlug,
    brandName: brand.name,
    modelId: String(model.id),
    modelName: model.name,
  }).toString()}`;

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
        name: "차량 배터리 찾기",
        item: toAbsoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${brand.name} 배터리`,
        item: toAbsoluteUrl(brandHubPath),
      },
      {
        "@type": "ListItem",
        position: 4,
        name: `${brand.name} ${model.name} 배터리`,
        item: toAbsoluteUrl(path),
      },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${brand.name} ${model.name} 배터리는 어떤 기준으로 골라야 하나요?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "연식, 엔진/트림, 배터리 타입(AGM/EFB/일반), 단자 방향, 규격(DIN/JIS)을 함께 확인해야 합니다. 배터리핏에서 차량 선택 단계로 확인할 수 있습니다.",
        },
      },
      {
        "@type": "Question",
        name: `${model.name} 배터리 교체 전에 확인할 점은 무엇인가요?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "기존 장착 배터리의 Ah, CCA, 규격 코드와 차량의 아이들링스톱 여부를 먼저 확인하고, 호환 모델 중 권장 제품을 선택하는 것이 안전합니다.",
        },
      },
    ],
  };

  const relatedModels = brand.models
    .filter((item) => item.id !== model.id)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      name: item.name,
      href: getCarBatteryLandingPath(brand.id, item.id),
    }));

  return (
    <div className="min-h-dvh bg-[#0a0e17] px-3 py-4 text-white/90 sm:px-6 sm:py-7 lg:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteNavigation />
      <MarketingPageViewTracker
        pageType="MODEL_LANDING"
        pagePath={path}
        source="model-landing"
        brandId={String(brand.id)}
        brandSlug={brandSlug}
        brandName={brand.name}
        modelId={String(model.id)}
        modelName={model.name}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-16 md:pb-8 md:pt-20">
        <article className="rounded-xl border border-white/10 bg-white/4 p-4 shadow-sm sm:rounded-2xl sm:p-6">
          <p className="text-xs font-semibold text-brand">
            {brand.origin} / {brand.name}
          </p>
          <h1 className="sr-only">
            {brand.name} {model.name} 배터리 호환 찾기
          </h1>
          <p className="mt-2 text-sm font-semibold text-white/90">
            {brand.name} {model.name} 배터리 호환 안내
          </p>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {brand.name} {model.name} 차량 배터리는 연식과 엔진/트림에 따라 호환 규격이 달라질
            수 있습니다. 배터리핏에서는 차량 선택 단계를 통해 호환 배터리를 확인하고, 주변
            배터리 매장 검색 및 상품구매까지 이어서 확인할 수 있습니다.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">차량 원산지</p>
              <p className="mt-1 text-sm font-semibold">{brand.origin}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">연식 범위(카탈로그 기준)</p>
              <p className="mt-1 text-sm font-semibold">{yearSummary.label}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[11px] text-white/40">엔진/트림 데이터</p>
              <p className="mt-1 text-sm font-semibold">{trimCount}개</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/3 p-3">
            <h2 className="text-sm font-bold">배터리 선택 전에 확인할 점</h2>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-white/60">
              <li>연식과 엔진/트림이 동일한지 확인</li>
              <li>아이들링스톱 차량 여부(AGM/EFB 여부) 확인</li>
              <li>기존 배터리 규격 코드 및 단자 방향 확인</li>
              <li>정확한 장착 여부는 최종적으로 실물 확인 권장</li>
            </ul>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Link
              href={brandHubPath}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-white/80 shadow-sm"
            >
              {brand.name} 모델 허브
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-brand bg-brand px-4 text-sm font-semibold text-white shadow-sm"
            >
              배터리핏에서 차량 선택 시작
            </Link>
            <Link
              href={`/battery-map?q=${encodeURIComponent(`${model.name} 배터리`)}`}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-white/80 shadow-sm"
            >
              주변 배터리 매장 보기
            </Link>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <a
              href={purchaseHref}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/4 px-4 text-sm font-semibold text-white/80 shadow-sm sm:col-start-3"
            >
              {brand.name} {model.name} 상품구매
            </a>
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </p>
        </article>

        <AdSenseSlot slot={modelTopAdSlot} label="모델 랜딩 광고" minHeightClassName="min-h-[110px]" />

        <section className="rounded-xl border border-white/10 bg-white/4 p-4 shadow-sm sm:rounded-2xl sm:p-6">
          <h2 className="text-base font-bold">{brand.name} 다른 모델 배터리 찾기</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {relatedModels.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-sm font-semibold text-white/80 transition hover:border-brand/40 hover:bg-white"
              >
                {brand.name} {item.name} 배터리
              </Link>
            ))}
          </div>
          <AdSenseSlot
            slot={modelInlineAdSlot}
            label="관련 모델 하단 광고"
            minHeightClassName="mt-4 min-h-[120px]"
          />
        </section>
      </main>
    </div>
  );
}
