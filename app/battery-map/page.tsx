import type { Metadata } from "next";
import { Suspense } from "react";
import BatteryMapPageClient from "@/app/components/BatteryMapPageClient";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "배터리 매장 지도 | 내 주변 자동차 배터리 교체 매장 검색",
  description:
    "현재 위치 또는 지역명 기준으로 주변 자동차 배터리 교체/판매 매장을 카카오 지도에서 쉽게 검색하세요. 전화번호, 주소, 카카오 장소 정보를 제공합니다.",
  keywords: [
    "배터리 매장 지도",
    "자동차 배터리 교체 매장",
    "배터리 교체 위치",
    "내 주변 배터리 매장",
    "출장 배터리",
    "카센터 배터리",
    "배터리핏",
  ],
  alternates: {
    canonical: "/battery-map",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "배터리 매장 지도 | 내 주변 자동차 배터리 교체 매장 검색",
    description:
      "현재 위치 기준 주변 자동차 배터리 매장을 카카오 지도에서 검색하세요.",
    url: "/battery-map",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
  twitter: {
    card: "summary_large_image",
    title: "배터리 매장 지도 | 내 주변 배터리 매장 검색",
    description:
      "현재 위치 기준 주변 자동차 배터리 매장을 카카오 지도에서 검색하세요.",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
};

export default function BatteryMapPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "배터리핏",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "배터리 매장 지도",
        item: toAbsoluteUrl("/battery-map"),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Suspense fallback={null}>
        <BatteryMapPageClient />
      </Suspense>
    </>
  );
}
