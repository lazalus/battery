"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SiteNavigation from "./SiteNavigation";
import vehicleCatalog from "@/data/vehicle-catalog.json";

type OriginType = "국산차" | "수입차";

type BatteryProduct = {
  id: string;
  name: string;
  brand: string;
  origin: "rocket" | "delkor" | "hankook" | "varta" | "equivalent";
  spec: string;
  productCode?: string;
  productUrl: string;
  imageUrl?: string;
  note?: string;
};

type CatalogBrand = (typeof vehicleCatalog.brands)[number];
type CatalogModel = CatalogBrand["models"][number];
type CatalogTrim = CatalogModel["trims"][number];

type FuelType = "가솔린" | "디젤" | "LPG" | "하이브리드" | "전기" | "기타";

type ParsedTrim = {
  id: string;
  fullName: string;
  yearLabel: string;
  engineLabel: string;
  fuelType: FuelType;
  startYear: number;
};

type BatteryBadge = {
  label: "정규격" | "여유 용량" | "타입 확인";
  badgeClassName: string;
  detail: string;
};

function detectFuelType(label: string): FuelType {
  const text = label.toUpperCase().replace(/\s+/g, "");
  if (text.includes("하이브리드") || text.includes("HYBRID") || text.includes("HEV")) return "하이브리드";
  if (text.includes("전기") || text.includes("EV")) return "전기";
  if (text.includes("디젤") || text.includes("DIESEL")) return "디젤";
  if (text.includes("LPG") || text.includes("엘피지")) return "LPG";
  if (text.includes("가솔린") || text.includes("터보") || text.includes("GDI") || text.includes("휘발유")) return "가솔린";
  return "기타";
}

function parseStartYear(yearLabel: string): number {
  const match = yearLabel.match(/(\d{2,4})/);
  if (!match) return 9999;
  const num = Number(match[1]);
  if (num >= 80 && num <= 99) return 1900 + num;
  if (num >= 0 && num <= 50) return 2000 + num;
  return num;
}

function parseTrim(trim: CatalogTrim): ParsedTrim {
  const raw = trim.name.trim();
  const yearMatch = raw.match(/\(([^)]+)\)\s*$/);
  const yearLabel = yearMatch ? yearMatch[1].trim() : "연식 미기재";
  const engineLabel = yearMatch
    ? raw.replace(/\s*\([^)]+\)\s*$/, "").trim()
    : raw;
  return {
    id: String(trim.id),
    fullName: raw,
    yearLabel,
    engineLabel,
    fuelType: detectFuelType(engineLabel),
    startYear: parseStartYear(yearLabel),
  };
}

const CATALOG_BRANDS = vehicleCatalog.brands as CatalogBrand[];
const ORIGIN_OPTIONS: OriginType[] = ["국산차", "수입차"];

const BRAND_PRIORITY_BY_ORIGIN: Record<OriginType, string[]> = {
  국산차: ["현대자동차", "기아자동차", "제네시스", "쉐보레/GM", "르노삼성", "쌍용자동차"],
  수입차: ["벤츠", "BMW", "아우디", "폭스바겐", "볼보", "렉서스", "도요타", "혼다", "포드", "지프", "랜드로버", "미니", "닛산", "푸조", "캐딜락", "인피니티", "재규어", "링컨", "크라이슬러"],
};

const BRAND_LOGO_MAP: Record<string, string> = {
  로케트: "/brand-logos/rocket-official-v2.png",
  델코: "/brand-logos/delkor.svg",
  한국배터리: "/brand-logos/hankook-official-v2.jpg",
  VARTA: "/brand-logos/varta-official.png",
  "한국배터리(아트라스)": "/brand-logos/hankook-official-v2.jpg",
  아트라스BX: "/brand-logos/hankook-official-v2.jpg",
  아트라스비엑스: "/brand-logos/hankook-official-v2.jpg",
  쏠라이트: "/brand-logos/solite.png",
};
const DEFAULT_BRAND_LOGO = "/brand-logos/generic.svg";
const BRAND_LOGO_SCALE_CLASS_MAP: Record<string, string> = {
  로케트: "scale-100",
  델코: "scale-105",
  한국배터리: "scale-[2.1] -translate-y-1",
  VARTA: "scale-105",
  "한국배터리(아트라스)": "scale-[2.1] -translate-y-1",
  아트라스BX: "scale-[2.1] -translate-y-1",
  아트라스비엑스: "scale-[2.1] -translate-y-1",
  쏠라이트: "scale-105",
};

