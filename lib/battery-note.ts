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

export function buildUnsplashSourceUrl(keyword: string, sig: number) {
  const encoded = encodeURIComponent(keyword.trim() || "car battery");
  return `https://source.unsplash.com/1600x900/?${encoded}&sig=${sig}`;
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

  return {
    title,
    excerpt,
    content,
    tags: tags.length > 0 ? tags : ["#배터리관리", "#자동차점검"],
    imageKeywords:
      imageKeywords.length >= 3
        ? imageKeywords.slice(0, 3)
        : ["car battery", "auto repair shop", "car maintenance"],
  };
}
