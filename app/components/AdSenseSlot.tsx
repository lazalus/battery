"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Props = {
  slot?: string;
  className?: string;
  minHeightClassName?: string;
  label?: string;
};

export default function AdSenseSlot({
  slot,
  className = "",
  minHeightClassName = "min-h-[120px]",
  label = "광고",
}: Props) {
  const pushedRef = useRef(false);
  const hasClient = Boolean(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim());
  const normalizedSlot = (slot || "").trim();

  useEffect(() => {
    if (!hasClient || !normalizedSlot || pushedRef.current) {
      return;
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch {
      // AdSense 로드 전/광고 차단기 환경에서는 조용히 실패 처리
    }
  }, [hasClient, normalizedSlot]);

  if (!hasClient) {
    return null;
  }

  if (!normalizedSlot) {
    return (
      <div
        className={`rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 text-center ${minHeightClassName} ${className}`}
      >
        <p className="text-[11px] font-semibold text-slate-500">{label} 슬롯 위치</p>
        <p className="mt-1 text-xs text-slate-400">
          슬롯 ID를 연결하면 AdSense가 이 위치에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-line bg-white px-2 py-2 shadow-sm ${minHeightClassName} ${className}`}
    >
      <div className="px-1 pb-1 text-[10px] font-semibold tracking-[0.06em] text-slate-400">
        {label}
      </div>
      <ins
        className="adsbygoogle block w-full"
        style={{ display: "block" }}
        data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT}
        data-ad-slot={normalizedSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
