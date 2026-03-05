import type { Metadata } from "next";
import SiteNavigation from "@/app/components/SiteNavigation";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "배터리핏 소개 | 차량 배터리 호환 조회 서비스",
  description:
    "배터리핏은 차량별 배터리 호환 조회와 주변 배터리 매장 검색을 제공하는 서비스입니다. 국산차·수입차 배터리 찾기, 매장 지도 검색, 사업자 정보를 안내합니다.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "배터리핏 소개 | 차량 배터리 호환 조회 서비스",
    description:
      "차량별 배터리 호환 정보를 쉽게 확인하고 주변 매장까지 검색할 수 있는 배터리핏 서비스를 소개합니다.",
    url: "/about",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
};

export default function AboutPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "배터리핏", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "소개",
        item: toAbsoluteUrl("/about"),
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

      <main className="mx-auto w-full max-w-4xl pb-[calc(7rem+env(safe-area-inset-bottom))] pt-16 md:pb-8 md:pt-20">
        <article className="rounded-2xl border border-white/10 bg-white/4 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <p className="text-xs font-semibold tracking-[0.12em] text-white/40">ABOUT</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white/95">배터리핏 소개</h1>

          <section className="mt-6 space-y-4 text-sm leading-7 text-white/60">
            <p>
              배터리핏(BatteryFit)은 차량별 배터리 호환 정보를 보다 쉽게 확인할 수 있도록 만든
              배터리 전문 정보 서비스입니다. 국산차와 수입차를 구분해 브랜드, 모델, 연식,
              엔진·트림 순서로 선택하면 호환 가능한 배터리 후보를 확인할 수 있고, 주변 배터리 매장
              검색과 상품구매 동선까지 이어서 제공합니다.
            </p>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-base font-bold text-white/90">서비스 기능</h2>
            <ul className="space-y-2 text-sm leading-6 text-white/60">
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                차량 선택 기반 배터리 호환 조회 (국산차/수입차)
              </li>
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                카카오맵 기반 주변 배터리 매장 지도 검색
              </li>
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                차량/브랜드/모델 기반 모델별 배터리 안내 페이지
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-base font-bold text-white/90">면책 조항</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>
                배터리핏은 사용자의 차량 선택 편의를 위해 호환 배터리 정보를 정리하여 제공합니다.
                다만 차량 옵션, 생산 시기, 개조 여부, 기존 장착 이력에 따라 실제 장착 가능 규격이
                달라질 수 있으므로 최종 장착 전에는 반드시 실차 장착 배터리 규격과 단자 방향,
                배터리 타입(AGM/EFB/일반)을 확인하시기 바랍니다.
              </p>
              <p className="mt-3">
                본 서비스에서 제공하는 정보는 참고 목적이며, 배터리핏은 제공 정보의 정확성, 완전성,
                최신성을 보증하지 않습니다. 이용자가 본 서비스의 정보에 기반하여 발생한 직접적,
                간접적 손해에 대해 배터리핏은 법적 책임을 부담하지 않습니다.
              </p>
            </div>
          </section>

          <section className="mt-8 space-y-3">
            <h2 className="text-base font-bold text-white/90">사업자 정보</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-6 text-white/60">
              <p>상호: 에스아이</p>
              <p>대표자: 정희수</p>
              <p>사업자등록번호: 111-63-00101</p>
              <p>통신판매업신고: 2024-안양동안-0010</p>
              <p>주소: 경기도 안양시 동안구 엘에스로116번길91 금정역3차 SKV1센터 지하1층 B104호</p>
              <p>
                이메일:{" "}
                <a href="mailto:nov9306@gmail.com" className="text-brand hover:underline">
                  nov9306@gmail.com
                </a>
              </p>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
