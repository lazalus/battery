import type { Metadata } from "next";
import SiteNavigation from "@/app/components/SiteNavigation";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "개인정보처리방침 | 배터리핏",
  description:
    "배터리핏(에스아이) 개인정보처리방침입니다. 개인정보보호법에 따라 수집 항목, 이용 목적, 보유 기간, 정보주체 권리를 안내합니다.",
  alternates: { canonical: "/privacy-policy" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "개인정보처리방침 | 배터리핏",
    description:
      "배터리핏 개인정보처리방침 - 수집 항목, 이용 목적, 보관 기간, 이용자 권리 안내",
    url: "/privacy-policy",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
};

export default function PrivacyPolicyPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "배터리핏", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "개인정보처리방침",
        item: toAbsoluteUrl("/privacy-policy"),
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
          <p className="text-xs font-semibold tracking-[0.12em] text-white/40">PRIVACY POLICY</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white/95">개인정보처리방침</h1>
          <p className="mt-4 text-sm leading-7 text-white/60">
            에스아이(이하 &quot;회사&quot;)은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를
            보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이
            개인정보 처리방침을 수립·공개합니다.
          </p>
          <p className="mt-2 text-xs text-white/30">시행일: 2026년 2월 22일 | 최종 수정: 2026년 3월 5일</p>

          <section className="mt-8 space-y-2">
            <h2 className="text-base font-bold text-white/90">제1조 (개인정보의 처리 목적)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>서비스 제공: 차량 배터리 호환 조회, 매장 지도 검색 등 서비스 제공</li>
                <li>문의 응대: 이용자 문의 접수 및 처리, 고지사항 전달</li>
                <li>서비스 개선: 접속 빈도 파악, 서비스 이용 통계 수집</li>
              </ul>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제2조 (수집하는 개인정보의 항목)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <ul className="list-disc pl-5 space-y-1">
                <li>자동 수집 항목: 접속 로그(IP 주소, 접속 시간), 브라우저 및 기기 정보, 서비스 이용 기록</li>
                <li>위치 기반 기능 이용 시: 브라우저에서 허용한 현재 위치 정보(위도/경도) - 매장 검색 기능 제공 목적에 한하여 일시적으로 사용되며, 별도 저장하지 않음</li>
                <li>문의 접수 시: 이메일 주소, 문의 내용</li>
              </ul>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>
                회사는 법령에 따른 개인정보 보유·이용 기간 또는 정보주체로부터 개인정보를 수집 시에
                동의받은 개인정보 보유·이용 기간 내에서 개인정보를 처리·보유합니다.
              </p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>서비스 이용 기록: 서비스 제공 목적 달성 시까지</li>
                <li>문의 접수 기록: 문의 처리 완료 후 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
                <li>접속 로그: 3개월 (통신비밀보호법)</li>
              </ul>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제4조 (개인정보의 제3자 제공)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>
                회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만
                처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및
                제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제5조 (외부 서비스 이용)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>서비스는 다음과 같은 외부 서비스를 이용합니다.</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>카카오맵 API: 매장 지도 표시 및 장소 검색</li>
                <li>Cloudflare: 서비스 호스팅 및 CDN</li>
                <li>쿠팡 파트너스: 제휴 상품 링크 제공 (구매 발생 시 수수료 수령, 이용자 구매가격 변동 없음)</li>
              </ul>
              <p className="mt-2">
                이용자가 외부 링크를 통해 이동한 이후의 개인정보 처리에 대해서는 각 외부 서비스의
                개인정보처리방침이 적용됩니다.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제6조 (정보주체의 권리·의무 및 행사 방법)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>개인정보 처리에 관한 정보를 제공받을 권리</li>
                <li>개인정보 처리에 관한 동의 여부 및 동의 범위 등을 선택하고 결정할 권리</li>
                <li>개인정보의 처리 여부를 확인하고 개인정보에 대하여 열람을 요구할 권리</li>
                <li>개인정보의 처리 정지, 정정·삭제 및 파기를 요구할 권리</li>
                <li>개인정보의 처리로 인하여 발생한 피해를 신속하고 공정한 절차에 따라 구제받을 권리</li>
              </ul>
              <p className="mt-2">
                권리 행사는 서면, 전화, 전자우편 등을 통하여 하실 수 있으며, 회사는 이에 대해 지체 없이
                조치하겠습니다.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제7조 (개인정보 보호 책임자)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-6 text-white/60">
              <p>성명: 정희수</p>
              <p>직책: 대표</p>
              <p>
                이메일:{" "}
                <a href="mailto:nov9306@gmail.com" className="text-brand hover:underline">
                  nov9306@gmail.com
                </a>
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-2">
            <h2 className="text-base font-bold text-white/90">제8조 (개인정보처리방침 변경)</h2>
            <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-white/60">
              <p>
                이 개인정보처리방침은 2026년 2월 22일부터 적용됩니다. 법령 및 방침에 따른 변경 내용의
                추가, 삭제 및 정정이 있는 경우에는 변경 사항의 시행 7일 전부터 서비스 내 공지사항을
                통하여 고지할 것입니다.
              </p>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
