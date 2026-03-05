"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname() || "/";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[#060910]">
      <div className="mx-auto w-full max-w-7xl px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 md:pb-8 lg:px-10">
        <div className="flex flex-col gap-6">
          {/* Nav links */}
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-white/70">
            <Link href="/" className="text-brand">배터리핏</Link>
            <span className="text-white/20">|</span>
            <Link href="/about" className="transition hover:text-white">About</Link>
            <span className="text-white/20">|</span>
            <Link href="/contact" className="transition hover:text-white">Contact</Link>
            <span className="text-white/20">|</span>
            <Link href="/privacy-policy" className="transition hover:text-white">Privacy Policy</Link>
          </div>

          {/* Business info */}
          <div className="space-y-1 text-xs leading-5 text-white/40">
            <p>상호: 에스아이 | 대표: 정희수 | 사업자등록번호: 111-63-00101</p>
            <p>통신판매업신고: 2024-안양동안-0010</p>
            <p>주소: 경기도 안양시 동안구 엘에스로116번길91 금정역3차 SKV1센터 지하1층 B104호</p>
            <p>
              이메일:{" "}
              <a href="mailto:nov9306@gmail.com" className="text-white/50 hover:text-white/70">
                nov9306@gmail.com
              </a>
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] leading-4 text-white/25">
            배터리핏은 차량 배터리 호환 조회 및 주변 매장 검색 정보를 제공하는 서비스입니다.
            실제 장착 전에는 차량 사양과 기존 장착 배터리 규격을 반드시 확인하세요.
          </p>

          <p className="text-[11px] text-white/20">
            © {new Date().getFullYear()} BatteryFit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
