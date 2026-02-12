"use client";

import { useEffect, useRef, useState } from "react";

export type Shop = {
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

type KakaoMapInstance = {
  setCenter: (latLng: unknown) => void;
};

type KakaoMarkerInstance = {
  setMap: (map: unknown | null) => void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        Map: new (container: HTMLElement, options: unknown) => KakaoMapInstance;
        LatLng: new (lat: number, lng: number) => unknown;
        Marker: new (options: unknown) => KakaoMarkerInstance;
      };
    };
  }
}

export default function KakaoMapSection({ shops }: KakaoMapSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const myMarkerRef = useRef<KakaoMarkerInstance | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [mapErrorMessage, setMapErrorMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (!appKey || shops.length === 0) {
      return;
    }

    let disposed = false;
    const target = mapRef.current;
    if (!target) {
      return;
    }

    const setMapError = (message: string) => {
      if (disposed) {
        return;
      }
      setStatus("error");
      setMapErrorMessage(message);
    };

    const initMap = () => {
      if (!window.kakao?.maps) {
        setMapError(
          "카카오맵 SDK 응답이 올바르지 않습니다. 앱 설정에서 Open Map 서비스와 도메인을 확인해주세요.",
        );
        return;
      }

      const center = new window.kakao.maps.LatLng(shops[0].lat, shops[0].lng);
      const map = new window.kakao.maps.Map(target, {
        center,
        level: 7,
      });
      mapInstanceRef.current = map;

      shops.forEach((shop) => {
        new window.kakao!.maps.Marker({
          map,
          position: new window.kakao!.maps.LatLng(shop.lat, shop.lng),
          title: shop.name,
        });
      });

      setStatus("ready");
      setMapErrorMessage("");
    };

    const loadKakao = () => {
      if (window.kakao?.maps) {
        window.kakao.maps.load(initMap);
      } else {
        setMapError(
          "카카오맵 SDK를 초기화하지 못했습니다. 앱키 권한 또는 허용 도메인을 확인해주세요.",
        );
      }
    };

    const onScriptError = () => {
      setMapError(
        "카카오맵 SDK를 불러오지 못했습니다. 앱키 권한(Open Map)과 허용 도메인 설정을 확인해주세요.",
      );
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-kakao-map-sdk='true']",
    );

    if (existingScript) {
      existingScript.addEventListener("load", loadKakao);
      existingScript.addEventListener("error", onScriptError);
      loadKakao();
      return () => {
        disposed = true;
        existingScript.removeEventListener("load", loadKakao);
        existingScript.removeEventListener("error", onScriptError);
      };
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.addEventListener("load", loadKakao);
    script.addEventListener("error", onScriptError);
    document.head.appendChild(script);

    return () => {
      disposed = true;
      script.removeEventListener("load", loadKakao);
      script.removeEventListener("error", onScriptError);
    };
  }, [appKey, shops]);

  const moveToMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저에서는 위치 조회를 지원하지 않습니다.");
      return;
    }

    if (!window.kakao?.maps || !mapInstanceRef.current) {
      setLocationMessage("지도가 아직 준비되지 않았습니다.");
      return;
    }

    setLocationMessage("현재 위치를 확인하는 중입니다...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const mapInstance = mapInstanceRef.current;
        if (!mapInstance) {
          setLocationMessage("지도가 아직 준비되지 않았습니다.");
          return;
        }

        const myPosition = new window.kakao!.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude,
        );

        if (myMarkerRef.current) {
          myMarkerRef.current.setMap(null);
        }

        const marker = new window.kakao!.maps.Marker({
          map: mapInstance,
          position: myPosition,
          title: "내 위치",
        });
        myMarkerRef.current = marker;
        mapInstance.setCenter(myPosition);
        setLocationMessage("내 위치로 이동했습니다.");
      },
      () => {
        setLocationMessage("위치 권한을 허용하면 내 위치 보기가 가능합니다.");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      },
    );
  };

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

  if (status === "error") {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-sm text-red-700">
        {mapErrorMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div ref={mapRef} className="h-[280px] w-full bg-slate-100 sm:h-[360px]" />
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {status === "ready"
              ? "카카오맵 로딩 완료"
              : "카카오맵 SDK를 불러오는 중..."}
          </span>
          <button
            type="button"
            onClick={moveToMyLocation}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
          >
            내 위치 보기
          </button>
        </div>
        {locationMessage && (
          <p className="mt-2 text-[11px] text-slate-600">{locationMessage}</p>
        )}
      </div>
    </div>
  );
}
