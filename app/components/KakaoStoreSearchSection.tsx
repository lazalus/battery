"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type KakaoPlace = {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_code?: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
};

type KakaoStoreSearchSectionProps = {
  keyword: string;
  region?: string;
  onResultsChange: (places: KakaoPlace[]) => void;
  nearbyOnly?: boolean;
  autoLocate?: boolean;
  forceNearbyBatteryQueries?: boolean;
  sortMode?: "relevance" | "distance";
};

type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

type KakaoMapInstance = {
  setCenter: (latLng: unknown) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: unknown) => void;
  getCenter?: () => KakaoLatLng;
  relayout?: () => void;
};

type KakaoMarkerInstance = {
  setMap: (map: unknown | null) => void;
};

type KakaoPlacesService = {
  keywordSearch: (
    keyword: string,
    callback: (data: KakaoPlace[], status: string) => void,
    options?: unknown,
  ) => void;
};

type KakaoStatus = {
  OK: string;
};

type KakaoLatLngBounds = {
  extend: (latLng: unknown) => void;
};

type KakaoRuntime = {
  maps: {
    load: (callback: () => void) => void;
    Map: new (container: HTMLElement, options: unknown) => KakaoMapInstance;
    LatLng: new (lat: number, lng: number) => unknown;
    LatLngBounds: new () => KakaoLatLngBounds;
    Marker: new (options: unknown) => KakaoMarkerInstance;
    event?: {
      trigger: (target: unknown, type: string) => void;
      addListener?: (target: unknown, type: string, handler: () => void) => void;
      removeListener?: (
        target: unknown,
        type: string,
        handler: () => void,
      ) => void;
    };
    services: {
      Places: new () => KakaoPlacesService;
      Status: KakaoStatus;
    };
  };
};

const REGION_CENTER: Record<string, { lat: number; lng: number }> = {
  내주변: { lat: 37.5665, lng: 126.978 },
  전국: { lat: 36.5, lng: 127.9 },
  서울: { lat: 37.5665, lng: 126.978 },
  경기: { lat: 37.4138, lng: 127.5183 },
  인천: { lat: 37.4563, lng: 126.7052 },
  부산: { lat: 35.1796, lng: 129.0756 },
  대구: { lat: 35.8714, lng: 128.6014 },
};
const LAST_LOCATION_STORAGE_KEY = "battery-last-location";

const getKakaoRuntime = () =>
  (window as Window & { kakao?: unknown }).kakao as KakaoRuntime | undefined;

const POSITIVE_KEYWORDS = [
  "배터리",
  "밧데리",
  "전지",
  "로케트",
  "델코",
  "아트라스",
  "아틀라스",
  "한국배터리",
  "쏠라이트",
  "교체",
  "출장",
];

const NEGATIVE_KEYWORDS = [
  "휴대폰",
  "스마트폰",
  "보조배터리",
  "노트북",
  "충전기",
  "건전지",
  "카페",
  "편의점",
  "마트",
];

const AUTO_RELATED_KEYWORDS = [
  "자동차",
  "카센터",
  "정비",
  "타이어",
  "모터스",
  "공업사",
];

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function buildSearchQueries(baseKeyword: string) {
  const normalized = normalizeSearchText(baseKeyword) || "자동차 배터리";
  const stripped = normalized
    .replace(/자동차/g, "")
    .replace(/배터리/g, "")
    .replace(/밧데리/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const queries = new Set<string>();
  queries.add(normalized);
  queries.add("자동차 배터리");
  queries.add("자동차 배터리 교체");

  if (stripped.length > 0) {
    queries.add(`${stripped} 자동차 배터리`);
    queries.add(`${stripped} 배터리 교체`);
  }

  return [...queries].slice(0, 4);
}

function extractLocationHintFromKeyword(rawKeyword: string) {
  const normalized = rawKeyword
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/자동차/g, "")
    .replace(/배터리/g, "")
    .replace(/밧데리/g, "")
    .replace(/교체/g, "")
    .replace(/매장/g, "")
    .replace(/업체/g, "")
    .replace(/카센터/g, "")
    .replace(/정비/g, "")
    .replace(/가게/g, "")
    .replace(/검색/g, "");

  if (normalized.length < 2 || !/[가-힣]/.test(normalized)) {
    return "";
  }

  return normalized;
}

