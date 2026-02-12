import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "배터리핏 : 내차에 딱 맞는 배터리 찾기",
  description: "내 차에 딱 맞는 배터리를 찾는 차량 배터리 검색 앱",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
