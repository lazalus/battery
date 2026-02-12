"use client";

import { useEffect, useRef, useState } from "react";

type Shop = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  stock: string;
  hours: string;
};

type KakaoMapSectionProps = {
  shops: Shop[];
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: unknown) => unknown;
        LatLng: new (lat: number, lng: number) => unknown;
        Marker: new (options: unknown) => unknown;
      };
    };
  }
}

export default function KakaoMapSection({ shops }: KakaoMapSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "ready">("idle");
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (!appKey || shops.length === 0) {
      return;
    }

    const target = mapRef.current;
    if (!target) {
      return;
    }

    const initMap = () => {
      if (!window.kakao?.maps) {
        return;
      }

      const center = new window.kakao.maps.LatLng(shops[0].lat, shops[0].lng);
      const map = new window.kakao.maps.Map(target, {
        center,
        level: 7,
      });

      shops.forEach((shop) => {
        new window.kakao!.maps.Marker({
          map,
          position: new window.kakao!.maps.LatLng(shop.lat, shop.lng),
          title: shop.name,
        });
      });

      setStatus("ready");
    };

    const loadKakao = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(initMap);
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-kakao-map-sdk='true']",
    );

    if (existingScript) {
      existingScript.addEventListener("load", loadKakao);
      loadKakao();
      return () => existingScript.removeEventListener("load", loadKakao);
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.addEventListener("load", loadKakao);
    document.head.appendChild(script);

    return () => script.removeEventListener("load", loadKakao);
  }, [appKey, shops]);

  if (!appKey) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-sm text-red-700">
        `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` 값을 `.env.local`에 설정하면 지도가
        표시됩니다.
      </div>
    );
  }

  if (shops.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-700">
        지도에 표시할 매장 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div ref={mapRef} className="h-[360px] w-full bg-slate-100" />
      <div className="border-t border-line px-4 py-3 text-xs text-slate-500">
        {status === "ready"
          ? "카카오맵 로딩 완료"
          : "카카오맵 SDK를 불러오는 중..."}
      </div>
    </div>
  );
}
