import { NextResponse } from "next/server";

type BatteryOrigin = "rocket" | "delkor" | "hankook";

type CompatibleBatteryItem = {
  id: string;
  name: string;
  brand: string;
  origin: BatteryOrigin;
  spec: string;
  productCode?: string;
  productUrl: string;
  imageUrl?: string;
  note?: string;
};

type CacheEntry = {
  fetchedAt: number;
  items: CompatibleBatteryItem[];
};

type HankookCodeRow = {
  code: string;
  codeName: string;
};

type HankookProductRow = {
  btryId?: string;
  btryName?: string;
  modelName?: string;
  series?: string;
  capa20hr?: string;
  ccaA?: string;
  rc?: string;
  thumbFilePath?: string;
  attachFilePath?: string;
};

type DelkorModelRow = {
  name: string;
  engines: string[];
};

type DelkorProductRow = {
  ProductTitle?: string;
  PartNumberDisplay?: string;
  ProductUrl?: string;
  PrimaryImageUrl?: string;
  Cca?: string;
  Ah20?: string;
  Rc?: string;
  Polarity?: string;
  Length?: string;
  Width?: string;
  Height?: string;
};

type DelkorCatalogProductRow = {
  UrlName?: string;
  PartNumberDisplay?: string;
  ProductName?: string;
  Cca?: string;
  Ah20?: string;
  Rc?: string;
  Polarity?: string;
  Length?: string;
  Width?: string;
  Height?: string;
};

type OdataList<T> = {
  value: T[];
};

type SearchContext = {
  trimId: number;
  originLabel: string;
  brandName: string;
  modelName: string;
  yearLabel: string;
  engineLabel: string;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const CACHE_VERSION = "v3";

const ROCKET_BASE_URL = "https://rocketbattery.kr";
const HANKOOK_BASE_URL = "https://www.hankook-battery.com";
const DELKOR_BASE_URL = "https://www.delkor.com";
const DELKOR_PRODUCT_PROVIDER = "dynamicProvider7";
const DELKOR_PRODUCT_CULTURE = "ko";

const HANKOOK_SEARCH_URL = `${HANKOOK_BASE_URL}/ko/product/search`;

const memoryCache = new Map<string, CacheEntry>();

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number(code);
      if (!Number.isFinite(parsed)) {
        return "";
      }
      return String.fromCharCode(parsed);
    });
}

function normalizeText(raw: string) {
  return stripTags(decodeHtml(raw));
}

function normalizeCode(raw: string) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function normalizeForMatch(raw: string) {
  return raw
    .toUpperCase()
    .replace(/자동차/g, "")
    .replace(/\s+/g, "")
    .replace(/[()\[\]{}'"._\-]/g, "");
}

function toAbsoluteUrl(base: string, url: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function extractProductCode(...candidates: string[]) {
  const patterns = [
    /\b(AGM\s*\d{2,3}[A-Z]{0,2})\b/i,
    /\b(DIN\s*\d{2,5}[A-Z]{0,3})\b/i,
    /\b(GB\s*\d{2,5}(?:-\d{2,3})?[A-Z]{0,3})\b/i,
    /\b(DF\s*\d{2,5}[A-Z]{0,3})\b/i,
    /\b(HK\s*\d{2,5}[A-Z]{0,3})\b/i,
    /\b(MF\s*\d{2,5}[A-Z]{0,3})\b/i,
  ];

  for (const text of candidates) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return normalizeCode(match[1]);
      }
    }
  }

  return undefined;
}

function extractCapacityAh(...candidates: string[]) {
  for (const text of candidates) {
    if (!text) {
      continue;
    }

    const ahMatch = text.match(/(\d{2,3})\s*AH/i);
    if (ahMatch) {
      const parsed = Number(ahMatch[1]);
      if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 230) {
        return parsed;
      }
    }

    const codeMatch = normalizeCode(text).match(
      /^(?:AGM|DIN|DF|GB|HK|MF)(\d{2,3})(?:[A-Z]|$)/,
    );
    if (codeMatch) {
      const parsed = Number(codeMatch[1]);
      if (Number.isFinite(parsed) && parsed >= 30 && parsed <= 230) {
        return parsed;
      }
    }
  }

  return null;
}

