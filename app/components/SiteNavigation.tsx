"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "배터리 찾기",
    mobileLabel: "홈",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M3 10.5L12 3l9 7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6 9.5V20h12V9.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/battery-map",
    label: "매장 지도",
    mobileLabel: "매장지도",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1116 0z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

function isCurrentPath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNavigation() {
  const pathname = usePathname() || "/";

  return (
    <>
      {/* Desktop top nav */}
      <header className="absolute left-0 right-0 top-0 z-30 hidden md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-white/90 transition hover:text-white">
            BATTERYFIT
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-xl" aria-label="주요 메뉴">
            {NAV_ITEMS.map((item) => {
              const active = isCurrentPath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white/90"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a0e17]/90 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden"
        aria-label="하단 메뉴"
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isCurrentPath(pathname, item.href);
            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 text-[10px] font-medium transition ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {item.icon}
                <span className="max-w-full truncate whitespace-nowrap leading-none tracking-tight">
                  {item.mobileLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