function getBrandLogo(brand: string) {
  return BRAND_LOGO_MAP[brand] ?? DEFAULT_BRAND_LOGO;
}
function getBrandLogoScaleClass(brand: string) {
  return BRAND_LOGO_SCALE_CLASS_MAP[brand] ?? "scale-100";
}

function getBatteryDisplayName(battery: BatteryProduct) {
  if (battery.productCode) return `${battery.brand} ${battery.productCode}`;
  return battery.name.replace(/\s+/g, " ").trim();
}

function getBatteryPurchaseKeyword(battery: BatteryProduct) {
  const code = (battery.productCode ?? "").trim();
  if (code) return `${battery.brand} ${code}`.replace(/\s+/g, " ").trim();
  const normalizedName = battery.name.replace(/\s+/g, " ").trim();
  return normalizedName || getBatteryDisplayName(battery);
}

function detectBatteryType(battery: BatteryProduct) {
  const text = `${battery.productCode ?? ""} ${battery.name} ${battery.spec}`.toUpperCase().replace(/\s+/g, "");
  if (text.includes("AGM")) return "AGM";
  if (text.includes("EFB")) return "EFB";
  if (text.includes("GB") || text.includes("DF") || text.includes("HK") || text.includes("MF") || text.includes("DIN")) return "CMF";
  return "UNKNOWN";
}

function parseBatteryAh(battery: BatteryProduct) {
  const fromSpec = `${battery.spec} ${battery.name}`.match(/(\d{2,3})\s*AH/i);
  if (fromSpec) {
    const ah = Number(fromSpec[1]);
    if (Number.isFinite(ah) && ah >= 20 && ah <= 220) return ah;
  }
  const code = (battery.productCode ?? "").toUpperCase().replace(/\s+/g, "");
  // Simple codes: GB80L, AGM70, DIN80R, etc.
  const fromCode = code.match(/^(?:AGM|EFB|DF|GB|HK|MF|DIN)(\d{2,3})(?:[RL])?$/);
  if (fromCode) {
    const ah = Number(fromCode[1]);
    if (Number.isFinite(ah) && ah >= 20 && ah <= 220) return ah;
  }
  // DIN standard codes: GB56219, GB57820, etc. (5XX - 500 = capacity)
  const dinMatch = code.match(/^(?:GB|DIN|DF)?([56]\d{4})$/);
  if (dinMatch) {
    const ah = Number(dinMatch[1].slice(0, 3)) - 500;
    if (Number.isFinite(ah) && ah >= 20 && ah <= 220) return ah;
  }
  return undefined;
}

function getBatteryBadge(battery: BatteryProduct, primaryBattery?: BatteryProduct): BatteryBadge {
  const exact: BatteryBadge = {
    label: "정규격",
    badgeClassName: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    detail: "차량 기준 정규격",
  };
  if (!primaryBattery || battery.id === primaryBattery.id) return exact;

  const primaryType = detectBatteryType(primaryBattery);
  const currentType = detectBatteryType(battery);
  if (primaryType !== "UNKNOWN" && currentType !== "UNKNOWN" && primaryType !== currentType) {
    return {
      label: "타입 확인",
      badgeClassName: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      detail: `배터리 타입이 다릅니다 (${currentType})`,
    };
  }

  const primaryAh = parseBatteryAh(primaryBattery);
  const currentAh = parseBatteryAh(battery);
  if (primaryAh && currentAh) {
    const diff = currentAh - primaryAh;
    if (currentAh < primaryAh * 0.85) {
      return { label: "타입 확인", badgeClassName: "bg-amber-500/20 text-amber-300 border border-amber-500/30", detail: `용량 부족 주의 (${currentAh}Ah)` };
    }
    if (currentAh > primaryAh * 1.25) {
      return { label: "여유 용량", badgeClassName: "bg-sky-500/20 text-sky-300 border border-sky-500/30", detail: `+${diff}Ah 대용량 (장착 확인 필요)` };
    }
    if (diff > 0) {
      return { label: "여유 용량", badgeClassName: "bg-sky-500/20 text-sky-300 border border-sky-500/30", detail: `+${diff}Ah 여유 · 배터리 수명에 유리` };
    }
    return { ...exact, detail: `${currentAh}Ah 정규격` };
  }

  if ((battery.note ?? "").includes("보강")) {
    return { label: "여유 용량", badgeClassName: "bg-sky-500/20 text-sky-300 border border-sky-500/30", detail: "코드 기준 호환 대체" };
  }
  return exact;
}