function parseYearToken(token: string) {
  const digits = token.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  const asNum = Number(digits);
  if (!Number.isFinite(asNum)) {
    return null;
  }

  if (digits.length === 4) {
    return asNum;
  }

  if (digits.length <= 2) {
    if (asNum >= 80) {
      return 1900 + asNum;
    }
    return 2000 + asNum;
  }

  return null;
}

function parseYearCandidates(yearLabel: string) {
  const nowYear = new Date().getFullYear();
  const clean = yearLabel.replace(/\s+/g, "");

  const rangeMatch = clean.match(/(\d{2,4})년?~(\d{2,4}|현재)/);
  if (rangeMatch) {
    const start = parseYearToken(rangeMatch[1]);
    const end =
      rangeMatch[2] === "현재" ? nowYear : parseYearToken(rangeMatch[2]) ?? nowYear;

    if (start && end && start <= end) {
      const years: number[] = [];
      for (let year = end; year >= start; year -= 1) {
        years.push(year);
        if (years.length >= 7) {
          break;
        }
      }
      return years;
    }
  }

  const singleMatch = clean.match(/(\d{2,4})년?/);
  if (singleMatch) {
    const year = parseYearToken(singleMatch[1]);
    if (year) {
      return [year];
    }
  }

  return [nowYear, nowYear - 1, nowYear - 2];
}

function scoreStringMatch(targetRaw: string, candidateRaw: string) {
  const target = normalizeForMatch(targetRaw);
  const candidate = normalizeForMatch(candidateRaw);

  if (!target || !candidate) {
    return -1;
  }

  if (target === candidate) {
    return 100;
  }

  if (candidate.startsWith(target) || target.startsWith(candidate)) {
    return 85;
  }

  if (candidate.includes(target) || target.includes(candidate)) {
    return 65;
  }

  let common = 0;
  for (const ch of target) {
    if (candidate.includes(ch)) {
      common += 1;
    }
  }

  return common >= Math.min(3, target.length) ? 25 + common : -1;
}

