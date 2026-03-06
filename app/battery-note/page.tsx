import type { Metadata } from "next";
import SiteNavigation from "@/app/components/SiteNavigation";
import BatteryNoteListPageClient from "@/app/components/BatteryNoteListPageClient";
import { toAbsoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "자동차 배터리 교체 시기·관리법·종류 총정리 - 배터리노트",
  description:
    "자동차 배터리 교체 시기 판단법, AGM·EFB·일반 배터리 차이, 올바른 관리법까지. 차량 배터리에 대해 알아야 할 모든 것을 배터리핏 배터리노트에서 확인하세요.",
  keywords: [
    "자동차 배터리 관리",
    "배터리 교체 시기",
    "AGM 배터리",
    "EFB 배터리",
    "차량 배터리 정보",
    "배터리노트",
  ],
  alternates: {
    canonical: "/battery-note",
  },
};

export default function BatteryNoteListPage() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "배터리핏 배터리노트",
    url: toAbsoluteUrl("/battery-note"),
    description: "자동차 배터리 관리 및 교체 정보를 모아둔 콘텐츠 목록 페이지",
  };

  return (
    <div className="min-h-dvh bg-[#0a0e17] px-3 py-4 text-white/90 sm:px-6 sm:py-7 lg:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <SiteNavigation />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-16 md:pb-8 md:pt-20">
        <section className="space-y-4">
          <BatteryNoteListPageClient />
        </section>
      </main>
    </div>
  );
}
