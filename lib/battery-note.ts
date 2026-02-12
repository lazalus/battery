export type BatteryNotePreview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnailUrl: string;
  tags: string[];
  publishedAt: string;
};

export type BatteryNoteDetail = BatteryNotePreview & {
  content: string;
  bodyImageUrls: string[];
};

export type GeneratedBatteryNote = {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  imageKeywords: string[];
  subtitle?: string;
};

type GeneratedSection = {
  heading: string;
  body: string;
};

export function safeStringArray(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export function normalizeTags(tags: string[]) {
  return tags
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .map((tag) => tag.replace(/\s+/g, ""))
    .filter((tag, index, array) => tag.length > 1 && array.indexOf(tag) === index)
    .slice(0, 4);
}

function keywordToImageTags(keyword: string) {
  const normalized = (keyword || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const englishTokens = normalized
    .split(" ")
    .filter((token) => /^[a-z0-9-]{2,}$/.test(token))
    .slice(0, 4);

  const koreanHints: string[] = [];
  if (/배터리|밧데리/.test(normalized)) {
    koreanHints.push("battery");
  }
  if (/자동차|차량|승용차|수입차|국산차/.test(normalized)) {
    koreanHints.push("car");
  }
  if (/정비|수리|점검|교체/.test(normalized)) {
    koreanHints.push("mechanic");
  }
  if (/엔진|시동/.test(normalized)) {
    koreanHints.push("engine");
  }
  if (/겨울|한파/.test(normalized)) {
    koreanHints.push("winter");
  }

  const merged = Array.from(
    new Set([...englishTokens, ...koreanHints, "car", "battery"]),
  ).slice(0, 4);

  return merged.length > 0 ? merged : ["car", "battery"];
}

export function buildUnsplashSourceUrl(keyword: string, sig: number) {
  const tags = keywordToImageTags(keyword);
  const encodedTagPath = tags.map((tag) => encodeURIComponent(tag)).join(",");
  const lock = Number.isFinite(sig) ? Math.max(1, Math.floor(sig)) : 1;
  return `https://loremflickr.com/1600/900/${encodedTagPath}?lock=${lock}`;
}

export function normalizeNoteImageUrl(
  input: string | null | undefined,
  sig: number,
  fallbackKeyword = "car battery",
) {
  if (!input || typeof input !== "string") {
    return buildUnsplashSourceUrl(fallbackKeyword, sig);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return buildUnsplashSourceUrl(fallbackKeyword, sig);
  }

  // 과거 source.unsplash URL은 현재 응답 실패가 빈번해서 새 공급원으로 치환.
  if (trimmed.includes("source.unsplash.com")) {
    try {
      const parsed = new URL(trimmed);
      const keys = [...parsed.searchParams.keys()].filter((key) => key !== "sig");
      const derivedKeyword = keys[0] ? decodeURIComponent(keys[0]) : fallbackKeyword;
      return buildUnsplashSourceUrl(derivedKeyword, sig);
    } catch {
      return buildUnsplashSourceUrl(fallbackKeyword, sig);
    }
  }

  return trimmed;
}

export function toSlug(input: string) {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized;
}

export function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function sanitizeGeneratedNote(raw: Record<string, unknown>): GeneratedBatteryNote {
  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title.trim()
      : "배터리 관리 핵심 가이드";
  const excerpt =
    typeof raw.excerpt === "string" && raw.excerpt.trim().length > 0
      ? raw.excerpt.trim()
      : "자동차 배터리 관리와 교체 시 꼭 확인해야 할 핵심 포인트를 정리했습니다.";
  const content =
    typeof raw.content === "string" && raw.content.trim().length > 0
      ? raw.content.trim()
      : "배터리 상태 점검과 교체 주기는 차량 운행 안정성에 직접적인 영향을 줍니다.";
  const tags = normalizeTags(safeStringArray(raw.tags));
  const imageKeywords = safeStringArray(raw.imageKeywords);
  const subtitle =
    typeof raw.subtitle === "string" && raw.subtitle.trim().length > 0
      ? raw.subtitle.trim()
      : "";

  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: GeneratedSection[] = rawSections
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const heading =
        typeof record.heading === "string" && record.heading.trim().length > 0
          ? record.heading.trim()
          : "";
      const body =
        typeof record.body === "string" && record.body.trim().length > 0
          ? record.body.trim()
          : "";
      if (!heading || !body) {
        return null;
      }
      return { heading, body };
    })
    .filter((item): item is GeneratedSection => Boolean(item))
    .slice(0, 8);

  const sectionContent =
    sections.length > 0
      ? sections
          .map((section) => `## ${section.heading}\n\n${section.body}`)
          .join("\n\n")
      : content;

  const composedContent = subtitle
    ? `부제: ${subtitle}\n\n${sectionContent}`
    : sectionContent;

  return {
    title,
    excerpt,
    content: composedContent,
    tags: tags.length > 0 ? tags : ["#배터리관리", "#자동차점검"],
    imageKeywords:
      imageKeywords.length >= 3
        ? imageKeywords.slice(0, 3)
        : ["car battery", "auto repair shop", "car maintenance"],
    subtitle: subtitle || undefined,
  };
}