function pickBestCandidates<T>(
  list: T[],
  getLabel: (item: T) => string,
  target: string,
  limit: number,
) {
  return list
    .map((item) => ({
      item,
      score: scoreStringMatch(target, getLabel(item)),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.item);
}

function parseRocketProductsFromHtml(html: string): CompatibleBatteryItem[] {
  const blocks = [
    ...html.matchAll(
      /<li\s+id="anchorBoxId_(\d+)"[\s\S]*?<\/li>\s*(?=<li\s+id="anchorBoxId_|<\/ul>)/g,
    ),
  ];

  const seen = new Set<string>();
  const items: CompatibleBatteryItem[] = [];

  for (const block of blocks) {
    const productNo = block[1];
    const section = block[0];

    const productUrl = toAbsoluteUrl(
      ROCKET_BASE_URL,
      section.match(/href="(\/product\/detail\.html\?[^\"]+)"/)?.[1] ?? "",
    );
    const imageUrl = toAbsoluteUrl(
      ROCKET_BASE_URL,
      section.match(/class="df-prl-thumb-link"[\s\S]*?<img\s+src="([^"]+)"/)?.[1] ??
        "",
    );

    const name = normalizeText(
      section.match(
        /class="df-prl-name[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/a>/,
      )?.[1] ?? "",
    );

    const spec = normalizeText(
      section.match(
        /summary_desc[\s\S]*?<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/,
      )?.[1] ?? "",
    );

    const productCode = extractProductCode(spec, name);
    const itemId = productNo || `${name}-${productCode ?? "no-code"}`;

    if (!name || seen.has(itemId)) {
      continue;
    }

    seen.add(itemId);

    items.push({
      id: `rocket-${itemId}`,
      name,
      brand: "로케트",
      origin: "rocket",
      spec: spec || name,
      productCode,
      productUrl,
      imageUrl: imageUrl || undefined,
    });
  }

  return items;
}

async function fetchRocketBatteries(trimId: number) {
  const endpoint = `${ROCKET_BASE_URL}/product/list.html?cate_no=${trimId}`;

  const response = await fetch(endpoint, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Rocket category ${trimId} (${response.status})`);
  }

  const html = await response.text();
  return parseRocketProductsFromHtml(html);
}

function mapBrandCandidatesForHankook(brandName: string) {
  const normalized = normalizeForMatch(brandName);

  const map: Record<string, string[]> = {
    현대: ["현대", "HYUNDAI"],
    기아: ["기아", "KIA"],
    르노삼성: ["르노삼성", "RENAULT SAMSUNG", "RENAULT"],
    르노: ["르노삼성", "RENAULT"],
    쌍용: ["쌍용", "SSANGYONG"],
    쉐보레: ["한국 지엠", "GM", "CHEVROLET"],
    한국지엠: ["한국 지엠", "GM", "CHEVROLET"],
    제네시스: ["현대", "GENESIS"],
    벤츠: ["MERCEDES-BENZ"],
    bmw: ["BMW"],
    아우디: ["AUDI"],
    폭스바겐: ["VOLKSWAGEN"],
    볼보: ["VOLVO"],
    포드: ["FORD"],
    혼다: ["HONDA"],
    닛산: ["NISSAN"],
    토요타: ["TOYOTA"],
    렉서스: ["LEXUS"],
    푸조: ["PEUGEOT"],
    지프: ["JEEP"],
    랜드로버: ["LANDROVER", "LAND ROVER"],
  };

  for (const [key, values] of Object.entries(map)) {
    if (normalized.includes(normalizeForMatch(key))) {
      return values;
    }
  }

  return [brandName];
}

function mapBrandCandidatesForDelkor(brandName: string) {
  const normalized = normalizeForMatch(brandName);

  const map: Record<string, string[]> = {
    현대: ["HYUNDAI"],
    기아: ["KIA"],
    르노삼성: ["RENAULT SAMSUNG"],
    르노: ["RENAULT SAMSUNG"],
    쌍용: ["SSANGYONG"],
    쉐보레: ["GM"],
    한국지엠: ["GM"],
    벤츠: ["MERCEDES-BENZ"],
    bmw: ["BMW"],
    아우디: ["AUDI"],
    폭스바겐: ["VOLKSWAGEN"],
    볼보: ["VOLVO"],
    포드: ["FORD"],
    혼다: ["HONDA"],
    닛산: ["NISSAN"],
    토요타: ["TOYOTA"],
    렉서스: ["LEXUS"],
    푸조: ["PEUGEOT"],
    지프: ["JEEP"],
    랜드로버: ["LANDROVER"],
    미니: ["MINI"],
    캐딜락: ["CADILLAC"],
    링컨: ["LINCOLN"],
  };

  for (const [key, values] of Object.entries(map)) {
    if (normalized.includes(normalizeForMatch(key))) {
      return values;
    }
  }

  return [brandName.toUpperCase()];
}

function mapModelCandidatesForDelkor(modelName: string) {
  const normalized = normalizeForMatch(modelName);

  const map: Record<string, string[]> = {
    레이: ["RAY"],
    모닝: ["MORNING", "ALL NEW MORNING"],
    카니발: ["CARNIVAL", "ALL NEW CARNIVAL"],
    쏘렌토: ["SORENTO", "ALL NEW SORENTO"],
    쏘울: ["SOUL", "ALL NEW SOUL"],
    스포티지: ["SPORTAGE", "SPORTAGE THE BOLD"],
    스토닉: ["STONIC"],
    스팅어: ["STINGER"],
    셀토스: ["SELTOS"],
    니로: ["NIRO"],
    아반떼: ["AVANTE", "ELANTRA"],
    쏘나타: ["SONATA"],
    그랜저: ["GRANDEUR", "AZERA"],
    투싼: ["TUCSON"],
    싼타페: ["SANTA FE"],
    팰리세이드: ["PALISADE"],
    코나: ["KONA"],
    아이오닉: ["IONIQ"],
    티볼리: ["TIVOLI"],
    코란도: ["KORANDO"],
    렉스턴: ["REXTON"],
    말리부: ["MALIBU"],
    스파크: ["SPARK"],
    트랙스: ["TRAX"],
    트레일블레이저: ["TRAILBLAZER"],
  };

  for (const [key, values] of Object.entries(map)) {
    if (normalized.includes(normalizeForMatch(key))) {
      return [modelName, ...values];
    }
  }

  return [modelName];
}

async function postHankookJson<T>(path: string, param: Record<string, string>) {
  const response = await fetch(`${HANKOOK_SEARCH_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "application/json, text/javascript, */*; q=0.01",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      referer: `${HANKOOK_SEARCH_URL}.do`,
    },
    body: new URLSearchParams({ param: JSON.stringify(param) }).toString(),
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) {
    throw new Error(`Hankook API failed ${path} (${response.status})`);
  }

  return (await response.json()) as T;
}

function formatHankookSpec(row: HankookProductRow) {
  const specs: string[] = [];
  if (row.capa20hr && row.capa20hr !== "-") {
    specs.push(`20HR ${row.capa20hr}Ah`);
  }
  if (row.ccaA && row.ccaA !== "-") {
    specs.push(`CCA ${row.ccaA}A`);
  }
  if (row.rc && row.rc !== "-") {
    specs.push(`RC ${row.rc}`);
  }
  return specs.join(" / ") || row.series || "한국배터리 차량용";
}

async function fetchHankookBatteries(context: SearchContext) {
  if (!context.brandName || !context.modelName) {
    return [];
  }

  const makers = await postHankookJson<HankookCodeRow[]>("/code/list.do", {
    sMnfctCode: "",
    codeType: "sMnfctCode",
  });

  const makerCandidates = mapBrandCandidatesForHankook(context.brandName);
  const makerMatches = makerCandidates
    .flatMap((candidate) =>
      pickBestCandidates(makers, (row) => row.codeName, candidate, 1),
    )
    .slice(0, 1);

  if (makerMatches.length === 0) {
    return [];
  }

  const maker = makerMatches[0];
  const models = await postHankookJson<HankookCodeRow[]>("/code/list.do", {
    sMnfctCode: maker.code,
    codeType: "sModelName",
  });

  const modelCandidates = pickBestCandidates(
    models,
    (row) => row.codeName,
    context.modelName,
    2,
  );

  const yearCandidates = parseYearCandidates(context.yearLabel).map(String);
  const collected: CompatibleBatteryItem[] = [];

  for (const model of modelCandidates) {
    const years = await postHankookJson<HankookCodeRow[]>("/code/list.do", {
      sMnfctCode: maker.code,
      codeType: "sModelYear",
      sModelName: model.code,
    });

    const yearValues = new Set(years.map((item) => item.code));
    const matchedYears = yearCandidates.filter((year) => yearValues.has(year));
    const targetYears = (matchedYears.length > 0
      ? matchedYears
      : years.map((item) => item.code).sort().reverse()
    ).slice(0, 2);

    for (const year of targetYears) {
      const details = await postHankookJson<HankookCodeRow[]>("/code/list.do", {
        sMnfctCode: maker.code,
        codeType: "sModelDetail",
        sModelName: model.code,
        sModelYear: year,
      });

      const detailCandidates =
        details.length > 0
          ? pickBestCandidates(
              details,
              (row) => row.codeName,
              context.engineLabel || context.modelName,
              2,
            )
          : [];

      const targetDetails = (detailCandidates.length > 0
        ? detailCandidates
        : details.slice(0, 1)
      ).map((item) => item.code);

      const searchDetails = targetDetails.length > 0 ? targetDetails : [""];

      for (const detail of searchDetails) {
        const products = await postHankookJson<HankookProductRow[]>("/data.do", {
          sMnfctCode: maker.code,
          sModelName: model.code,
          sModelYear: year,
          sModelDetail: detail,
        });

        for (const row of products) {
          const code = extractProductCode(row.btryName ?? "", row.modelName ?? "");
          const name = (row.btryName || row.modelName || "").trim();

          if (!name) {
            continue;
          }

          collected.push({
            id: `hankook-${row.btryId ?? `${model.code}-${year}-${name}`}`,
            name,
            brand: "한국배터리",
            origin: "hankook",
            spec: formatHankookSpec(row),
            productCode: code,
            productUrl:
              row.attachFilePath && row.attachFilePath.length > 0
                ? row.attachFilePath
                : `${HANKOOK_SEARCH_URL}.do`,
            imageUrl:
              row.thumbFilePath && row.thumbFilePath.length > 0
                ? row.thumbFilePath
                : undefined,
          });
        }

        if (collected.length > 0) {
          return collected;
        }
      }
    }
  }

  return collected;
}

async function fetchDelkorJson<T>(path: string) {
  const response = await fetch(`${DELKOR_BASE_URL}${path}`, {
    headers: {
      accept: "application/json, text/plain, */*",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      referer: `${DELKOR_BASE_URL}/kr`,
    },
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) {
    throw new Error(`Delkor API failed ${path} (${response.status})`);
  }

  return (await response.json()) as T;
}

function buildEngineTokens(engineLabel: string) {
  const normalized = normalizeForMatch(engineLabel);
  const tokens: string[] = [];

  if (normalized.includes("가솔린") || normalized.includes("휘발유")) {
    tokens.push("GASOLINE");
  }
  if (normalized.includes("디젤")) {
    tokens.push("DIESEL");
  }
  if (normalized.includes("LPG")) {
    tokens.push("LPG");
  }
  if (normalized.includes("하이브리드")) {
    tokens.push("HYBRID");
  }
  if (normalized.includes("전기") || normalized.includes("EV")) {
    tokens.push("EV");
  }

  const displacement = engineLabel.match(/(\d\.\d)/)?.[1];
  return { tokens, displacement };
}

function pickDelkorEngine(engines: string[], engineLabel: string) {
  if (engines.length === 0) {
    return "";
  }

  const { tokens, displacement } = buildEngineTokens(engineLabel);
  const scored = engines
    .map((engine) => {
      const norm = normalizeForMatch(engine);
      let score = 0;

      for (const token of tokens) {
        if (norm.includes(token)) {
          score += 20;
        }
      }

      if (displacement && norm.includes(displacement.replace(".", ""))) {
        score += 30;
      }

      const textScore = scoreStringMatch(engineLabel, engine);
      if (textScore > 0) {
        score += textScore;
      }

      return { engine, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].engine : "";
}

function formatDelkorSpec(row: DelkorProductRow) {
  const specs: string[] = [];
  if (row.Cca) {
    specs.push(`CCA ${row.Cca}`);
  }
  if (row.Ah20) {
    specs.push(`20HR ${row.Ah20}Ah`);
  }
  if (row.Rc) {
    specs.push(`RC ${row.Rc}`);
  }
  if (row.Polarity) {
    specs.push(`극성 ${row.Polarity}`);
  }
  if (row.Length && row.Width && row.Height) {
    specs.push(`${row.Length}x${row.Width}x${row.Height}`);
  }
  return specs.join(" / ") || "델코 차량용";
}

function formatDelkorCatalogSpec(row: DelkorCatalogProductRow) {
  const specs: string[] = [];
  if (row.Cca) {
    specs.push(`CCA ${row.Cca}`);
  }
  if (row.Ah20) {
    specs.push(`20HR ${row.Ah20}Ah`);
  }
  if (row.Rc) {
    specs.push(`RC ${row.Rc}`);
  }
  if (row.Polarity) {
    specs.push(`극성 ${row.Polarity}`);
  }
  if (row.Length && row.Width && row.Height) {
    specs.push(`${row.Length}x${row.Width}x${row.Height}`);
  }
  return specs.join(" / ") || "델코 차량용";
}

function mapRocketCodeToDelkorCodes(code: string) {
  const normalized = normalizeCode(code);
  const candidates = new Set<string>();

  if (!normalized) {
    return [];
  }

  const addOrientationVariants = (value: string) => {
    candidates.add(value);
    if (value.endsWith("R")) {
      candidates.add(`${value.slice(0, -1)}L`);
    }
    if (value.endsWith("L")) {
      candidates.add(`${value.slice(0, -1)}R`);
    }
  };

  if (normalized.startsWith("GB") && normalized.length > 2) {
    const suffix = normalized.slice(2);
    addOrientationVariants(`DF${suffix}`);
    addOrientationVariants(`DIN${suffix}`);
  }

  if (
    normalized.startsWith("DF") ||
    normalized.startsWith("DIN") ||
    normalized.startsWith("AGM")
  ) {
    addOrientationVariants(normalized);
  }

  if (normalized.startsWith("DF") && normalized.length > 2) {
    addOrientationVariants(`DIN${normalized.slice(2)}`);
  }

  if (normalized.startsWith("DIN") && normalized.length > 3) {
    addOrientationVariants(`DF${normalized.slice(3)}`);
  }

  return [...candidates];
}

function filterRocketItemsByDelkorReference(
  rocketItems: CompatibleBatteryItem[],
  delkorItems: CompatibleBatteryItem[],
) {
  if (rocketItems.length === 0 || delkorItems.length === 0) {
    return rocketItems;
  }

  const delkorCodeSet = new Set(
    delkorItems
      .map((item) => item.productCode)
      .filter((code): code is string => Boolean(code))
      .flatMap((code) => {
        const normalized = normalizeCode(code);
        return mapRocketCodeToDelkorCodes(normalized).concat(normalized);
      }),
  );
  const delkorAhSet = new Set(
    delkorItems
      .map((item) =>
        extractCapacityAh(item.productCode ?? "", item.spec, item.name),
      )
      .filter((value): value is number => value !== null),
  );

  const byCodeOrAh = rocketItems.filter((item) => {
    const normalizedCode = normalizeCode(item.productCode ?? "");
    if (normalizedCode.length > 0) {
      const mapped = mapRocketCodeToDelkorCodes(normalizedCode);
      if (mapped.some((candidate) => delkorCodeSet.has(candidate))) {
        return true;
      }
    }

    const capacity = extractCapacityAh(item.productCode ?? "", item.spec, item.name);
    return capacity !== null && delkorAhSet.has(capacity);
  });

  if (byCodeOrAh.length > 0) {
    return dedupeItems(byCodeOrAh);
  }

  if (delkorAhSet.size === 0) {
    return [];
  }

  const targetAhs = [...delkorAhSet];
  const scored = rocketItems
    .map((item) => {
      const capacity = extractCapacityAh(item.productCode ?? "", item.spec, item.name);
      if (capacity === null) {
        return { item, gap: Number.POSITIVE_INFINITY };
      }
      const gap = Math.min(...targetAhs.map((target) => Math.abs(target - capacity)));
      return { item, gap };
    })
    .sort((a, b) => a.gap - b.gap);

  const bestGap = scored[0]?.gap ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(bestGap)) {
    return rocketItems;
  }

  const maxGap = Math.max(2, Math.min(5, bestGap));
  const nearMatched = scored.filter((entry) => entry.gap <= maxGap).map((entry) => entry.item);
  return nearMatched.length > 0 ? dedupeItems(nearMatched) : [];
}

async function fetchDelkorBatteriesByCodeFallback(rocketItems: CompatibleBatteryItem[]) {
  const candidateCodes = [
    ...new Set(
      rocketItems
        .map((item) => item.productCode ?? "")
        .flatMap((code) => mapRocketCodeToDelkorCodes(code)),
    ),
  ].slice(0, 8);

  if (candidateCodes.length === 0) {
    return [];
  }

  const allItems: CompatibleBatteryItem[] = [];

  for (const code of candidateCodes) {
    const filter = `PartNumberDisplay eq '${code.replace(/'/g, "''")}'`;
    const query = new URLSearchParams({
      $select:
        "UrlName,PartNumberDisplay,ProductName,Cca,Ah20,Rc,Polarity,Length,Width,Height",
      $filter: filter,
      sf_culture: DELKOR_PRODUCT_CULTURE,
      sf_provider: DELKOR_PRODUCT_PROVIDER,
    });

    const payload = await fetchDelkorJson<OdataList<DelkorCatalogProductRow>>(
      `/sfapi/default/products?${query.toString()}`,
    );

    for (const row of payload.value ?? []) {
      const name = (row.ProductName || row.PartNumberDisplay || "").trim();
      if (!name) {
        continue;
      }

      const productCode = extractProductCode(row.PartNumberDisplay ?? "", name);
      const urlName = row.UrlName ? `/${row.UrlName}` : "";

      allItems.push({
        id: `delkor-code-${productCode ?? name}`,
        name,
        brand: "델코",
        origin: "delkor",
        spec: formatDelkorCatalogSpec(row),
        productCode: productCode ?? row.PartNumberDisplay,
        productUrl: `${DELKOR_BASE_URL}/kr/products/product-details${urlName}`,
        note: "델코 차량 매칭 결과가 없어서 코드 기준으로 보강한 결과입니다.",
      });
    }
  }

  return dedupeItems(allItems);
}

async function fetchDelkorBatteries(context: SearchContext) {
  if (!context.brandName || !context.modelName) {
    return [];
  }

  const vehicleTypes = await fetchDelkorJson<string[]>(
    "/api/fitment/vehicletypes?region=kr",
  );
  const vehicleType =
    vehicleTypes.find((item) => normalizeForMatch(item) === normalizeForMatch("차량")) ??
    vehicleTypes[0] ??
    "차량";

  const years = await fetchDelkorJson<number[]>(
    `/api/fitment/years?region=kr&vehicletype=${encodeURIComponent(vehicleType)}`,
  );

  const candidates = parseYearCandidates(context.yearLabel);
  const yearSet = new Set(years);
  const targetYears = (candidates.filter((year) => yearSet.has(year)).length > 0
    ? candidates.filter((year) => yearSet.has(year))
    : [...years].sort((a, b) => b - a)
  ).slice(0, 2);

  const makeCandidates = mapBrandCandidatesForDelkor(context.brandName);
  const modelCandidates = mapModelCandidatesForDelkor(context.modelName);
  const collected: CompatibleBatteryItem[] = [];

  for (const year of targetYears) {
    const makes = await fetchDelkorJson<string[]>(
      `/api/fitment/makes?region=kr&vehicletype=${encodeURIComponent(
        vehicleType,
      )}&year=${year}`,
    );

    const matchedMakes = makeCandidates
      .flatMap((candidate) => pickBestCandidates(makes, (item) => item, candidate, 1))
      .slice(0, 1);

    if (matchedMakes.length === 0) {
      continue;
    }

    const make = matchedMakes[0];
    const models = await fetchDelkorJson<DelkorModelRow[]>(
      `/api/fitment/models?region=kr&vehicletype=${encodeURIComponent(
        vehicleType,
      )}&year=${year}&make=${encodeURIComponent(make)}`,
    );

    const modelMatches = modelCandidates
      .flatMap((candidate) =>
        pickBestCandidates(models, (item) => item.name, candidate, 2),
      )
      .filter(
        (value, index, array) =>
          array.findIndex((item) => item.name === value.name) === index,
      )
      .slice(0, 2);

    for (const model of modelMatches) {
      const pickedEngine = pickDelkorEngine(model.engines || [], context.engineLabel);
      const baseQuery =
        `/api/products/find?region=kr&year=${year}&make=${encodeURIComponent(
          make,
        )}&model=${encodeURIComponent(model.name)}&vehicleType=${encodeURIComponent(
          vehicleType,
        )}`;

      const withEngineQuery =
        pickedEngine.length > 0
          ? `${baseQuery}&engine=${encodeURIComponent(pickedEngine)}`
          : baseQuery;

      const withEngineResults = await fetchDelkorJson<DelkorProductRow[]>(
        withEngineQuery,
      );
      const products =
        withEngineResults.length > 0 || pickedEngine.length === 0
          ? withEngineResults
          : await fetchDelkorJson<DelkorProductRow[]>(baseQuery);

      for (const row of products) {
        const name = (row.ProductTitle || row.PartNumberDisplay || "").trim();
        if (!name) {
          continue;
        }

        const code = extractProductCode(
          row.PartNumberDisplay ?? "",
          row.ProductTitle ?? "",
        );

        collected.push({
          id: `delkor-${code ?? name}-${year}`,
          name,
          brand: "델코",
          origin: "delkor",
          spec: formatDelkorSpec(row),
          productCode: code ?? row.PartNumberDisplay,
          productUrl: `${DELKOR_BASE_URL}/kr/products/product-details${row.ProductUrl ?? ""}`,
          imageUrl: row.PrimaryImageUrl || undefined,
        });
      }

      if (collected.length > 0) {
        return collected;
      }
    }
  }

  return collected;
}

function dedupeItems(items: CompatibleBatteryItem[]) {
  const seen = new Set<string>();
  const deduped: CompatibleBatteryItem[] = [];

  for (const item of items) {
    const key = `${item.origin}:${item.brand}:${normalizeCode(item.productCode ?? item.name)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function buildCacheKey(context: SearchContext) {
  return [
    CACHE_VERSION,
    context.trimId,
    normalizeForMatch(context.originLabel),
    normalizeForMatch(context.brandName),
    normalizeForMatch(context.modelName),
    normalizeForMatch(context.yearLabel),
    normalizeForMatch(context.engineLabel),
  ].join("|");
}

async function fetchAllSources(context: SearchContext) {
  const rocketPromise = fetchRocketBatteries(context.trimId);
  const hankookPromise = fetchHankookBatteries(context);
  const delkorPromise = fetchDelkorBatteries(context);

  const [rocketResult, hankookResult, delkorResult] = await Promise.allSettled([
      rocketPromise,
      hankookPromise,
      delkorPromise,
    ]);

  const rocketItems = rocketResult.status === "fulfilled" ? rocketResult.value : [];
  const hankookItems = hankookResult.status === "fulfilled" ? hankookResult.value : [];
  const delkorItems = delkorResult.status === "fulfilled" ? delkorResult.value : [];
  const fallbackDelkorItems =
    delkorItems.length === 0
      ? await fetchDelkorBatteriesByCodeFallback(rocketItems).catch(() => [])
      : [];
  const mergedDelkorItems = delkorItems.length > 0 ? delkorItems : fallbackDelkorItems;
  const matchedRocketItems = filterRocketItemsByDelkorReference(
    rocketItems,
    mergedDelkorItems,
  );

  if (
    matchedRocketItems.length === 0 &&
    hankookItems.length === 0 &&
    mergedDelkorItems.length === 0
  ) {
    const reason = [rocketResult, hankookResult, delkorResult]
      .filter((item) => item.status === "rejected")
      .map((item) => (item as PromiseRejectedResult).reason)
      .map((reason) => (reason instanceof Error ? reason.message : String(reason)))
      .join(" | ");

    throw new Error(reason || "No battery data available");
  }

  return dedupeItems([...matchedRocketItems, ...mergedDelkorItems, ...hankookItems]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trimId = Number(searchParams.get("trimId"));

  if (!Number.isInteger(trimId) || trimId <= 0) {
    return NextResponse.json(
      { error: "trimId는 1 이상의 정수여야 합니다." },
      { status: 400 },
    );
  }

  const context: SearchContext = {
    trimId,
    originLabel: searchParams.get("origin") ?? "",
    brandName: searchParams.get("brandName") ?? "",
    modelName: searchParams.get("modelName") ?? "",
    yearLabel: searchParams.get("yearLabel") ?? "",
    engineLabel: searchParams.get("engineLabel") ?? "",
  };

  const cacheKey = buildCacheKey(context);
  const cached = memoryCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      trimId,
      context,
      items: cached.items,
      cached: true,
    });
  }

  try {
    const items = await fetchAllSources(context);

    memoryCache.set(cacheKey, {
      fetchedAt: now,
      items,
    });

    return NextResponse.json({
      trimId,
      context,
      items,
      cached: false,
    });
  } catch (error) {
    if (cached) {
      return NextResponse.json({
        trimId,
        context,
        items: cached.items,
        cached: true,
        stale: true,
      });
    }

    return NextResponse.json(
      {
        error: "호환 배터리 데이터를 가져오지 못했습니다.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
