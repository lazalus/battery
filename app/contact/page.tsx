import type { Metadata } from "next";
import SiteNavigation from "@/app/components/SiteNavigation";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "문의하기 | 배터리핏 고객센터",
  description:
    "배터리핏 서비스 오류 제보, 차량 배터리 호환 데이터 수정 요청, 제휴 및 광고 문의 방법을 안내합니다. 이메일로 문의해 주세요.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "문의하기 | 배터리핏 고객센터",
    description:
      "배터리핏 서비스 오류, 배터리 데이터 수정, 제휴/광고 문의를 안내합니다.",
    url: "/contact",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
};

export default function ContactPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "배터리핏", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "문의하기",
        item: toAbsoluteUrl("/contact"),
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
          <p className="text-xs font-semibold tracking-[0.12em] text-white/40">CONTACT</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white/95">문의하기</h1>
          <p className="mt-4 text-sm leading-7 text-white/60">
            배터리핏 사용 중 오류, 차량 배터리 호환 데이터 수정 요청, 제휴/광고 문의는 아래
            연락처로 보내주세요. 운영자가 확인 후 순차적으로 답변드립니다.
          </p>

          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/3 p-4">
              <p className="text-xs font-semibold text-white/40">이메일 문의</p>
              <a
                href="mailto:nov9306@gmail.com?subject=%EB%B0%B0%ED%84%B0%EB%A6%AC%ED%95%8F%20%EB%AC%B8%EC%9D%98"
                className="mt-2 block text-sm font-semibold text-brand hover:underline"
              >
                nov9306@gmail.com
              </a>
              <p className="mt-2 text-xs leading-5 text-white/40">
                서비스 오류 제보, 데이터 수정 요청, 제휴/광고 문의
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/3 p-4">
              <p className="text-xs font-semibold text-white/40">응답 안내</p>
              <p className="mt-2 text-sm font-semibold text-white/80">평일 기준 1~3영업일</p>
              <p className="mt-2 text-xs leading-5 text-white/40">
                문의 내용과 첨부 정보(차량 모델명, 연식, 기존 배터리 규격)를 함께 보내주시면
                확인이 더 빠릅니다.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-base font-bold text-white/90">문의 시 함께 보내주면 좋은 정보</h2>
            <ul className="space-y-2 text-sm leading-6 text-white/60">
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                차량 브랜드 / 모델명 / 연식 / 엔진·트림
              </li>
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                기존 장착 배터리 규격(예: DIN74L, 80Ah 등)
              </li>
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                화면 캡처(오류 발생 페이지 URL 포함)
              </li>
              <li className="rounded-xl border border-white/10 bg-white/3 px-4 py-3">
                제휴/광고 문의 시 업체명 및 연락처
              </li>
            </ul>
          </section>

        </article>
      </main>
    </div>
  );
}
