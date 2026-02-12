"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import KakaoStoreSearchSection, {
  type KakaoPlace,
} from "./components/KakaoStoreSearchSection";
import vehicleCatalog from "../data/vehicle-catalog.json";

type TabKey = "home" | "map" | "post" | "mycar";
type OriginType = "국산차" | "수입차";
type StoreSortMode = "relevance" | "distance";

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

type ParsedTrim = {
  id: string;
  fullName: string;
  yearLabel: string;
  engineLabel: string;
};

type BatteryBadge = {
  label: "권장" | "상향 가능";
  badgeClassName: string;
  detail: string;
};

type WizardSnapshot = {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  origin: OriginType | "";
  brand: string;
  model: string;
  year: string;
  trim: string;
  selectedBatteryId: string;
  brandKeyword: string;
  modelKeyword: string;
  mapKeyword: string;
};

type BatteryNotePostPreview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnailUrl: string;
  tags: string[];
  publishedAt: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

type MyCarProfile = {
  origin: OriginType | "";
  brand: string;
  model: string;
  year: string;
  mileage: string;
  fuelType: string;
};

type ConsumableState = {
  engineOilKm: string;
  brakePadKm: string;
  tireKm: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  category: "주유" | "정비" | "세차" | "보험" | "기타";
  amount: number;
  mileage: string;
  memo: string;
};

type LedgerDraft = {
  date: string;
  category: "주유" | "정비" | "세차" | "보험" | "기타";
  amount: string;
  mileage: string;
  memo: string;
};

const DEFAULT_CAR_PROFILE: MyCarProfile = {
  origin: "",
  brand: "",
  model: "",
  year: "",
  mileage: "",
  fuelType: "",
};

const DEFAULT_CONSUMABLES: ConsumableState = {
  engineOilKm: "",
  brakePadKm: "",
  tireKm: "",
};

const DEFAULT_LEDGER_DRAFT: LedgerDraft = {
  date: new Date().toISOString().slice(0, 10),
  category: "주유",
  amount: "",
  mileage: "",
  memo: "",
};

function formatKoreanDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function toNumeric(value: string) {
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseYearForMarket(value: string) {
  const direct = toNumeric(value);
  if (direct !== null) {
    return direct;
  }
  const match = value.match(/(19|20)\d{2}/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function estimateMarketPrice(profile: MyCarProfile) {
  const year = parseYearForMarket(profile.year);
  const mileage = toNumeric(profile.mileage);
  if (!year || !mileage) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const age = Math.max(0, currentYear - year);
  const ageFactor = Math.max(0.35, 1 - age * 0.08);
  const mileageFactor = Math.max(0.45, 1 - mileage / 220000);
  const basePrice = 30000000;
  const center = Math.round(basePrice * ageFactor * mileageFactor);
  const min = Math.max(1000000, Math.round(center * 0.9));
  const max = Math.round(center * 1.1);

  return { min, max };
}

function remainingKm(currentMileageText: string, lastChangeText: string, cycleKm: number) {
  const current = toNumeric(currentMileageText);
  const last = toNumeric(lastChangeText);
  if (current === null || last === null) {
    return null;
  }
  return Math.round(last + cycleKm - current);
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
  };
}

function inferFuelType(engineLabel: string) {
  const text = engineLabel.toLowerCase().replace(/\s+/g, "");
  if (text.includes("전기") || text.includes("ev")) {
    return "전기";
  }
  if (text.includes("하이브리드") || text.includes("hev") || text.includes("phev")) {
    return "하이브리드";
  }
  if (text.includes("디젤") || text.includes("diesel")) {
    return "디젤";
  }
  if (text.includes("lpg")) {
    return "LPG";
  }
  if (text.includes("cng")) {
    return "CNG";
  }
  if (
    text.includes("가솔린") ||
    text.includes("휘발유") ||
    text.includes("gasoline") ||
    text.includes("petrol")
  ) {
    return "가솔린";
  }
  return null;
}

function TabPictogram({ tab }: { tab: TabKey }) {
  if (tab === "home") {
    return (
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
    );
  }

  if (tab === "map") {
    return (
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
    );
  }

  if (tab === "post") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M6 4h9l3 3v13H6z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 4v3h3M9 11h6M9 15h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 17l3-8h10l3 8M8 9l1-3h6l1 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

const CATALOG_BRANDS = vehicleCatalog.brands as CatalogBrand[];
const ORIGIN_OPTIONS: OriginType[] = ["국산차", "수입차"];

const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "홈" },
  { key: "map", label: "배터리지도" },
  { key: "post", label: "배터리노트" },
  { key: "mycar", label: "내차관리" },
];

const TAB_STORAGE_KEY = "battery-active-tab";
const WIZARD_STORAGE_KEY = "battery-wizard-state-v1";
const BRAND_PRIORITY_BY_ORIGIN: Record<OriginType, string[]> = {
  국산차: [
    "현대자동차",
    "기아자동차",
    "제네시스",
    "쉐보레/GM",
    "르노삼성",
    "쌍용자동차",
  ],
  수입차: [
    "벤츠",
    "BMW",
    "아우디",
    "폭스바겐",
    "볼보",
    "렉서스",
    "도요타",
    "혼다",
    "포드",
    "지프",
    "랜드로버",
    "미니",
    "닛산",
    "푸조",
    "캐딜락",
    "인피니티",
    "재규어",
    "링컨",
    "크라이슬러",
  ],
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
  한국배터리: "scale-[1.25]",
  VARTA: "scale-105",
  "한국배터리(아트라스)": "scale-[1.25]",
  아트라스BX: "scale-[1.25]",
  아트라스비엑스: "scale-[1.25]",
  쏠라이트: "scale-105",
};

function getBrandLogo(brand: string) {
  return BRAND_LOGO_MAP[brand] ?? DEFAULT_BRAND_LOGO;
}

function getBrandLogoScaleClass(brand: string) {
  return BRAND_LOGO_SCALE_CLASS_MAP[brand] ?? "scale-100";
}

function getBatteryDisplayName(battery: BatteryProduct) {
  if (battery.productCode) {
    return `${battery.brand} ${battery.productCode}`;
  }

  return battery.name.replace(/\s+/g, " ").trim();
}

function detectBatteryType(battery: BatteryProduct) {
  const text = `${battery.productCode ?? ""} ${battery.name} ${battery.spec}`
    .toUpperCase()
    .replace(/\s+/g, "");

  if (text.includes("AGM")) {
    return "AGM";
  }
  if (text.includes("EFB")) {
    return "EFB";
  }
  if (
    text.includes("GB") ||
    text.includes("DF") ||
    text.includes("HK") ||
    text.includes("MF") ||
    text.includes("DIN")
  ) {
    return "CMF";
  }
  return "UNKNOWN";
}

function parseBatteryAh(battery: BatteryProduct) {
  const fromSpec = `${battery.spec} ${battery.name}`.match(/(\d{2,3})\s*AH/i);
  if (fromSpec) {
    const ah = Number(fromSpec[1]);
    if (Number.isFinite(ah) && ah >= 20 && ah <= 220) {
      return ah;
    }
  }

  const code = (battery.productCode ?? "").toUpperCase().replace(/\s+/g, "");
  const fromCode = code.match(/^(?:AGM|DF|GB|HK|MF|DIN)(\d{2,3})(?:[A-Z]|$)/);
  if (fromCode) {
    const ah = Number(fromCode[1]);
    if (Number.isFinite(ah) && ah >= 20 && ah <= 220) {
      return ah;
    }
  }

  return undefined;
}

function getBatteryBadge(
  battery: BatteryProduct,
  primaryBattery?: BatteryProduct,
): BatteryBadge {
  const recommended: BatteryBadge = {
    label: "권장",
    badgeClassName: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    detail: "차량 기준 권장 범위",
  };

  if (!primaryBattery || battery.id === primaryBattery.id) {
    return recommended;
  }

  const primaryType = detectBatteryType(primaryBattery);
  const currentType = detectBatteryType(battery);
  if (
    primaryType !== "UNKNOWN" &&
    currentType !== "UNKNOWN" &&
    primaryType !== currentType
  ) {
    return {
      label: "상향 가능",
      badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
      detail: `타입 확인 필요 (${currentType})`,
    };
  }

  const primaryAh = parseBatteryAh(primaryBattery);
  const currentAh = parseBatteryAh(battery);
  if (primaryAh && currentAh) {
    if (currentAh > primaryAh * 1.25) {
      return {
        label: "상향 가능",
        badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
        detail: `용량 확인 필요 (${currentAh}Ah)`,
      };
    }
    if (currentAh < primaryAh * 0.85) {
      return {
        label: "상향 가능",
        badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
        detail: `용량 확인 필요 (${currentAh}Ah)`,
      };
    }
    if (currentAh > primaryAh * 1.1) {
      return {
        label: "상향 가능",
        badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
        detail: `${primaryAh}Ah 대비 상향`,
      };
    }
    return {
      ...recommended,
      detail: `${currentAh}Ah 기준`,
    };
  }

  if ((battery.note ?? "").includes("보강")) {
    return {
      label: "상향 가능",
      badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
      detail: "코드 기준 대체 후보",
    };
  }

  return recommended;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [origin, setOrigin] = useState<OriginType | "">("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [trim, setTrim] = useState("");
  const [selectedBatteryId, setSelectedBatteryId] = useState("");
  const [brandKeyword, setBrandKeyword] = useState("");
  const [modelKeyword, setModelKeyword] = useState("");
  const [mapKeyword, setMapKeyword] = useState("");
  const [realMapResults, setRealMapResults] = useState<KakaoPlace[]>([]);
  const [compatibleBatteries, setCompatibleBatteries] = useState<BatteryProduct[]>(
    [],
  );
  const [isBatteryLoading, setIsBatteryLoading] = useState(false);
  const [batteryLoadError, setBatteryLoadError] = useState("");
  const [mapStoreSortMode, setMapStoreSortMode] =
    useState<StoreSortMode>("relevance");
  const [notePosts, setNotePosts] = useState<BatteryNotePostPreview[]>([]);
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [carProfile, setCarProfile] = useState<MyCarProfile>(DEFAULT_CAR_PROFILE);
  const [consumables, setConsumables] = useState<ConsumableState>(DEFAULT_CONSUMABLES);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerDraft, setLedgerDraft] = useState<LedgerDraft>(DEFAULT_LEDGER_DRAFT);
  const [mycarMessage, setMycarMessage] = useState("");
  const batteryCacheRef = useRef<Record<string, BatteryProduct[]>>({});
  const hasHydratedRef = useRef(false);
  const mycarHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedTab = window.localStorage.getItem(TAB_STORAGE_KEY);
      if (savedTab && TABS.some((tab) => tab.key === savedTab)) {
        setActiveTab(savedTab as TabKey);
      }

      const snapshotRaw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
      if (snapshotRaw) {
        const snapshot = JSON.parse(snapshotRaw) as Partial<WizardSnapshot>;
        if (
          typeof snapshot.step === "number" &&
          [1, 2, 3, 4, 5, 6].includes(snapshot.step)
        ) {
          setStep(snapshot.step as 1 | 2 | 3 | 4 | 5 | 6);
        }
        if (snapshot.origin === "국산차" || snapshot.origin === "수입차") {
          setOrigin(snapshot.origin);
        }
        if (typeof snapshot.brand === "string") {
          setBrand(snapshot.brand);
        }
        if (typeof snapshot.model === "string") {
          setModel(snapshot.model);
        }
        if (typeof snapshot.year === "string") {
          setYear(snapshot.year);
        }
        if (typeof snapshot.trim === "string") {
          setTrim(snapshot.trim);
        }
        if (typeof snapshot.selectedBatteryId === "string") {
          setSelectedBatteryId(snapshot.selectedBatteryId);
        }
        if (typeof snapshot.brandKeyword === "string") {
          setBrandKeyword(snapshot.brandKeyword);
        }
        if (typeof snapshot.modelKeyword === "string") {
          setModelKeyword(snapshot.modelKeyword);
        }
        if (typeof snapshot.mapKeyword === "string") {
          setMapKeyword(snapshot.mapKeyword);
        }
      }
    } catch {
      // 로컬 스토리지 포맷이 깨졌을 때는 기본 상태로 진행.
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedRef.current) {
      return;
    }

    const snapshot: WizardSnapshot = {
      step,
      origin,
      brand,
      model,
      year,
      trim,
      selectedBatteryId,
      brandKeyword,
      modelKeyword,
      mapKeyword,
    };

    window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(snapshot));
  }, [
    step,
    origin,
    brand,
    model,
    year,
    trim,
    selectedBatteryId,
    brandKeyword,
    modelKeyword,
    mapKeyword,
  ]);

  const selectedOrigin: OriginType | null =
    origin === "국산차" || origin === "수입차" ? origin : null;

  useEffect(() => {
    if (activeTab !== "post") {
      return;
    }

    let cancelled = false;
    setIsNoteLoading(true);
    setNoteError("");

    const run = async () => {
      try {
        const response = await fetch("/api/battery-notes?limit=20");
        if (!response.ok) {
          throw new Error(`Battery notes API failed: ${response.status}`);
        }
        const payload = (await response.json()) as {
          items?: BatteryNotePostPreview[];
        };
        if (!cancelled) {
          setNotePosts(Array.isArray(payload.items) ? payload.items : []);
        }
      } catch {
        if (!cancelled) {
          setNotePosts([]);
          setNoteError("배터리노트 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsNoteLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "mycar") {
      return;
    }

    let cancelled = false;
    setIsAuthLoading(true);
    setAuthMessage("");

    const run = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          throw new Error(`Auth me API failed: ${response.status}`);
        }
        const payload = (await response.json()) as {
          user?: AuthUser | null;
        };
        if (!cancelled) {
          setAuthUser(payload.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null);
          setAuthMessage("계정 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const handleRegister = async () => {
    setIsAuthSubmitting(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
        }),
      });
      const payload = (await response.json()) as {
        user?: AuthUser;
        message?: string;
      };
      if (!response.ok || !payload.user) {
        setAuthMessage(payload.message || "회원가입에 실패했습니다.");
        return;
      }
      setAuthUser(payload.user);
      setRegisterPassword("");
      setLoginPassword("");
      setAuthMessage("회원가입이 완료되었습니다.");
    } catch {
      setAuthMessage("회원가입 요청 중 오류가 발생했습니다.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsAuthSubmitting(true);
    setAuthMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const payload = (await response.json()) as {
        user?: AuthUser;
        message?: string;
      };
      if (!response.ok || !payload.user) {
        setAuthMessage(payload.message || "로그인에 실패했습니다.");
        return;
      }
      setAuthUser(payload.user);
      setLoginPassword("");
      setRegisterPassword("");
      setAuthMessage("로그인되었습니다.");
    } catch {
      setAuthMessage("로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthSubmitting(true);
    setAuthMessage("");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthUser(null);
      setAuthView("login");
      setAuthMessage("로그아웃되었습니다.");
    } catch {
      setAuthMessage("로그아웃 중 오류가 발생했습니다.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    mycarHydratedRef.current = false;
    if (!authUser) {
      setCarProfile(DEFAULT_CAR_PROFILE);
      setConsumables(DEFAULT_CONSUMABLES);
      setLedgerEntries([]);
      setLedgerDraft({
        ...DEFAULT_LEDGER_DRAFT,
        date: new Date().toISOString().slice(0, 10),
      });
      setMycarMessage("");
      return;
    }

    const storageKey = `battery-mycar:${authUser.email.toLowerCase()}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          carProfile?: MyCarProfile;
          consumables?: ConsumableState;
          ledgerEntries?: LedgerEntry[];
        };
        if (parsed.carProfile) {
          setCarProfile({
            ...DEFAULT_CAR_PROFILE,
            ...parsed.carProfile,
          });
        } else {
          setCarProfile(DEFAULT_CAR_PROFILE);
        }
        if (parsed.consumables) {
          setConsumables({
            ...DEFAULT_CONSUMABLES,
            ...parsed.consumables,
          });
        } else {
          setConsumables(DEFAULT_CONSUMABLES);
        }
        setLedgerEntries(
          Array.isArray(parsed.ledgerEntries) ? parsed.ledgerEntries : [],
        );
      } else {
        setCarProfile(DEFAULT_CAR_PROFILE);
        setConsumables(DEFAULT_CONSUMABLES);
        setLedgerEntries([]);
      }
    } catch {
      setCarProfile(DEFAULT_CAR_PROFILE);
      setConsumables(DEFAULT_CONSUMABLES);
      setLedgerEntries([]);
    } finally {
      setLedgerDraft({
        ...DEFAULT_LEDGER_DRAFT,
        date: new Date().toISOString().slice(0, 10),
      });
      mycarHydratedRef.current = true;
    }
  }, [authUser]);

  useEffect(() => {
    if (typeof window === "undefined" || !authUser || !mycarHydratedRef.current) {
      return;
    }

    const storageKey = `battery-mycar:${authUser.email.toLowerCase()}`;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        carProfile,
        consumables,
        ledgerEntries,
      }),
    );
  }, [authUser, carProfile, consumables, ledgerEntries]);

  const handleAddLedgerEntry = () => {
    const amount = toNumeric(ledgerDraft.amount);
    if (!amount || amount <= 0) {
      setMycarMessage("차계부 금액을 올바르게 입력해주세요.");
      return;
    }

    const entry: LedgerEntry = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ledger-${Date.now()}`,
      date: ledgerDraft.date || new Date().toISOString().slice(0, 10),
      category: ledgerDraft.category,
      amount,
      mileage: ledgerDraft.mileage.trim(),
      memo: ledgerDraft.memo.trim(),
    };

    setLedgerEntries((prev) => [entry, ...prev].slice(0, 100));
    setLedgerDraft({
      ...DEFAULT_LEDGER_DRAFT,
      date: new Date().toISOString().slice(0, 10),
    });
    setMycarMessage("차계부 항목을 저장했습니다.");
  };

  const handleRemoveLedgerEntry = (id: string) => {
    setLedgerEntries((prev) => prev.filter((entry) => entry.id !== id));
    setMycarMessage("선택한 차계부 항목을 삭제했습니다.");
  };

  const brandOptions = CATALOG_BRANDS.filter(
    (item) => origin.length === 0 || item.origin === origin,
  ).sort((a, b) => {
    const order =
      selectedOrigin !== null
        ? BRAND_PRIORITY_BY_ORIGIN[selectedOrigin]
        : a.origin === "국산차" || a.origin === "수입차"
          ? BRAND_PRIORITY_BY_ORIGIN[a.origin]
          : undefined;

    const aRank = order?.indexOf(a.name) ?? -1;
    const bRank = order?.indexOf(b.name) ?? -1;

    if (aRank === -1 && bRank === -1) {
      return 0;
    }
    if (aRank === -1) {
      return 1;
    }
    if (bRank === -1) {
      return -1;
    }
    return aRank - bRank;
  });
  const filteredBrandOptions = brandOptions.filter((item) =>
    item.name.toLowerCase().includes(brandKeyword.trim().toLowerCase()),
  );
  const selectedBrand = brandOptions.find((item) => item.name === brand);
  const modelOptions = selectedBrand?.models ?? [];
  const filteredModelOptions = modelOptions.filter((item) =>
    item.name.toLowerCase().includes(modelKeyword.trim().toLowerCase()),
  );
  const selectedModel = modelOptions.find((item) => item.name === model);
  const parsedTrims = (selectedModel?.trims ?? []).map(parseTrim);
  const yearOptions = [...new Set(parsedTrims.map((item) => item.yearLabel))];
  const trimOptions = parsedTrims.filter(
    (item) => year.length === 0 || item.yearLabel === year,
  );
  const selectedTrim = parsedTrims.find((item) => item.id === trim);
  const selectedTrimId = selectedTrim?.id ?? "";
  const selectedEngineLabel = selectedTrim?.engineLabel ?? "";
  const batteryCacheKey = [
    selectedTrimId,
    origin,
    brand,
    model,
    year,
    selectedEngineLabel,
  ].join("|");
  const selectedBatterySearchKeyword = `${brand} ${model} ${
    selectedTrim?.engineLabel ?? ""
  } 배터리`
    .replace(/\s+/g, " ")
    .trim();

  useEffect(() => {
    if (step !== 6 || !selectedTrimId) {
      setCompatibleBatteries([]);
      setIsBatteryLoading(false);
      setBatteryLoadError("");
      return;
    }

    const cachedItems = batteryCacheRef.current[batteryCacheKey];
    if (cachedItems) {
      setCompatibleBatteries(cachedItems);
      setBatteryLoadError("");
      setIsBatteryLoading(false);
      return;
    }

    let isCancelled = false;

    const loadCompatibleBatteries = async () => {
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
        const response = await fetch(
          `/api/compatible-batteries?${query.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`API 요청 실패 (${response.status})`);
        }

        const payload = (await response.json()) as {
          items?: BatteryProduct[];
        };
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!isCancelled) {
          batteryCacheRef.current[batteryCacheKey] = items;
          setCompatibleBatteries(items);
          setSelectedBatteryId((current) =>
            items.some((item) => item.id === current) ? current : "",
          );
        }
      } catch {
        if (!isCancelled) {
          setCompatibleBatteries([]);
          setSelectedBatteryId("");
          setBatteryLoadError(
            "실제 호환 배터리 조회에 실패했습니다. 잠시 후 다시 시도해주세요.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsBatteryLoading(false);
        }
      }
    };

    void loadCompatibleBatteries();

    return () => {
      isCancelled = true;
    };
  }, [
    selectedTrimId,
    step,
    batteryCacheKey,
    origin,
    brand,
    model,
    year,
    selectedEngineLabel,
  ]);

  const selectedBattery = compatibleBatteries.find(
    (item) => item.id === selectedBatteryId,
  );
  const primaryBattery =
    compatibleBatteries.find((item) => item.origin === "rocket") ??
    compatibleBatteries[0];
  const selectedBatteryStoreKeyword = selectedBattery?.productCode
    ? `${selectedBattery.productCode} 배터리`
    : selectedBatterySearchKeyword || `${brand} ${model} 배터리`;

  const resetAfterOrigin = () => {
    setBrand("");
    setModel("");
    setYear("");
    setTrim("");
    setBrandKeyword("");
    setModelKeyword("");
    setSelectedBatteryId("");
  };

  const resetAfterBrand = () => {
    setModel("");
    setYear("");
    setTrim("");
    setModelKeyword("");
    setSelectedBatteryId("");
  };

  const resetAfterModel = () => {
    setYear("");
    setTrim("");
    setSelectedBatteryId("");
  };

  const resetAfterYear = () => {
    setTrim("");
    setSelectedBatteryId("");
  };

  const resetWizard = () => {
    setStep(1);
    setOrigin("");
    resetAfterOrigin();
  };

  const moveToStep = (targetStep: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (targetStep === 1) {
      setStep(1);
      return;
    }

    if (targetStep === 2 && origin) {
      setStep(2);
      return;
    }

    if (targetStep === 3 && brand) {
      setStep(3);
      return;
    }

    if (targetStep === 4 && model) {
      setStep(4);
      return;
    }

    if (targetStep === 5 && year) {
      setStep(5);
      return;
    }

    if (targetStep === 6 && trim) {
      setStep(6);
    }
  };

  const stepTitle =
    step === 1
      ? "차량 원산지 선택"
      : step === 2
        ? "브랜드 선택"
        : step === 3
          ? "모델 선택"
          : step === 4
            ? "연식 선택"
            : step === 5
              ? "엔진/트림 선택"
              : "호환 배터리 선택";

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, tab);
    }
  };

  const mycarSelectedOrigin: OriginType | null =
    carProfile.origin === "국산차" || carProfile.origin === "수입차"
      ? carProfile.origin
      : null;
  const mycarBrandOptions = CATALOG_BRANDS.filter(
    (item) => !mycarSelectedOrigin || item.origin === mycarSelectedOrigin,
  ).sort((a, b) => {
    const order =
      mycarSelectedOrigin !== null
        ? BRAND_PRIORITY_BY_ORIGIN[mycarSelectedOrigin]
        : a.origin === "국산차" || a.origin === "수입차"
          ? BRAND_PRIORITY_BY_ORIGIN[a.origin]
          : undefined;

    const aRank = order?.indexOf(a.name) ?? -1;
    const bRank = order?.indexOf(b.name) ?? -1;

    if (aRank === -1 && bRank === -1) {
      return 0;
    }
    if (aRank === -1) {
      return 1;
    }
    if (bRank === -1) {
      return -1;
    }
    return aRank - bRank;
  });
  const mycarSelectedBrand = mycarBrandOptions.find(
    (item) => item.name === carProfile.brand,
  );
  const mycarModelOptions = mycarSelectedBrand?.models ?? [];
  const mycarSelectedModel = mycarModelOptions.find(
    (item) => item.name === carProfile.model,
  );
  const mycarParsedTrims = (mycarSelectedModel?.trims ?? []).map(parseTrim);
  const mycarYearOptions = [...new Set(mycarParsedTrims.map((item) => item.yearLabel))];
  const mycarTrimsInYear = mycarParsedTrims.filter(
    (item) => carProfile.year.length === 0 || item.yearLabel === carProfile.year,
  );
  const inferredFuelOptions = [
    ...new Set(
      mycarTrimsInYear
        .map((item) => inferFuelType(item.engineLabel))
        .filter(
          (value): value is NonNullable<ReturnType<typeof inferFuelType>> =>
            value !== null,
        ),
    ),
  ];
  const mycarFuelOptions =
    inferredFuelOptions.length > 0
      ? inferredFuelOptions
      : ["가솔린", "디젤", "LPG", "하이브리드", "전기", "CNG"];

  const estimatedMarket = estimateMarketPrice(carProfile);
  const engineOilRemaining = remainingKm(carProfile.mileage, consumables.engineOilKm, 10000);
  const brakePadRemaining = remainingKm(carProfile.mileage, consumables.brakePadKm, 30000);
  const tireRemaining = remainingKm(carProfile.mileage, consumables.tireKm, 45000);
  const totalLedgerCost = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f4f7fb_45%,#f4f7fb_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-7 lg:px-10">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:gap-5">
        {activeTab === "home" && (
          <section className="space-y-4">
            <header className="pt-1 text-center sm:pt-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                <span className="text-emerald-500">배터리핏</span> : 내차에 딱 맞는
                배터리 찾기
              </h1>
            </header>

            <article className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:rounded-2xl sm:p-5">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-bold">내 차 배터리 찾기</h2>
                </div>
              </div>

              <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${(step / 6) * 100}%` }}
                />
              </div>

              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-500">{stepTitle}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => moveToStep(1)}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      step === 1
                        ? "border-brand bg-brand/5"
                        : "border-line bg-white text-slate-600"
                    }`}
                  >
                    <p className="text-[11px] font-semibold">원산지</p>
                    <p className="mt-0.5 truncate text-xs">{origin || "선택"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToStep(2)}
                    disabled={!origin}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      step === 2
                        ? "border-brand bg-brand/5"
                        : "border-line bg-white text-slate-600"
                    } ${!origin ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <p className="text-[11px] font-semibold">브랜드</p>
                    <p className="mt-0.5 truncate text-xs">{brand || "선택"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToStep(3)}
                    disabled={!brand}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      step === 3
                        ? "border-brand bg-brand/5"
                        : "border-line bg-white text-slate-600"
                    } ${!brand ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <p className="text-[11px] font-semibold">모델</p>
                    <p className="mt-0.5 truncate text-xs">{model || "선택"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToStep(4)}
                    disabled={!model}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      step === 4
                        ? "border-brand bg-brand/5"
                        : "border-line bg-white text-slate-600"
                    } ${!model ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <p className="text-[11px] font-semibold">연식</p>
                    <p className="mt-0.5 truncate text-xs">{year || "선택"}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveToStep(5)}
                    disabled={!year}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      step === 5 || step === 6
                        ? "border-brand bg-brand/5"
                        : "border-line bg-white text-slate-600"
                    } ${!year ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <p className="text-[11px] font-semibold">엔진/트림</p>
                    <p className="mt-0.5 truncate text-xs">
                      {selectedTrim?.engineLabel || "선택"}
                    </p>
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-line bg-white p-4">
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    {ORIGIN_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setOrigin(item);
                          resetAfterOrigin();
                          setStep(2);
                        }}
                        className={`rounded-xl border px-4 py-5 text-left ${
                          origin === item
                            ? "border-brand bg-brand/5"
                            : "border-line bg-white"
                        }`}
                      >
                        <p className="text-sm font-semibold">{item}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item === "국산차"
                            ? "현대/기아/제네시스 등"
                            : "BMW/벤츠/아우디 등"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <input
                      value={brandKeyword}
                      onChange={(event) => setBrandKeyword(event.target.value)}
                      placeholder="브랜드 검색"
                      className="mb-3 w-full rounded-xl border border-line px-3 py-2 text-sm"
                    />
                    <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                      {filteredBrandOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setBrand(item.name);
                            resetAfterBrand();
                            setStep(3);
                          }}
                          className={`rounded-xl border px-3 py-3 text-left text-sm ${
                            brand === item.name
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                    {filteredBrandOptions.length === 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        조건에 맞는 브랜드가 없습니다.
                      </p>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <input
                      value={modelKeyword}
                      onChange={(event) => setModelKeyword(event.target.value)}
                      placeholder="모델 검색"
                      className="mb-3 w-full rounded-xl border border-line px-3 py-2 text-sm"
                    />
                    <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                      {filteredModelOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setModel(item.name);
                            resetAfterModel();
                            setStep(4);
                          }}
                          className={`rounded-xl border px-3 py-3 text-left text-sm ${
                            model === item.name
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                    {filteredModelOptions.length === 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        조건에 맞는 모델이 없습니다.
                      </p>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {yearOptions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setYear(item);
                            resetAfterYear();
                            setStep(5);
                          }}
                          className={`rounded-xl border px-3 py-3 text-sm ${
                            year === item
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    {yearOptions.length === 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        선택한 모델의 연식 데이터가 없습니다.
                      </p>
                    )}
                  </>
                )}

                {step === 5 && (
                  <>
                    <div className="max-h-80 space-y-2 overflow-auto">
                      {trimOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setTrim(item.id);
                            setSelectedBatteryId("");
                            setStep(6);
                          }}
                          className={`w-full rounded-xl border px-4 py-3 text-left ${
                            trim === item.id
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          <p className="text-sm font-semibold">{item.engineLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.yearLabel}</p>
                        </button>
                      ))}
                    </div>
                    {trimOptions.length === 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        선택한 연식의 엔진/트림 데이터가 없습니다.
                      </p>
                    )}
                  </>
                )}

                {step === 6 && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      {origin} / {brand} / {model} / {year} /{" "}
                      {selectedTrim?.engineLabel}
                    </p>
                    {isBatteryLoading && (
                      <p className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        선택한 차량 기준 호환 배터리를 조회 중입니다...
                      </p>
                    )}
                    {!isBatteryLoading && batteryLoadError && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {batteryLoadError}
                      </p>
                    )}
                    {!isBatteryLoading &&
                      !batteryLoadError &&
                      compatibleBatteries.length === 0 && (
                        <p className="rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          해당 트림에 매핑된 배터리 정보가 없습니다.
                        </p>
                      )}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {compatibleBatteries.map((battery) => {
                        const badge = getBatteryBadge(battery, primaryBattery);

                        return (
                          <button
                            key={battery.id}
                            type="button"
                            onClick={() => setSelectedBatteryId(battery.id)}
                            className={`rounded-xl border px-4 py-3 text-left ${
                              selectedBatteryId === battery.id
                                ? "border-brand bg-brand/5"
                                : "border-line bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="inline-flex h-10 w-32 items-center justify-center rounded-md border border-line/70 bg-white px-2">
                                <Image
                                  src={getBrandLogo(battery.brand)}
                                  alt={`${battery.brand} 로고`}
                                  width={140}
                                  height={56}
                                  className={`h-7 w-auto object-contain ${getBrandLogoScaleClass(
                                    battery.brand,
                                  )}`}
                                />
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge.badgeClassName}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-slate-800">
                              {getBatteryDisplayName(battery)}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {badge.detail}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {step === 6 && (
                <div className="mt-5 flex justify-end gap-2">
                  {selectedBattery && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapKeyword(selectedBatteryStoreKeyword);
                        handleTabChange("map");
                      }}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                    >
                      배터리 매장검색
                    </button>
                  )}
                  {selectedBattery && (
                    <a
                      href={selectedBattery.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      상품 상세 보기
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={resetWizard}
                    className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    처음으로
                  </button>
                </div>
              )}
            </article>
          </section>
        )}

        {activeTab === "map" && (
          <section className="space-y-3 sm:space-y-4">
            <article className="rounded-xl border border-line bg-surface p-3 shadow-sm sm:rounded-2xl sm:p-5">
              <h2 className="text-lg font-bold">배터리 가게 지도 검색</h2>
              <div className="mt-3">
                <input
                  value={mapKeyword}
                  onChange={(event) => setMapKeyword(event.target.value)}
                  placeholder="예: 인천 부평, 병점, 강남역"
                  className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  지역명 위주로 입력해 위치를 먼저 맞추고, 지도를 옮기면 현재 지도 중심 기준으로 매장을 표시합니다.
                </p>
              </div>
              <div className="mt-3 flex w-full overflow-hidden rounded-lg border border-line bg-white sm:inline-flex sm:w-auto">
                <button
                  type="button"
                  onClick={() => setMapStoreSortMode("relevance")}
                  className={`flex-1 px-2.5 py-2 text-[12px] font-semibold sm:flex-none sm:text-[11px] ${
                    mapStoreSortMode === "relevance"
                      ? "bg-brand text-white"
                      : "text-slate-600"
                  }`}
                >
                  관련도순
                </button>
                <button
                  type="button"
                  onClick={() => setMapStoreSortMode("distance")}
                  className={`flex-1 px-2.5 py-2 text-[12px] font-semibold sm:flex-none sm:text-[11px] ${
                    mapStoreSortMode === "distance"
                      ? "bg-brand text-white"
                      : "text-slate-600"
                  }`}
                >
                  가까운순
                </button>
              </div>
            </article>

            <article className="rounded-xl border border-line bg-surface p-3 shadow-sm sm:rounded-2xl sm:p-5">
              <KakaoStoreSearchSection
                keyword={mapKeyword}
                nearbyOnly
                autoLocate
                forceNearbyBatteryQueries
                sortMode={mapStoreSortMode}
                onResultsChange={setRealMapResults}
              />
            </article>

            <article className="rounded-xl border border-line bg-surface p-3 shadow-sm sm:rounded-2xl sm:p-5">
              <h3 className="text-base font-bold">
                검색 결과 매장 ({realMapResults.length})
              </h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {realMapResults.map((place) => (
                  <div
                    key={place.id}
                    className="rounded-xl border border-line bg-white px-4 py-3"
                  >
                    <p className="text-sm font-semibold">{place.place_name}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {place.road_address_name || place.address_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {place.phone || "전화번호 정보 없음"}
                    </p>
                    {place.place_url && (
                      <a
                        href={place.place_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-brand"
                      >
                        카카오 장소 상세 보기
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {realMapResults.length === 0 && (
                <p className="mt-3 text-xs text-slate-500">
                  현재 위치 확인 후 지도를 원하는 위치로 옮겨 다시 검색해보세요.
                </p>
              )}
            </article>
          </section>
        )}

        {activeTab === "post" && (
          <section className="space-y-4">
            <article className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:rounded-2xl sm:p-5">
              <h2 className="text-lg font-bold">전체 글</h2>
              {isNoteLoading && (
                <p className="mt-3 text-sm text-slate-500">글 목록을 불러오는 중입니다.</p>
              )}
              {noteError && <p className="mt-3 text-sm text-rose-600">{noteError}</p>}
              <div className="mt-4 space-y-3">
                {notePosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/battery-note/${post.slug}`}
                    className="block rounded-xl border border-line bg-white p-3 transition hover:border-brand/40 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-slate-100">
                        <Image
                          src={post.thumbnailUrl}
                          alt={post.title}
                          fill
                          className="object-cover"
                          sizes="128px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                          {post.tags.map((tag) => (
                            <span key={`${post.id}-${tag}`} className="font-semibold text-brand">
                              {tag}
                            </span>
                          ))}
                          <span>·</span>
                          <span>{formatKoreanDate(post.publishedAt)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">
                          {post.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                          {post.excerpt}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {!isNoteLoading && notePosts.length === 0 && !noteError && (
                <p className="mt-3 text-sm text-slate-500">
                  아직 발행된 배터리노트가 없습니다.
                </p>
              )}
            </article>
          </section>
        )}

        {activeTab === "mycar" && (
          <section className="space-y-4">
            <article className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:rounded-2xl sm:p-5">
              <h2 className="text-lg font-bold">내차관리</h2>
              <p className="mt-2 text-sm text-slate-600">
                로그인 후 내 차량관리 기능을 사용 할 수 있습니다.
              </p>

              {isAuthLoading ? (
                <p className="mt-4 text-sm text-slate-500">계정 정보를 확인 중입니다.</p>
              ) : authUser ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-line bg-white p-4">
                    <p className="text-sm font-semibold">{authUser.name} 님</p>
                    <p className="mt-1 text-xs text-slate-600">{authUser.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      권한: {authUser.role === "ADMIN" ? "관리자" : "일반회원"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isAuthSubmitting}
                        className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        로그아웃
                      </button>
                      {authUser.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white"
                        >
                          관리자 페이지
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-white p-4">
                    <h3 className="text-sm font-semibold">차량 등록 및 정보 조회</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      직접 입력 없이 국산/수입부터 순서대로 선택하면 차량 정보를 등록할 수 있습니다.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <select
                        value={carProfile.origin}
                        onChange={(event) => {
                          const nextOrigin = event.target.value as OriginType | "";
                          setCarProfile((prev) => ({
                            ...prev,
                            origin: nextOrigin,
                            brand: "",
                            model: "",
                            year: "",
                            fuelType: "",
                          }));
                        }}
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <option value="">차량 구분 선택</option>
                        {ORIGIN_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <select
                        value={carProfile.brand}
                        onChange={(event) => {
                          const nextBrand = event.target.value;
                          setCarProfile((prev) => ({
                            ...prev,
                            brand: nextBrand,
                            model: "",
                            year: "",
                            fuelType: "",
                          }));
                        }}
                        disabled={!carProfile.origin}
                        className={`w-full rounded-lg border border-line px-3 py-2 text-sm ${
                          !carProfile.origin ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
                        }`}
                      >
                        <option value="">브랜드 선택</option>
                        {mycarBrandOptions.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={carProfile.model}
                        onChange={(event) => {
                          const nextModel = event.target.value;
                          setCarProfile((prev) => ({
                            ...prev,
                            model: nextModel,
                            year: "",
                            fuelType: "",
                          }));
                        }}
                        disabled={!carProfile.brand}
                        className={`w-full rounded-lg border border-line px-3 py-2 text-sm ${
                          !carProfile.brand ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
                        }`}
                      >
                        <option value="">모델 선택</option>
                        {mycarModelOptions.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={carProfile.year}
                        onChange={(event) => {
                          const nextYear = event.target.value;
                          setCarProfile((prev) => ({
                            ...prev,
                            year: nextYear,
                            fuelType: "",
                          }));
                        }}
                        disabled={!carProfile.model}
                        className={`w-full rounded-lg border border-line px-3 py-2 text-sm ${
                          !carProfile.model ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
                        }`}
                      >
                        <option value="">연식 선택</option>
                        {mycarYearOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <select
                        value={carProfile.fuelType}
                        onChange={(event) =>
                          setCarProfile((prev) => ({ ...prev, fuelType: event.target.value }))
                        }
                        disabled={!carProfile.year}
                        className={`w-full rounded-lg border border-line px-3 py-2 text-sm ${
                          !carProfile.year ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""
                        }`}
                      >
                        <option value="">연료 선택</option>
                        {mycarFuelOptions.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={carProfile.mileage}
                        onChange={(event) =>
                          setCarProfile((prev) => ({ ...prev, mileage: event.target.value }))
                        }
                        placeholder="현재 주행거리 입력 (km)"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !carProfile.origin ||
                            !carProfile.brand ||
                            !carProfile.model ||
                            !carProfile.year ||
                            !carProfile.fuelType ||
                            !carProfile.mileage
                          ) {
                            setMycarMessage("차량 정보를 순서대로 모두 선택/입력해주세요.");
                            return;
                          }
                          setMycarMessage("차량 정보를 저장했습니다.");
                        }}
                        className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
                      >
                        차량정보 저장
                      </button>
                      {estimatedMarket ? (
                        <p className="text-xs text-slate-600">
                          예상 시세(참고): {formatWon(estimatedMarket.min)} ~{" "}
                          {formatWon(estimatedMarket.max)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          연식/주행거리를 입력하면 예상 시세가 표시됩니다.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-white p-4">
                    <h3 className="text-sm font-semibold">소모품 교체 주기 알림</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      현재 주행거리 기준으로 엔진오일, 브레이크 패드, 타이어 교체 시점을 계산합니다.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input
                        value={consumables.engineOilKm}
                        onChange={(event) =>
                          setConsumables((prev) => ({
                            ...prev,
                            engineOilKm: event.target.value,
                          }))
                        }
                        placeholder="엔진오일 교체 km"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <input
                        value={consumables.brakePadKm}
                        onChange={(event) =>
                          setConsumables((prev) => ({
                            ...prev,
                            brakePadKm: event.target.value,
                          }))
                        }
                        placeholder="브레이크패드 교체 km"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <input
                        value={consumables.tireKm}
                        onChange={(event) =>
                          setConsumables((prev) => ({ ...prev, tireKm: event.target.value }))
                        }
                        placeholder="타이어 교체 km"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                      {[
                        { label: "엔진오일", remaining: engineOilRemaining },
                        { label: "브레이크패드", remaining: brakePadRemaining },
                        { label: "타이어", remaining: tireRemaining },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-line bg-slate-50 px-3 py-2">
                          <p className="font-semibold text-slate-700">{item.label}</p>
                          <p
                            className={`mt-1 ${
                              item.remaining !== null && item.remaining <= 1000
                                ? "text-rose-600"
                                : "text-slate-600"
                            }`}
                          >
                            {item.remaining === null
                              ? "주행거리/교체 km 입력 필요"
                              : item.remaining <= 0
                                ? "지금 교체 권장"
                                : `${item.remaining.toLocaleString()}km 후 교체 권장`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-line bg-white p-4">
                    <h3 className="text-sm font-semibold">차계부 연동</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      주유비, 정비비를 기록해 유지비를 관리합니다.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        value={ledgerDraft.date}
                        onChange={(event) =>
                          setLedgerDraft((prev) => ({ ...prev, date: event.target.value }))
                        }
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <select
                        value={ledgerDraft.category}
                        onChange={(event) =>
                          setLedgerDraft((prev) => ({
                            ...prev,
                            category: event.target.value as LedgerDraft["category"],
                          }))
                        }
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <option value="주유">주유</option>
                        <option value="정비">정비</option>
                        <option value="세차">세차</option>
                        <option value="보험">보험</option>
                        <option value="기타">기타</option>
                      </select>
                      <input
                        value={ledgerDraft.amount}
                        onChange={(event) =>
                          setLedgerDraft((prev) => ({ ...prev, amount: event.target.value }))
                        }
                        placeholder="금액(원)"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <input
                        value={ledgerDraft.mileage}
                        onChange={(event) =>
                          setLedgerDraft((prev) => ({ ...prev, mileage: event.target.value }))
                        }
                        placeholder="기록 시 주행거리(km)"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      />
                      <input
                        value={ledgerDraft.memo}
                        onChange={(event) =>
                          setLedgerDraft((prev) => ({ ...prev, memo: event.target.value }))
                        }
                        placeholder="메모 (예: 엔진오일 교환)"
                        className="w-full rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddLedgerEntry}
                        className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
                      >
                        차계부 저장
                      </button>
                      <p className="text-xs text-slate-600">
                        총 누적 비용: {formatWon(totalLedgerCost)}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {ledgerEntries.slice(0, 8).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start justify-between rounded-lg border border-line bg-slate-50 px-3 py-2"
                        >
                          <div>
                            <p className="text-xs font-semibold text-slate-700">
                              {entry.category} · {formatWon(entry.amount)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {entry.date}
                              {entry.mileage ? ` · ${entry.mileage}km` : ""}
                              {entry.memo ? ` · ${entry.memo}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLedgerEntry(entry.id)}
                            className="text-[11px] font-semibold text-slate-500"
                          >
                            삭제
                          </button>
                        </div>
                      ))}
                      {ledgerEntries.length === 0 && (
                        <p className="text-xs text-slate-500">
                          아직 기록된 차계부 내역이 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-line bg-white p-4">
                  {authView === "login" ? (
                    <>
                      <p className="text-sm font-semibold">로그인</p>
                      <div className="mt-3 space-y-2">
                        <input
                          value={loginEmail}
                          onChange={(event) => setLoginEmail(event.target.value)}
                          placeholder="이메일"
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(event) => setLoginPassword(event.target.value)}
                          placeholder="비밀번호"
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleLogin}
                          disabled={isAuthSubmitting}
                          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          로그인
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView("register");
                          setAuthMessage("");
                        }}
                        className="mt-3 text-xs font-semibold text-brand"
                      >
                        회원가입 하러가기
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">회원가입</p>
                      <div className="mt-3 space-y-2">
                        <input
                          value={registerName}
                          onChange={(event) => setRegisterName(event.target.value)}
                          placeholder="이름"
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                        <input
                          value={registerEmail}
                          onChange={(event) => setRegisterEmail(event.target.value)}
                          placeholder="이메일"
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                        <input
                          type="password"
                          value={registerPassword}
                          onChange={(event) => setRegisterPassword(event.target.value)}
                          placeholder="비밀번호 (8자 이상)"
                          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={isAuthSubmitting}
                          className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          회원가입
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView("login");
                          setAuthMessage("");
                        }}
                        className="mt-3 text-xs font-semibold text-brand"
                      >
                        로그인으로 돌아가기
                      </button>
                    </>
                  )}
                </div>
              )}

              {mycarMessage && (
                <p
                  className={`mt-3 text-xs ${
                    mycarMessage.includes("오류") || mycarMessage.includes("실패")
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}
                >
                  {mycarMessage}
                </p>
              )}
              {authMessage && <p className="mt-3 text-xs text-slate-600">{authMessage}</p>}
            </article>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
        <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-semibold leading-tight transition ${
                activeTab === tab.key
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <TabPictogram tab={tab.key} />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
