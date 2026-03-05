"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import KakaoStoreSearchSection, { type KakaoPlace } from "@/app/components/KakaoStoreSearchSection";
import SiteNavigation from "@/app/components/SiteNavigation";

type StoreSortMode = "relevance" | "distance";

export default function BatteryMapPageClient() {
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("q")?.trim() ?? "";
  const [mapKeyword, setMapKeyword] = useState(initialKeyword);
  const [mapStoreSortMode, setMapStoreSortMode] = useState<StoreSortMode>("relevance");
  const [realMapResults, setRealMapResults] = useState<KakaoPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMapKeyword(initialKeyword);
  }, [initialKeyword]);

  const handleMarkerClick = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);

    // Scroll the card into view in sidebar
    const card = document.getElementById(`store-card-${placeId}`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Auto-clear highlight after a few seconds
    setTimeout(() => {
      setSelectedPlaceId((prev) => (prev === placeId ? null : prev));
    }, 3000);
  }, []);

  return (
    <div className="min-h-dvh bg-[#0a0e17] text-white/90">
      <SiteNavigation />

      <main className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-14 md:pb-0 md:pt-16">
        <div className="overflow-hidden rounded-2xl border border-white/10 mx-3 mt-3 sm:mx-4 lg:mx-6 lg:mt-4 lg:grid lg:h-[calc(100vh-6rem)] lg:grid-cols-[1fr_380px] xl:mx-10 xl:grid-cols-[1fr_420px]">
          {/* Map area */}
          <div className="relative lg:h-full">
            {/* Search overlay on map */}
            <div className="absolute left-0 right-0 top-0 z-10 p-3 sm:p-4">
              <div className="mx-auto flex max-w-xl items-center gap-2">
                <div className="relative flex-1">
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    value={mapKeyword}
                    onChange={(event) => setMapKeyword(event.target.value)}
                    placeholder="지역명 검색 (예: 강남역, 부평, 병점)"
                    className="w-full rounded-xl border border-white/15 bg-[#0a0e17]/85 py-2.5 pl-9 pr-3 text-sm text-white/90 shadow-lg outline-none backdrop-blur-xl transition placeholder:text-white/35 focus:border-brand/50 focus:ring-1 focus:ring-brand/30"
                  />
                </div>
                <div className="flex overflow-hidden rounded-xl border border-white/15 bg-[#0a0e17]/85 shadow-lg backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => setMapStoreSortMode("relevance")}
                    className={`px-3 py-2.5 text-xs font-semibold transition ${
                      mapStoreSortMode === "relevance"
                        ? "bg-brand text-white"
                        : "text-white/50 hover:text-white/70"
                    }`}
                  >
                    관련도
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapStoreSortMode("distance")}
                    className={`px-3 py-2.5 text-xs font-semibold transition ${
                      mapStoreSortMode === "distance"
                        ? "bg-brand text-white"
                        : "text-white/50 hover:text-white/70"
                    }`}
                  >
                    거리순
                  </button>
                </div>
              </div>
            </div>

            <KakaoStoreSearchSection
              keyword={mapKeyword}
              nearbyOnly
              autoLocate
              forceNearbyBatteryQueries
              sortMode={mapStoreSortMode}
              onResultsChange={setRealMapResults}
              onMarkerClick={handleMarkerClick}
            />
          </div>

          {/* Results sidebar */}
          <div
            ref={sidebarRef}
            className="border-t border-white/10 bg-[#0a0e17] px-3 py-4 sm:px-4 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:px-5 lg:pt-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white/90">주변 매장</h2>
              <span className="rounded-full bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
                {realMapResults.length}
              </span>
            </div>

            {realMapResults.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-white/30" aria-hidden>
                    <path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </div>
                <p className="text-sm text-white/40">
                  위치를 허용하거나 지역명을 검색해
                  <br />
                  주변 배터리 매장을 찾아보세요.
                </p>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {realMapResults.map((place) => (
                  <a
                    key={place.id}
                    id={`store-card-${place.id}`}
                    href={place.place_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group block rounded-xl border p-3.5 transition ${
                      selectedPlaceId === place.id
                        ? "border-brand/50 bg-brand/10 ring-1 ring-brand/30"
                        : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6"
                    }`}
                  >
                    <p className={`text-sm font-semibold transition ${
                      selectedPlaceId === place.id
                        ? "text-brand"
                        : "text-white/90 group-hover:text-brand"
                    }`}>
                      {place.place_name}
                    </p>

                    <div className="mt-2 flex items-start gap-1.5 text-xs text-white/50">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden>
                        <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.274 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                      </svg>
                      <span>{place.road_address_name || place.address_name}</span>
                    </div>

                    {place.phone && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/50">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden>
                          <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                        </svg>
                        <span>{place.phone}</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