function scorePlace(place: KakaoPlace, rawKeyword: string) {
  const name = normalizeSearchText(place.place_name ?? "");
  const category = normalizeSearchText(place.category_name ?? "");
  const roadAddress = normalizeSearchText(place.road_address_name ?? "");
  const address = normalizeSearchText(place.address_name ?? "");
  const source = `${name} ${category} ${roadAddress} ${address}`;

  let score = 0;

  if (containsAnyKeyword(source, POSITIVE_KEYWORDS)) {
    score += 40;
  }
  if (containsAnyKeyword(source, AUTO_RELATED_KEYWORDS)) {
    score += 18;
  }
  if (containsAnyKeyword(source, NEGATIVE_KEYWORDS)) {
    score -= 45;
  }

  const keywordTokens = normalizeSearchText(rawKeyword)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const matchedTokens = keywordTokens.filter((token) => source.includes(token));
  score += matchedTokens.length * 8;

  if (place.phone && place.phone.trim().length >= 8) {
    score += 6;
  }
  if (place.road_address_name && place.road_address_name.trim().length > 0) {
    score += 4;
  }

  return score;
}

function distanceInMeters(
  baseLat: number,
  baseLng: number,
  targetLat: number,
  targetLng: number,
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(targetLat - baseLat);
  const dLng = toRad(targetLng - baseLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(baseLat)) *
      Math.cos(toRad(targetLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function readSavedLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  } catch {
    return null;
  }
}

export default function KakaoStoreSearchSection({
  keyword,
  region = "내주변",
  onResultsChange,
  nearbyOnly = false,
  autoLocate = false,
  forceNearbyBatteryQueries = false,
  sortMode = "relevance",
}: KakaoStoreSearchSectionProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMapInstance | null>(null);
  const placesRef = useRef<KakaoPlacesService | null>(null);
  const markersRef = useRef<KakaoMarkerInstance[]>([]);
  const myMarkerRef = useRef<KakaoMarkerInstance | null>(null);
  const lastAutoLocatedRef = useRef(false);
  const lastKeywordCenterRef = useRef("");
  const [status, setStatus] = useState<"idle" | "ready" | "searching" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [searchCenter, setSearchCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const suppressMapMovedRef = useRef(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
  const isUsingMyLocation = nearbyOnly && Boolean(searchCenter);

  const relayoutMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    const kakao = getKakaoRuntime();
    map.relayout?.();
    if (kakao?.maps?.event) {
      kakao.maps.event.trigger(map, "resize");
    }
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
  }, []);

  const applyResultsToMap = useCallback(
    (places: KakaoPlace[]) => {
      const kakao = getKakaoRuntime();
      const map = mapInstanceRef.current;
      if (!map || !kakao?.maps) {
        return;
      }

      clearMarkers();
      if (places.length === 0) {
        onResultsChange([]);
        return;
      }

      relayoutMap();

      const bounds = new kakao.maps.LatLngBounds();
      for (const place of places) {
        const lat = Number(place.y);
        const lng = Number(place.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          continue;
        }

        const position = new kakao.maps.LatLng(lat, lng);
        const marker = new kakao.maps.Marker({
          map,
          position,
          title: place.place_name,
        });
        markersRef.current.push(marker);
        bounds.extend(position);
      }

      if (markersRef.current.length > 0 && !nearbyOnly) {
        map.setBounds(bounds);
        window.setTimeout(() => {
          map.relayout?.();
          map.setBounds(bounds);
        }, 120);
      }

      onResultsChange(places);
    },
    [clearMarkers, onResultsChange, relayoutMap, nearbyOnly],
  );

  useEffect(() => {
    if (!appKey) {
      return;
    }

    let disposed = false;

    const onFail = (message: string) => {
      if (disposed) {
        return;
      }
      setStatus("error");
      setErrorMessage(message);
      onResultsChange([]);
    };

    const initMap = () => {
      const target = mapRef.current;
      if (!target) {
        return;
      }

      // 탭 전환 직후에는 컨테이너 크기가 0일 수 있어, 준비될 때까지 재시도한다.
      const width = target.clientWidth;
      const height = target.clientHeight;
      if (width === 0 || height === 0) {
        window.setTimeout(() => {
          if (!disposed) {
            initMap();
          }
        }, 120);
        return;
      }

      const kakao = getKakaoRuntime();
      if (!kakao?.maps?.services) {
        onFail(
          "카카오맵 서비스 로드 실패: 앱 키 권한(Open Map)과 허용 도메인을 확인해주세요.",
        );
        return;
      }

      const savedLocation = nearbyOnly ? readSavedLocation() : null;
      const center = savedLocation ?? REGION_CENTER.전국;
      const map = new kakao.maps.Map(target, {
        center: new kakao.maps.LatLng(center.lat, center.lng),
        level: nearbyOnly ? 4 : 6,
      });
      mapInstanceRef.current = map;
      placesRef.current = new kakao.maps.services.Places();
      if (savedLocation) {
        setSearchCenter(savedLocation);
        setLocationMessage("최근 현재 위치 기준으로 주변 매장을 표시합니다.");
      }
      window.setTimeout(() => {
        relayoutMap();
      }, 0);
      window.setTimeout(() => {
        relayoutMap();
      }, 220);
      setStatus("ready");
      setErrorMessage("");
    };

    const loadKakao = (retry = 0) => {
      if (disposed) {
        return;
      }
      const kakao = getKakaoRuntime();
      if (kakao?.maps) {
        kakao.maps.load(initMap);
      } else if (retry < 12) {
        window.setTimeout(() => {
          loadKakao(retry + 1);
        }, 120);
      } else {
        onFail("카카오맵 SDK를 초기화하지 못했습니다.");
      }
    };

    const onScriptError = () => {
      onFail("카카오맵 SDK를 불러오지 못했습니다.");
    };
    const onScriptLoad = () => {
      loadKakao();
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-kakao-map-sdk='true']",
    );
    if (existingScript) {
      existingScript.addEventListener("load", onScriptLoad);
      existingScript.addEventListener("error", onScriptError);
      if (getKakaoRuntime()?.maps) {
        loadKakao();
      }

      return () => {
        disposed = true;
        existingScript.removeEventListener("load", onScriptLoad);
        existingScript.removeEventListener("error", onScriptError);
      };
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.addEventListener("load", onScriptLoad);
    script.addEventListener("error", onScriptError);
    document.head.appendChild(script);

    return () => {
      disposed = true;
      script.removeEventListener("load", onScriptLoad);
      script.removeEventListener("error", onScriptError);
    };
  }, [appKey, onResultsChange, nearbyOnly, relayoutMap]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakao = getKakaoRuntime();

    if (!map || !kakao?.maps?.LatLng) {
      return;
    }

    if (nearbyOnly && searchCenter) {
      return;
    }

    const center = REGION_CENTER[region] ?? REGION_CENTER.전국;
    map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
    map.setLevel(nearbyOnly ? 4 : 6);
    relayoutMap();
  }, [region, nearbyOnly, searchCenter, relayoutMap]);

  useEffect(() => {
    if (nearbyOnly) {
      return;
    }

    if (myMarkerRef.current) {
      myMarkerRef.current.setMap(null);
      myMarkerRef.current = null;
    }
  }, [nearbyOnly]);

  useEffect(() => {
    const onResize = () => {
      relayoutMap();
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [relayoutMap]);

  useEffect(() => {
    if (!nearbyOnly) {
      return;
    }

    const map = mapInstanceRef.current;
    const runtime = getKakaoRuntime();
    const event = runtime?.maps?.event;
    if (!map || !event?.addListener) {
      return;
    }

    const onMoved = () => {
      if (suppressMapMovedRef.current) {
        return;
      }
      const center = map.getCenter?.();
      const lat = Number(center?.getLat?.());
      const lng = Number(center?.getLng?.());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      setSearchCenter((prev) => {
        if (prev && Math.abs(prev.lat - lat) < 0.00001 && Math.abs(prev.lng - lng) < 0.00001) {
          return prev;
        }
        return { lat, lng };
      });
      setLocationMessage("현재 지도 중심 기준으로 주변 배터리 매장을 다시 검색합니다.");
    };

    event.addListener(map, "dragend", onMoved);
    event.addListener(map, "zoom_changed", onMoved);

    return () => {
      if (event.removeListener) {
        event.removeListener(map, "dragend", onMoved);
        event.removeListener(map, "zoom_changed", onMoved);
      }
    };
  }, [nearbyOnly]);

  const moveToMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationMessage("이 브라우저에서는 위치 조회를 지원하지 않습니다.");
      return;
    }

    if (!window.isSecureContext) {
      setLocationMessage("내 위치는 HTTPS 환경에서만 조회할 수 있습니다.");
      return;
    }

    const map = mapInstanceRef.current;
    const kakao = getKakaoRuntime();
    if (!map || !kakao?.maps) {
      setLocationMessage("지도가 아직 준비되지 않았습니다.");
      return;
    }

    setLocationMessage("현재 위치를 확인하는 중입니다...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const runtime = getKakaoRuntime();
        const mapInstance = mapInstanceRef.current;
        if (!runtime?.maps || !mapInstance) {
          setLocationMessage("지도가 아직 준비되지 않았습니다.");
          return;
        }

        const myPosition = new runtime.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude,
        );

        if (myMarkerRef.current) {
          myMarkerRef.current.setMap(null);
        }

        const marker = new runtime.maps.Marker({
          map: mapInstance,
          position: myPosition,
          title: "내 위치",
        });
        myMarkerRef.current = marker;
        suppressMapMovedRef.current = true;
        mapInstance.relayout?.();
        mapInstance.setCenter(myPosition);
        mapInstance.setLevel(4);
        window.setTimeout(() => {
          suppressMapMovedRef.current = false;
        }, 450);
        setSearchCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        try {
          window.localStorage.setItem(
            LAST_LOCATION_STORAGE_KEY,
            JSON.stringify({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              updatedAt: Date.now(),
            }),
          );
        } catch {
          // ignore
        }

        // Safari 환경에서 위치 권한 팝업 이후 지도 타일이 비는 케이스를 강제로 재렌더링.
        const forceRefresh = () => {
          const activeRuntime = getKakaoRuntime();
          const activeMap = mapInstanceRef.current;
          if (!activeRuntime?.maps || !activeMap) {
            return;
          }
          const center = new activeRuntime.maps.LatLng(
            position.coords.latitude,
            position.coords.longitude,
          );
          activeMap.relayout?.();
          activeRuntime.maps.event?.trigger(activeMap, "resize");
          activeMap.setCenter(center);
          activeMap.setLevel(4);
        };
        window.setTimeout(forceRefresh, 0);
        window.setTimeout(forceRefresh, 180);
        window.setTimeout(forceRefresh, 420);

        setLocationMessage(
          "위치 확인 완료. 현재 위치 기준으로 주변 배터리 매장을 다시 검색합니다.",
        );
      },
      (error: GeolocationPositionError) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage(
            "위치 권한이 차단되어 있습니다. 브라우저 설정에서 위치를 허용해주세요.",
          );
          return;
        }
        if (error.code === error.TIMEOUT) {
          setLocationMessage(
            "위치 조회 시간이 초과되었습니다. 네트워크 상태에서 다시 시도해주세요.",
          );
          return;
        }
        setLocationMessage(
          "현재 위치를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, []);

  useEffect(() => {
    if (
      !nearbyOnly ||
      !autoLocate ||
      status !== "ready" ||
      lastAutoLocatedRef.current ||
      searchCenter
    ) {
      return;
    }

    lastAutoLocatedRef.current = true;
    const timer = window.setTimeout(() => {
      moveToMyLocation();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [nearbyOnly, autoLocate, status, moveToMyLocation, searchCenter]);

  useEffect(() => {
    const trimmedKeyword = keyword.trim();
    if (!nearbyOnly || status !== "ready" || trimmedKeyword.length < 2) {
      return;
    }

    if (lastKeywordCenterRef.current === trimmedKeyword) {
      return;
    }

    const kakao = getKakaoRuntime();
    const placesService = placesRef.current;
    const map = mapInstanceRef.current;
    if (!kakao?.maps?.LatLng || !placesService || !map) {
      return;
    }

    let cancelled = false;
    const locationHint = extractLocationHintFromKeyword(trimmedKeyword);
    if (!locationHint) {
      return;
    }
    const targetQuery = locationHint;

    placesService.keywordSearch(
      targetQuery,
      (data, callbackStatus) => {
        if (cancelled) {
          return;
        }

        if (
          callbackStatus !== kakao.maps.services.Status.OK ||
          !Array.isArray(data) ||
          data.length === 0
        ) {
          return;
        }

        const target = data.find((item) => Number.isFinite(Number(item.y)) && Number.isFinite(Number(item.x)));
        if (!target) {
          return;
        }

        const lat = Number(target.y);
        const lng = Number(target.x);
        suppressMapMovedRef.current = true;
        map.setCenter(new kakao.maps.LatLng(lat, lng));
        map.setLevel(4);
        window.setTimeout(() => {
          suppressMapMovedRef.current = false;
        }, 450);

        setSearchCenter({ lat, lng });
        setLocationMessage(
          `${locationHint} 주변으로 이동해 매장을 검색합니다.`,
        );
        lastKeywordCenterRef.current = trimmedKeyword;
      },
      { size: 5 },
    );

    return () => {
      cancelled = true;
    };
  }, [keyword, nearbyOnly, status]);

  useEffect(() => {
    const kakao = getKakaoRuntime();
    const placesService = placesRef.current;
    const map = mapInstanceRef.current;

    if (!placesService || !map || !kakao?.maps?.services) {
      return;
    }

    let cancelled = false;
    const searchingTimer = setTimeout(() => {
      if (!cancelled) {
        setStatus("searching");
      }
    }, 0);

    const searchOnce = (
      query: string,
      lat: number,
      lng: number,
      radius = 15000,
    ) =>
      new Promise<KakaoPlace[]>((resolve) => {
        placesService.keywordSearch(
          query,
          (data, callbackStatus) => {
            if (
              callbackStatus === kakao.maps.services.Status.OK &&
              Array.isArray(data)
            ) {
              resolve(data);
              return;
            }
            resolve([]);
          },
          {
            location: new kakao.maps.LatLng(lat, lng),
            radius,
            size: 15,
          },
        );
      });

    const run = async () => {
      if (nearbyOnly && !searchCenter) {
        setStatus("ready");
        relayoutMap();
        setLocationMessage((prev) =>
          prev.length > 0
            ? prev
            : "위치 권한을 허용하면 현재 위치 주변 배터리 매장을 검색합니다.",
        );
        applyResultsToMap([]);
        return;
      }

      const baseKeyword = keyword.trim().length > 0 ? keyword.trim() : "자동차 배터리";
      const queryVariants =
        nearbyOnly && forceNearbyBatteryQueries
          ? ["자동차 배터리", "배터리 교체", "카센터", "자동차 정비", "자동차 전기"]
          : buildSearchQueries(baseKeyword);
      const shouldUseMyLocationRanking = nearbyOnly && Boolean(searchCenter);

      const merged = new Map<
        string,
        { place: KakaoPlace; score: number; hits: number; distance: number | null }
      >();

      if (nearbyOnly && searchCenter) {
        const center = searchCenter;
        const nearbyRadii = [5000];
        const nearbyQueries = [
          ...new Set([
            ...queryVariants,
            "자동차 배터리",
            "배터리 교체",
            "카센터",
            "자동차 정비",
          ]),
        ];

        for (const radius of nearbyRadii) {
          for (const query of nearbyQueries) {
            const result = await searchOnce(query, center.lat, center.lng, radius);
            for (const place of result) {
              const key = place.id || place.place_url || `${place.place_name}:${place.x}:${place.y}`;
              const score = scorePlace(place, query);
              const placeLat = Number(place.y);
              const placeLng = Number(place.x);
              const distance =
                Number.isFinite(placeLat) && Number.isFinite(placeLng)
                  ? distanceInMeters(center.lat, center.lng, placeLat, placeLng)
                  : null;
              const current = merged.get(key);
              if (!current) {
                merged.set(key, { place, score, hits: 1, distance });
              } else {
                current.score = Math.max(current.score, score);
                current.hits += 1;
                if (distance !== null) {
                  current.distance =
                    current.distance === null ? distance : Math.min(current.distance, distance);
                }
              }
            }
          }
        }
      } else if (region === "전국") {
        const targets = ["서울", "경기", "인천", "부산", "대구"];

        for (const target of targets) {
          const center = REGION_CENTER[target];
          for (const query of queryVariants) {
            const result = await searchOnce(`${target} ${query}`, center.lat, center.lng);
            for (const place of result) {
              const key = place.id || place.place_url || `${place.place_name}:${place.x}:${place.y}`;
              const score = scorePlace(place, query);
              const current = merged.get(key);
              if (!current) {
                merged.set(key, { place, score, hits: 1, distance: null });
              } else {
                current.score = Math.max(current.score, score);
                current.hits += 1;
              }
            }
          }
        }
      } else {
        const center = REGION_CENTER[region] ?? REGION_CENTER.전국;
        for (const query of queryVariants) {
          const result = await searchOnce(`${region} ${query}`, center.lat, center.lng);
          for (const place of result) {
            const key = place.id || place.place_url || `${place.place_name}:${place.x}:${place.y}`;
            const score = scorePlace(place, query);
            const current = merged.get(key);
            if (!current) {
              merged.set(key, { place, score, hits: 1, distance: null });
            } else {
              current.score = Math.max(current.score, score);
              current.hits += 1;
            }
          }
        }
      }

      let rankedPlaces = [...merged.values()]
        .sort((a, b) => {
          if (shouldUseMyLocationRanking && sortMode === "distance") {
            if (a.distance !== null && b.distance !== null && a.distance !== b.distance) {
              return a.distance - b.distance;
            }
            if (a.distance === null && b.distance !== null) {
              return 1;
            }
            if (a.distance !== null && b.distance === null) {
              return -1;
            }
          }
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          if (
            shouldUseMyLocationRanking &&
            a.distance !== null &&
            b.distance !== null
          ) {
            if (a.distance !== b.distance) {
              return a.distance - b.distance;
            }
          }
          return b.hits - a.hits;
        })
        .filter((item) => item.score >= 8)
        .slice(0, 40)
        .map((item) => item.place);

      // 결과가 너무 적게 걸러졌으면 상위 후보를 유지해서 빈 지도 체감을 줄인다.
      if (rankedPlaces.length === 0) {
        rankedPlaces = [...merged.values()]
          .sort((a, b) => {
            if (shouldUseMyLocationRanking && sortMode === "distance") {
              if (a.distance !== null && b.distance !== null && a.distance !== b.distance) {
                return a.distance - b.distance;
              }
              if (a.distance === null && b.distance !== null) {
                return 1;
              }
              if (a.distance !== null && b.distance === null) {
                return -1;
              }
            }
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            if (
              shouldUseMyLocationRanking &&
              a.distance !== null &&
              b.distance !== null
            ) {
              return a.distance - b.distance;
            }
            return b.hits - a.hits;
          })
          .slice(0, 20)
          .map((item) => item.place);
      }

      if (cancelled) {
        return;
      }

      setStatus("ready");
      applyResultsToMap(rankedPlaces);
    };

    run().catch(() => {
      if (!cancelled) {
        setStatus("error");
        setErrorMessage("매장 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        onResultsChange([]);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(searchingTimer);
    };
  }, [
    keyword,
    region,
    onResultsChange,
    applyResultsToMap,
    searchCenter,
    nearbyOnly,
    forceNearbyBatteryQueries,
    sortMode,
    relayoutMap,
  ]);

  if (!appKey) {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-sm text-red-700">
        `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` 값을 `.env.local`에 설정해주세요.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="relative">
        <div
          ref={mapRef}
          className="h-[44vh] max-h-[520px] min-h-[300px] w-full bg-slate-100 sm:h-[380px]"
          style={{ minHeight: 300 }}
        />
      </div>
      <div className="border-t border-line px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
          <span className="leading-relaxed">
            {status === "searching"
              ? isUsingMyLocation
                ? "현재 지도 중심 기준 주변 매장 검색 중..."
                : "실매장 검색 중..."
              : isUsingMyLocation
                ? "현재 지도 중심 기준 주변 배터리 매장 결과입니다."
                : nearbyOnly
                  ? "위치 권한을 허용하면 현재 위치 주변 배터리 매장을 표시합니다."
                  : "카카오 지도 기반 실매장 결과를 표시합니다."}
          </span>
          <button
            type="button"
            onClick={moveToMyLocation}
            aria-label="현재 위치로 이동"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-9 sm:w-9"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 3.5v3M12 17.5v3M20.5 12h-3M6.5 12h-3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {nearbyOnly && locationMessage && (
          <p className="mt-2 text-[11px] text-slate-600">{locationMessage}</p>
        )}
      </div>
    </div>
  );
}
