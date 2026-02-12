import KakaoMapSection from "./components/KakaoMapSection";

export default function Home() {
  const shopData = [
    {
      id: "shop-1",
      name: "강남 배터리센터",
      address: "서울 강남구 테헤란로 123",
      phone: "02-111-2222",
      lat: 37.5013,
      lng: 127.0396,
      stock: "재고 충분",
      hours: "09:00 - 20:00",
    },
    {
      id: "shop-2",
      name: "인천 항만 배터리 총판",
      address: "인천 미추홀구 한나루로 55",
      phone: "032-333-4444",
      lat: 37.4599,
      lng: 126.6505,
      stock: "AGM 소량",
      hours: "08:30 - 19:30",
    },
    {
      id: "shop-3",
      name: "부산 수입차 배터리랩",
      address: "부산 해운대구 센텀동로 43",
      phone: "051-555-7777",
      lat: 35.1692,
      lng: 129.1322,
      stock: "EFB 당일 가능",
      hours: "09:30 - 20:30",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f4f7fb_45%,#f4f7fb_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-line bg-surface px-5 py-6 shadow-sm sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand">
            BATTERY WHOLESALE PLATFORM
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            차량별 호환 배터리 검색 + 장착점 연동 앱웹
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            수입차부터 국산차까지 모델별 배터리 스펙을 확인하고, 바로 근처
            장착점 재고까지 연결하는 단일 페이지 구조입니다.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold">차량 브랜드</label>
            <select className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
              <option>현대</option>
              <option>기아</option>
              <option>제네시스</option>
              <option>BMW</option>
              <option>벤츠</option>
              <option>아우디</option>
              <option>테슬라</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">모델 / 연식</label>
            <input
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
              placeholder="예: 쏘렌토 2022"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">엔진 / 트림</label>
            <input
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
              placeholder="예: 2.2 디젤 시그니처"
            />
          </div>
          <button className="md:col-span-3 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong">
            호환 배터리 찾기
          </button>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">추천 호환 배터리</h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                실시간 재고 연동 예정
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                {
                  name: "Rocket AGM LN5",
                  spec: "95Ah / 850CCA / AGM",
                  warranty: "24개월",
                  price: "219,000원",
                },
                {
                  name: "Delkor DIN80",
                  spec: "80Ah / 760CCA / EFB",
                  warranty: "18개월",
                  price: "169,000원",
                },
                {
                  name: "AtlasBX Premium 90",
                  spec: "90Ah / 800CCA / MF",
                  warranty: "18개월",
                  price: "179,000원",
                },
              ].map((battery) => (
                <div
                  key={battery.name}
                  className="rounded-xl border border-line bg-white px-4 py-3"
                >
                  <p className="text-sm font-semibold">{battery.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{battery.spec}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>보증 {battery.warranty}</span>
                    <span className="font-semibold text-slate-700">
                      {battery.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-bold">근처 배터리 가게</h2>
            <div className="mt-4 space-y-3">
              {shopData.map((shop) => (
                <div
                  key={shop.id}
                  className="rounded-xl border border-line bg-white px-4 py-3"
                >
                  <p className="text-sm font-semibold">{shop.name}</p>
                  <p className="mt-1 text-xs text-slate-600">{shop.address}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{shop.hours}</span>
                    <span className="font-semibold text-brand">{shop.stock}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{shop.phone}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">카카오맵 장착점 지도</h2>
            <span className="text-xs text-slate-500">
              한국 중심 지도 / 다중 지점 마커
            </span>
          </div>
          <KakaoMapSection shops={shopData} />
        </section>

        <footer className="sticky bottom-4 z-10 rounded-2xl border border-brand/20 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-700">
              최종 장착 전 실차 단자 방향, BCI/DIN 규격, AGM/EFB 요구사항 확인
              필요
            </p>
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-strong">
              지금 장착 문의
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
