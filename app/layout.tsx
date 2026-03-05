import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import SiteFooter from "@/app/components/SiteFooter";
import { getSiteUrl, toAbsoluteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const naverVerification = process.env.NAVER_SITE_VERIFICATION?.trim();
const googleAdsenseClient =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim() || "ca-pub-3287245830922372";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "배터리핏",
  title: {
    default: "배터리핏 : 내차에 딱 맞는 배터리 찾기",
    template: "%s | 배터리핏",
  },
  description:
    "내 차에 맞는 자동차 배터리를 찾고, 주변 배터리 교체 매장까지 검색할 수 있는 차량 배터리 호환 조회 서비스 배터리핏",
  keywords: [
    "배터리핏",
    "자동차 배터리",
    "차량 배터리 호환",
    "자동차 배터리 교체",
    "배터리 규격 조회",
    "배터리 매장 검색",
    "국산차 배터리",
    "수입차 배터리",
    "배터리 호환표",
    "내 차 배터리 찾기",
  ],
  alternates: {
    canonical: "/",
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "배터리핏",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "배터리핏",
    url: "/",
    title: "배터리핏 : 내차에 딱 맞는 배터리 찾기",
    description:
      "차량별 배터리 호환 모델을 찾고, 주변 매장까지 바로 연결되는 배터리 검색 서비스",
    images: [
      {
        url: toAbsoluteUrl("/apple-icon.svg"),
        width: 512,
        height: 512,
        alt: "배터리핏 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "배터리핏 : 내차에 딱 맞는 배터리 찾기",
    description:
      "차량별 배터리 호환 모델과 주변 배터리 매장을 쉽고 빠르게 찾는 배터리핏",
    images: [toAbsoluteUrl("/apple-icon.svg")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    ...(googleVerification ? { google: googleVerification } : {}),
    ...(naverVerification
      ? { other: { "naver-site-verification": naverVerification } }
      : {}),
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    other: [{ rel: "mask-icon", url: "/icon.svg", color: "#0a0e17" }],
  },
  other: {
    ...(googleAdsenseClient ? { "google-adsense-account": googleAdsenseClient } : {}),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "배터리핏",
    alternateName: "BatteryFit",
    url: siteUrl,
    inLanguage: "ko-KR",
    description:
      "내 차에 맞는 자동차 배터리를 찾고, 주변 배터리 교체 매장까지 검색할 수 있는 차량 배터리 호환 조회 서비스",
    publisher: { "@type": "Organization", name: "에스아이" },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "에스아이",
    alternateName: "배터리핏",
    url: siteUrl,
    logo: toAbsoluteUrl("/apple-icon.svg"),
    address: {
      "@type": "PostalAddress",
      addressLocality: "안양시",
      addressRegion: "경기도",
      addressCountry: "KR",
      streetAddress:
        "동안구 엘에스로116번길91 금정역3차 SKV1센터 지하1층 B104호",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: "nov9306@gmail.com",
      contactType: "customer service",
      availableLanguage: "Korean",
    },
  };

  return (
    <html lang="ko">
      <head>
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
          as="style"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
      </head>
      <body className="antialiased">
        {googleAdsenseClient ? (
          <Script
            id="google-adsense"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdsenseClient}`}
          />
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
