import vehicleCatalog from "@/data/vehicle-catalog.json";

export type VehicleCatalogBrand = (typeof vehicleCatalog.brands)[number];
export type VehicleCatalogModel = VehicleCatalogBrand["models"][number];

export const VEHICLE_CATALOG_BRANDS = vehicleCatalog.brands as VehicleCatalogBrand[];

const BRAND_SLUG_MAP: Record<string, string> = {
  현대자동차: "hyundai",
  기아자동차: "kia",
  제네시스: "genesis",
  벤츠: "benz",
  BMW: "bmw",
  아우디: "audi",
  폭스바겐: "volkswagen",
  볼보: "volvo",
  렉서스: "lexus",
  도요타: "toyota",
  토요타: "toyota",
  혼다: "honda",
  닛산: "nissan",
  포드: "ford",
  지프: "jeep",
  쉐보레: "chevrolet",
  "쉐보레/GM": "chevrolet-gm",
  르노삼성: "renault-samsung",
  쌍용자동차: "kgmobility",
  KG모빌리티: "kgmobility",
  푸조: "peugeot",
  시트로엥: "citroen",
  랜드로버: "landrover",
  재규어: "jaguar",
  미니: "mini",
  포르쉐: "porsche",
  테슬라: "tesla",
};

export function getCarBatteryBrandHubPath(brandId: number | string) {
  return `/car-battery/${brandId}`;
}

export function getBrandSlug(brand: Pick<VehicleCatalogBrand, "id" | "name">) {
  const mapped = BRAND_SLUG_MAP[brand.name];
  if (mapped) {
    return mapped;
  }

  const fallback = brand.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return fallback || `brand-${brand.id}`;
}

export function getBrandBatterySlugPath(brandOrSlug: Pick<VehicleCatalogBrand, "id" | "name"> | string) {
  const slug = typeof brandOrSlug === "string" ? brandOrSlug : getBrandSlug(brandOrSlug);
  return `/brand-battery/${slug}`;
}

export function getCarBatteryLandingPath(brandId: number | string, modelId: number | string) {
  return `/car-battery/${brandId}/${modelId}`;
}

export function findCatalogBrand(brandId: string) {
  return VEHICLE_CATALOG_BRANDS.find((item) => String(item.id) === String(brandId)) ?? null;
}

export function findCatalogBrandBySlug(brandSlug: string) {
  const normalized = (brandSlug || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return (
    VEHICLE_CATALOG_BRANDS.find((brand) => getBrandSlug(brand).toLowerCase() === normalized) ?? null
  );
}

export function findCatalogBrandModel(brandId: string, modelId: string) {
  const brand = findCatalogBrand(brandId);
  if (!brand) {
    return null;
  }
  const model = brand.models.find((item) => String(item.id) === String(modelId));
  if (!model) {
    return null;
  }
  return { brand, model };
}

export function extractModelYearSummary(trims: { name: string }[]) {
  const years = new Set<number>();
  for (const trim of trims) {
    const matches = trim.name.match(/\(([^)]+)\)\s*$/);
    const yearChunk = matches?.[1] ?? "";
    const numbers = yearChunk.match(/\d{4}/g) ?? [];
    for (const token of numbers) {
      const year = Number(token);
      if (Number.isFinite(year) && year >= 1980 && year <= 2100) {
        years.add(year);
      }
    }
  }

  const sorted = [...years].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {
      minYear: null,
      maxYear: null,
      label: "연식 범위 확인 필요",
    };
  }

  return {
    minYear: sorted[0],
    maxYear: sorted[sorted.length - 1],
    label:
      sorted[0] === sorted[sorted.length - 1]
        ? `${sorted[0]}년식`
        : `${sorted[0]}~${sorted[sorted.length - 1]}년식`,
  };
}

export function listAllCatalogBrandModels() {
  return VEHICLE_CATALOG_BRANDS.flatMap((brand) =>
    brand.models.map((model) => ({ brand, model })),
  );
}

export function listCatalogBrands() {
  return VEHICLE_CATALOG_BRANDS;
}

export function findRelevantCatalogBrandModelsByText(text: string, limit = 3) {
  const normalized = (text || "").toLowerCase();
  if (!normalized.trim()) {
    return [];
  }

  const matches: Array<{
    brand: VehicleCatalogBrand;
    model: VehicleCatalogModel;
    score: number;
  }> = [];

  for (const brand of VEHICLE_CATALOG_BRANDS) {
    const brandHit = normalized.includes(brand.name.toLowerCase());
    for (const model of brand.models) {
      const modelHit = normalized.includes(model.name.toLowerCase());
      if (!modelHit) {
        continue;
      }
      let score = model.name.length;
      if (brandHit) {
        score += 50;
      }
      matches.push({ brand, model, score });
    }
  }

  const deduped = new Map<string, (typeof matches)[number]>();
  for (const item of matches.sort((a, b) => b.score - a.score)) {
    const key = `${item.brand.id}:${item.model.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].slice(0, Math.max(1, Math.min(8, limit)));
}