const WIZARD_STORAGE_KEY = "battery-wizard-state-v2";

/* ── Cascading Select Row ── */
function SelectRow({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={`transition-opacity ${disabled ? "pointer-events-none opacity-30" : "opacity-100"}`}>
      <label className="mb-1.5 block text-xs font-medium text-white/50">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white/90 outline-none transition focus:border-brand/60 focus:bg-white/8 focus:ring-1 focus:ring-brand/40 disabled:cursor-not-allowed"
      >
        <option value="" className="bg-[#0f1420] text-white/60">
          {placeholder ?? `${label} 선택`}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0f1420] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function HomePageClient() {
  const router = useRouter();
  const [origin, setOrigin] = useState<OriginType | "">("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [selectedBatteryId, setSelectedBatteryId] = useState("");
  const [compatibleBatteries, setCompatibleBatteries] = useState<BatteryProduct[]>([]);
  const [oemFormat, setOemFormat] = useState<"DIN" | "DF" | "">("");
  const [isBatteryLoading, setIsBatteryLoading] = useState(false);
  const [batteryLoadError, setBatteryLoadError] = useState("");
  const batteryCacheRef = useRef<Record<string, BatteryProduct[]>>({});
  const hasHydratedRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // localStorage hydration
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, string>;
        if (s.origin === "국산차" || s.origin === "수입차") setOrigin(s.origin);
        if (typeof s.brand === "string") setBrand(s.brand);
        if (typeof s.model === "string") setModel(s.model);
        if (typeof s.year === "string") setYear(s.year);
        if (typeof s.trim === "string") setTrim(s.trim);
        if (typeof s.selectedBatteryId === "string") setSelectedBatteryId(s.selectedBatteryId);
      }
    } catch { /* ignore */ }
    hasHydratedRef.current = true;
  }, []);

  // localStorage persistence
  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedRef.current) return;
    window.localStorage.setItem(
      WIZARD_STORAGE_KEY,
      JSON.stringify({ origin, brand, model, year, trim, selectedBatteryId }),
    );
  }, [origin, brand, model, year, trim, selectedBatteryId]);

  // Derived data
  const selectedOrigin: OriginType | null = origin === "국산차" || origin === "수입차" ? origin : null;

  const brandOptions = CATALOG_BRANDS.filter(
    (item) => origin.length === 0 || item.origin === origin,
  ).sort((a, b) => {
    const order = selectedOrigin !== null ? BRAND_PRIORITY_BY_ORIGIN[selectedOrigin]
      : a.origin === "국산차" || a.origin === "수입차" ? BRAND_PRIORITY_BY_ORIGIN[a.origin] : undefined;
    const aRank = order?.indexOf(a.name) ?? -1;
    const bRank = order?.indexOf(b.name) ?? -1;
    if (aRank === -1 && bRank === -1) return 0;
    if (aRank === -1) return 1;
    if (bRank === -1) return -1;
    return aRank - bRank;
  });

  const selectedBrand = brandOptions.find((item) => item.name === brand);
  const modelOptions = selectedBrand?.models ?? [];
  const selectedModel = modelOptions.find((item) => item.name === model);
  const parsedTrims = (selectedModel?.trims ?? []).map(parseTrim);
  const yearOptions = [...new Set(parsedTrims.map((item) => item.yearLabel))]
    .map((label) => ({ label, startYear: parseStartYear(label) }))
    .sort((a, b) => b.startYear - a.startYear)
    .map((item) => item.label);
  const trimOptions = parsedTrims
    .filter((item) => year.length === 0 || item.yearLabel === year)
    .sort((a, b) => {
      const fuelOrder: FuelType[] = ["가솔린", "디젤", "LPG", "하이브리드", "전기", "기타"];
      const diff = fuelOrder.indexOf(a.fuelType) - fuelOrder.indexOf(b.fuelType);
      return diff !== 0 ? diff : a.engineLabel.localeCompare(b.engineLabel, "ko");
    });
  const selectedTrim = parsedTrims.find((item) => item.id === trim);
  const selectedTrimId = selectedTrim?.id ?? "";
  const selectedEngineLabel = selectedTrim?.engineLabel ?? "";
  const batteryCacheKey = [selectedTrimId, origin, brand, model, year, selectedEngineLabel].join("|");
  const selectedBatterySearchKeyword = `${brand} ${model} ${selectedTrim?.engineLabel ?? ""} 배터리`.replace(/\s+/g, " ").trim();

  // Fetch compatible batteries
  useEffect(() => {
    if (!selectedTrimId) {
      setCompatibleBatteries([]);
      setOemFormat("");
      setIsBatteryLoading(false);
      setBatteryLoadError("");
      return;
    }

    const cached = batteryCacheRef.current[batteryCacheKey];
    if (cached) {
      setCompatibleBatteries(cached);
      setBatteryLoadError("");
      setIsBatteryLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setIsBatteryLoading(true);
      setBatteryLoadError("");
      try {
        const query = new URLSearchParams({
          trimId: selectedTrimId,
          origin,
          brandName: brand,
          modelName: model,
          yearLabel: year,
          engineLabel: selectedEngineLabel,
        });
        const response = await fetch(`/api/compatible-batteries?${query.toString()}`);
        if (!response.ok) throw new Error(`API 요청 실패 (${response.status})`);
        const payload = (await response.json()) as { items?: BatteryProduct[]; oemSpec?: { format?: "DIN" | "DF" } };
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (!cancelled) {
          batteryCacheRef.current[batteryCacheKey] = items;
          setCompatibleBatteries(items);
          setOemFormat(payload.oemSpec?.format ?? "");
          setSelectedBatteryId((cur) => (items.some((i) => i.id === cur) ? cur : ""));
          // Scroll to results
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
        }
      } catch {
        if (!cancelled) {
          setCompatibleBatteries([]);
          setSelectedBatteryId("");
          setBatteryLoadError("호환 배터리 조회에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
      } finally {
        if (!cancelled) setIsBatteryLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedTrimId, batteryCacheKey, origin, brand, model, year, selectedEngineLabel]);

  const selectedBattery = compatibleBatteries.find((item) => item.id === selectedBatteryId);
  const primaryBattery = compatibleBatteries.find((item) => item.origin === "rocket") ?? compatibleBatteries[0];
  const selectedBatteryStoreKeyword = selectedBattery?.productCode
    ? `${selectedBattery.productCode} 배터리`
    : selectedBatterySearchKeyword || `${brand} ${model} 배터리`;
  const selectedBatteryPurchaseKeyword = selectedBattery ? getBatteryPurchaseKeyword(selectedBattery) : "";
  const selectedBatteryPurchaseUrl = selectedBatteryPurchaseKeyword
    ? `/api/coupang/search?q=${encodeURIComponent(selectedBatteryPurchaseKeyword)}`
    : "";

  const handleOriginChange = (v: string) => {
    setOrigin(v as OriginType | "");
    setBrand(""); setModel(""); setYear(""); setTrim(""); setSelectedBatteryId("");
  };
  const handleBrandChange = (v: string) => {
    setBrand(v);
    setModel(""); setYear(""); setTrim(""); setSelectedBatteryId("");
  };
  const handleModelChange = (v: string) => {
    setModel(v);
    setYear(""); setTrim(""); setSelectedBatteryId("");
  };
  const handleYearChange = (v: string) => {
    setYear(v);
    setTrim(""); setSelectedBatteryId("");
  };
  const handleTrimChange = (v: string) => {
    setTrim(v);
    setSelectedBatteryId("");
  };
  const handleReset = () => {
    setOrigin(""); setBrand(""); setModel(""); setYear(""); setTrim("");
    setSelectedBatteryId(""); setCompatibleBatteries([]);
  };

  const hasResults = selectedTrimId.length > 0;
  const summaryText = [origin, brand, model, year, selectedTrim?.engineLabel].filter(Boolean).join(" > ");

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#0a0e17]">
      {/* Background gradient layers */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_60%,rgba(139,92,246,0.08),transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-[#0a0e17] to-transparent" />
      </div>

      <SiteNavigation />

      <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pb-12 md:pt-24">
        {/* Logo & tagline */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            BATTERY<span className="text-brand">FIT</span>
          </h1>
          <p className="mt-2 text-sm text-white/40">내 차에 딱 맞는 배터리</p>
        </div>

        {/* Glass card with cascading selects */}
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-7">
          <div className="space-y-4">
            {/* Origin */}
            <SelectRow
              label="차량 유형"
              value={origin}
              onChange={handleOriginChange}
              options={ORIGIN_OPTIONS.map((o) => ({ value: o, label: o }))}
              placeholder="국산차 / 수입차"
            />

            {/* Brand */}
            <SelectRow
              label="브랜드"
              value={brand}
              onChange={handleBrandChange}
              disabled={!origin}
              options={brandOptions.map((b) => ({ value: b.name, label: b.name }))}
            />

            {/* Model */}
            <SelectRow
              label="모델"
              value={model}
              onChange={handleModelChange}
              disabled={!brand}
              options={modelOptions.map((m) => ({ value: m.name, label: m.name }))}
            />

            {/* Year */}
            <SelectRow
              label="연식"
              value={year}
              onChange={handleYearChange}
              disabled={!model}
              options={yearOptions.map((y) => ({ value: y, label: y }))}
            />

            {/* Trim */}
            <SelectRow
              label="엔진 / 트림"
              value={trim}
              onChange={handleTrimChange}
              disabled={!year}
              options={trimOptions.map((t) => {
                const tag = t.fuelType !== "기타" ? `[${t.fuelType}] ` : "";
                return { value: t.id, label: `${tag}${t.engineLabel}` };
              })}
            />
          </div>

        </div>

        {/* Results */}
        {hasResults && (
          <div ref={resultsRef} className="mt-6 w-full">
            {/* Summary */}
            <p className="mb-3 truncate text-xs text-white/30">{summaryText}</p>

            {/* Loading */}
            {isBatteryLoading && (
              <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
                <span className="ml-3 text-sm text-white/50">호환 배터리 조회 중...</span>
              </div>
            )}

            {/* Error */}
            {!isBatteryLoading && batteryLoadError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {batteryLoadError}
              </div>
            )}

            {/* Empty */}
            {!isBatteryLoading && !batteryLoadError && compatibleBatteries.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/40">
                해당 트림에 매핑된 배터리 정보가 없습니다.
              </div>
            )}

            {/* Format indicator */}
            {!isBatteryLoading && compatibleBatteries.length > 0 && oemFormat && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${oemFormat === "DIN" ? "bg-violet-500/20 text-violet-300" : "bg-teal-500/20 text-teal-300"}`}>
                  {oemFormat}
                </span>
                <span className="text-[11px] text-white/50">
                  {oemFormat === "DIN" ? "유럽 규격 · 낮은 높이 · 매립 단자" : "국산 규격 · 높은 높이 · 돌출 단자"}
                </span>
              </div>
            )}

            {/* Battery cards */}
            {!isBatteryLoading && compatibleBatteries.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {compatibleBatteries.map((battery) => {
                  const badge = getBatteryBadge(battery, primaryBattery);
                  const isSelected = selectedBatteryId === battery.id;
                  return (
                    <button
                      key={battery.id}
                      type="button"
                      onClick={() => setSelectedBatteryId(battery.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-brand/50 bg-brand/10 shadow-lg shadow-brand/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="inline-flex h-9 w-28 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white px-2">
                          <Image
                            src={getBrandLogo(battery.brand)}
                            alt={`${battery.brand} 로고`}
                            width={120}
                            height={48}
                            className={`h-6 w-auto object-contain ${getBrandLogoScaleClass(battery.brand)}`}
                          />
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.badgeClassName}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white/90">
                        {getBatteryDisplayName(battery)}
                      </p>
                      <p className="mt-1 text-[11px] text-white/40">{badge.detail}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Upgrade tip */}
            {!isBatteryLoading && compatibleBatteries.length > 1 && (
              <p className="mt-3 rounded-lg border border-sky-500/10 bg-sky-500/5 px-3 py-2 text-[11px] leading-4 text-sky-300/70">
                <span className="font-semibold text-sky-300">TIP</span>{" "}
                동일 규격에서 10Ah 정도 용량이 높은 배터리는 전장 부하에 여유가 생겨 배터리 수명과 시동 안정성에 유리합니다.
              </p>
            )}

            {/* Action buttons */}
            {selectedBattery && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className={`grid gap-2 ${selectedBatteryPurchaseUrl ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button
                    type="button"
                    onClick={() => router.push(`/battery-map?q=${encodeURIComponent(selectedBatteryStoreKeyword)}`)}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-strong"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                      <path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1116 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    주변매장
                  </button>
                  {selectedBatteryPurchaseUrl && (
                    <a
                      href={selectedBatteryPurchaseUrl}
                      target="_blank"
                      rel="sponsored nofollow noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M15 4v3h3M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      상품구매
                    </a>
                  )}
                </div>
                {selectedBatteryPurchaseUrl && (
                  <p className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[10px] text-white/30">
                    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                  </p>
                )}
              </div>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white/70"
            >
              초기화
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
