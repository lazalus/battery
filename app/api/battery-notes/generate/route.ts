import { NextResponse } from "next/server";
import {
  batteryNoteSlugExists,
  createBatteryNoteDraft,
  listRecentBatteryNoteTitles,
} from "@/lib/battery-note-repository";
import {
  buildUnsplashSourceUrl,
  extractJsonObject,
  sanitizeGeneratedNote,
  toSlug,
} from "@/lib/battery-note";
import { ensureBatteryNoteSchema } from "@/lib/ensure-battery-note-schema";
import { readSessionFromRequest } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/ensure-auth-schema";
import { findUserById } from "@/lib/user-repository";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-3-flash": "gemini-2.5-flash",
  "gemini-3-pro": "gemini-2.5-pro",
};

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const GEMINI_IMAGE_MODEL_ALIASES: Record<string, string> = {
  "gemini-3-flash-image": "gemini-2.5-flash-image",
  "gemini-3-image": "gemini-2.5-flash-image",
  "gemini-image": "gemini-2.5-flash-image",
};

const GEMINI_IMAGE_FALLBACK_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-preview-image-generation",
];

type LocalNoteTemplate = {
  title: string;
  subtitle: string;
  excerpt: string;
  tags: string[];
  sections: Array<{
    heading: string;
    body: string;
  }>;
  imageKeywords: [string, string, string];
};

const LOCAL_NOTE_TEMPLATES: LocalNoteTemplate[] = [
  {
    title: "겨울철 배터리 방전, 점검 순서만 지켜도 예방됩니다",
    subtitle: "한파 전에 확인할 전압, 단자, 충전 상태를 실제 점검 순서로 정리했습니다.",
    excerpt:
      "겨울철 방전은 배터리 자체보다 관리 루틴 부족에서 시작되는 경우가 많습니다. 기본 점검 순서를 짧게 정리했습니다.",
    tags: ["#배터리관리", "#겨울점검", "#시동불량"],
    sections: [
      {
        heading: "시동 전 전압부터 확인하기",
        body: "아침 시동 전 배터리 전압을 먼저 확인하면 상태를 빠르게 파악할 수 있습니다. 일반적으로 정차 상태에서 12V대 초중반이 유지되는지 확인하고, 반복적으로 낮게 나오면 충전 상태 점검이 필요합니다. 단순 방전인지 성능 저하인지 구분하는 첫 단계가 전압 확인입니다.",
      },
      {
        heading: "단자 부식과 체결 상태 점검",
        body: "전압이 정상이어도 단자 접촉 불량이면 시동 반응이 둔해집니다. 단자 주변의 백색 가루나 녹이 보이면 청소 후 재체결하고, 흔들림이 없는지 확인해야 합니다. 단자 저항이 커지면 점프 후에도 재방전이 반복될 수 있습니다.",
      },
      {
        heading: "짧은 거리 주행이 반복될 때 생기는 문제",
        body: "도심에서 짧은 거리만 반복 주행하면 발전기 충전 시간이 부족해 배터리가 완전히 회복되지 않습니다. 히터, 열선, 오디오 사용량이 많은 계절에는 이 현상이 더 빠르게 누적됩니다. 주 1회 정도는 충분한 주행 시간을 확보해 충전 여유를 만들어야 합니다.",
      },
      {
        heading: "교체 시기 판단 기준",
        body: "시동 지연, 전조등 밝기 저하, 계기판 경고등 같은 신호가 함께 나타나면 교체 시기를 의심해야 합니다. 최근 교체 이력이 오래됐고 전압 저하가 반복되면 사양 확인 후 교체하는 것이 안전합니다. 계절이 바뀌기 전 선제 점검이 가장 효율적입니다.",
      },
    ],
    imageKeywords: ["car battery winter", "car battery terminal", "car maintenance"],
  },
  {
    title: "배터리 교체 전 확인할 규격: 용량보다 먼저 봐야 할 항목",
    subtitle: "AH 수치만 보는 실수를 줄이기 위해 단자 방향, 타입, 장착 규격을 우선순위로 정리했습니다.",
    excerpt:
      "배터리 호환성은 용량 한 가지로 결정되지 않습니다. 교체 전에 꼭 확인해야 할 기본 규격을 실제 사례 기준으로 정리했습니다.",
    tags: ["#배터리교체", "#호환규격", "#차량정비"],
    sections: [
      {
        heading: "단자 방향과 케이스 규격 확인",
        body: "같은 용량이라도 단자 위치가 반대면 장착이 어렵거나 배선에 무리가 생깁니다. 먼저 기존 배터리의 단자 방향과 케이스 규격을 확인하고, 브라켓 고정 위치까지 함께 살펴야 합니다. 이 항목은 용량보다 우선순위가 높습니다.",
      },
      {
        heading: "배터리 타입: 일반, EFB, AGM 구분",
        body: "차량 전장 사양에 따라 적합한 타입이 다릅니다. ISG(오토스탑) 차량은 EFB 또는 AGM 규격이 요구되는 경우가 많아 일반형으로 단순 대체하면 수명이 짧아질 수 있습니다. 기존 장착 타입과 제조사 권장 조건을 함께 확인하는 것이 안전합니다.",
      },
      {
        heading: "용량 상향 시 체크 포인트",
        body: "상위 AH 장착은 무조건 좋은 선택이 아닙니다. 장착 공간, 충전 특성, 차량 사용 패턴을 함께 봐야 하며, 과도한 상향은 체감 이점이 작을 수 있습니다. 동일 규격 내에서 안정적인 제품을 고르는 쪽이 운영 측면에서 유리합니다.",
      },
      {
        heading: "교체 후 초기 점검 루틴",
        body: "교체 직후에는 시동 반응과 충전 전압을 확인하고, 단자 체결 상태를 재점검해야 합니다. 블랙박스 상시전원이나 보조 장치 설정이 과도하면 새 배터리도 조기 방전될 수 있습니다. 교체 후 1주 이내에 한 번 더 상태를 확인하면 문제를 빨리 잡을 수 있습니다.",
      },
    ],
    imageKeywords: ["car battery replacement", "agm battery", "mechanic garage"],
  },
  {
    title: "차량 배터리 수명을 늘리는 주행 습관과 전기장치 관리법",
    subtitle: "주행거리보다 사용 패턴이 수명에 미치는 영향이 큽니다. 실사용 기준으로 핵심만 정리했습니다.",
    excerpt:
      "배터리 수명은 연식보다 사용 습관의 영향을 크게 받습니다. 장기 주차, 전기장치 사용, 충전 루틴 관점에서 관리법을 소개합니다.",
    tags: ["#배터리수명", "#차량관리", "#전기장치"],
    sections: [
      {
        heading: "장기 주차 전 준비해야 할 것",
        body: "장기간 운행이 어려운 경우에는 블랙박스 주차모드 설정과 보조 장치 전원 상태를 먼저 확인해야 합니다. 미세한 대기전류가 누적되면 예상보다 빠르게 방전됩니다. 장기 주차 전 배터리 상태를 한 번 점검하는 것만으로도 리스크를 줄일 수 있습니다.",
      },
      {
        heading: "시동 직후 전기장치 과사용 줄이기",
        body: "시동 직후에는 배터리 회복 구간이므로 열선, 히터, 오디오를 동시에 강하게 사용하는 습관은 피하는 것이 좋습니다. 특히 저온 환경에서는 회복 속도가 느려 체감 부담이 더 큽니다. 초기 몇 분만 사용량을 조절해도 컨디션 유지에 도움이 됩니다.",
      },
      {
        heading: "주행 패턴과 충전 균형 맞추기",
        body: "짧은 이동 위주 차량은 충전보다 소모가 앞서는 경우가 많습니다. 정기적으로 충분한 거리 또는 시간을 확보해 발전 충전을 안정화해야 합니다. 패턴을 조금만 조정해도 배터리 교체 주기를 유의미하게 늘릴 수 있습니다.",
      },
      {
        heading: "정기 점검 시 함께 볼 항목",
        body: "배터리 자체뿐 아니라 발전기 출력, 벨트 상태, 단자 체결 상태를 함께 보면 원인 진단이 정확해집니다. 배터리만 반복 교체하는 방식은 비용 대비 효율이 떨어질 수 있습니다. 정기 점검 시 전기계통 전체를 함께 확인하는 접근이 필요합니다.",
      },
    ],
    imageKeywords: ["car dashboard", "vehicle maintenance", "car battery check"],
  },
];

async function hasAdminAccess(request: Request) {
  await ensureAuthSchema();
  const session = readSessionFromRequest(request);
  if (!session) {
    return false;
  }

  if (session.role === "ADMIN") {
    return true;
  }

  const user = await findUserById(session.userId);

  return user?.role === "ADMIN";
}

function getGeminiModelCandidates() {
  const configured = (process.env.GEMINI_MODEL || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => GEMINI_MODEL_ALIASES[item] ?? item);

  return Array.from(new Set([...configured, ...GEMINI_FALLBACK_MODELS]));
}

function getGeminiImageModelCandidates() {
  const configured = (process.env.GEMINI_IMAGE_MODEL || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => GEMINI_IMAGE_MODEL_ALIASES[item] ?? item);

  return Array.from(new Set([...configured, ...GEMINI_IMAGE_FALLBACK_MODELS]));
}

function shouldTryNextModel(status: number, detail: string) {
  if (status === 404) {
    return true;
  }

  if (status === 400) {
    const normalized = detail.toLowerCase();
    if (
      normalized.includes("is not found") ||
      normalized.includes("not supported for generatecontent")
    ) {
      return true;
    }
  }

  return false;
}

function shouldTryNextImageModel(status: number, detail: string) {
  if (shouldTryNextModel(status, detail)) {
    return true;
  }

  if (status === 429 || status >= 500) {
    return true;
  }

  const normalized = detail.toLowerCase();
  return (
    normalized.includes("model") &&
    (normalized.includes("not found") || normalized.includes("not supported"))
  );
}

function normalizeTitle(input: string) {
  return input.toLowerCase().replace(/\s+/g, "").trim();
}

function shouldFallbackToLocalDraft(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("user location is not supported") ||
    message.includes("failed_precondition") ||
    message.includes("gemini_api_key is not configured") ||
    message.includes("api key not valid")
  );
}

function buildLocalDraft(existingTitles: string[]) {
  const titleSet = new Set(existingTitles.map(normalizeTitle));
  const daySeed = new Date().getDate() % LOCAL_NOTE_TEMPLATES.length;

  let selected = LOCAL_NOTE_TEMPLATES.find(
    (template) => !titleSet.has(normalizeTitle(template.title)),
  );
  if (!selected) {
    selected = LOCAL_NOTE_TEMPLATES[daySeed];
  }

  let title = selected.title;
  let suffix = 2;
  while (titleSet.has(normalizeTitle(title))) {
    title = `${selected.title} (${suffix})`;
    suffix += 1;
  }

  return sanitizeGeneratedNote({
    title,
    subtitle: selected.subtitle,
    excerpt: selected.excerpt,
    tags: selected.tags,
    sections: selected.sections,
    imageKeywords: selected.imageKeywords,
  });
}

function buildPrompt(existingTitles: string[]) {
  const titleBlock =
    existingTitles.length > 0
      ? existingTitles.map((title, index) => `${index + 1}. ${title}`).join("\n")
      : "이전 글 없음";

  return `
너는 한국 자동차 배터리 전문 블로그 편집자다.
중복되지 않는 새 글 1개를 JSON으로만 출력해라.

요구사항:
- 주제: 배터리 관리법, 교체 방법, 차량용 배터리 기술 소개 중 하나.
- 한국어, 현장 에디터가 작성한 듯한 담백한 문체.
- 본문 총량은 약 1500자(최소 1300자, 최대 1800자).
- 제목, 부제, 소제목-본문 구조를 반드시 사용.
- 소제목은 4~6개, 각 소제목 본문은 2~4문장.
- 기존 글 제목과 중복 또는 유사 제목 금지.
- 사실 확인 가능한 일반 상식 수준으로만 작성하고 과장 금지.
- 아래 표현은 사용 금지:
  "지금 확인해보세요", "완벽 가이드", "혁신", "필수입니다", "꼭 해야 합니다"
- 광고성 문장/과도한 감탄문 금지.

기존 제목 목록:
${titleBlock}

JSON 스키마:
{
  "title": "문자열",
  "subtitle": "40~90자 부제",
  "excerpt": "80~140자 요약(목록용)",
  "tags": ["#태그1", "#태그2", "#태그3"],
  "sections": [
    { "heading": "소제목", "body": "소제목 본문(2~4문장)" }
  ],
  "imageKeywords": ["썸네일용 영문 키워드", "본문이미지1 영문 키워드", "본문이미지2 영문 키워드"]
}

반드시 JSON 하나만 반환해라.
`.trim();
}

async function requestGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  const modelCandidates = getGeminiModelCandidates();
  if (modelCandidates.length === 0) {
    throw new Error("GEMINI_MODEL is not configured.");
  }

  let lastError = "";

  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.65,
          topP: 0.9,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      lastError = `model=${model}, status=${response.status}, detail=${detail}`;
      if (shouldTryNextModel(response.status, detail)) {
        continue;
      }
      throw new Error(`Gemini API error: ${lastError}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      lastError = `model=${model}, response=empty`;
      continue;
    }

    return text;
  }

  throw new Error(
    `Gemini 호출 실패 (시도 모델: ${modelCandidates.join(", ")}). 마지막 오류: ${lastError || "unknown"}`,
  );
}

function buildGeminiImagePrompt(params: {
  title: string;
  keyword: string;
  slot: "thumbnail" | "body";
}) {
  const slotHint =
    params.slot === "thumbnail"
      ? "hero banner composition, clean and professional, high contrast"
      : "in-article supporting photo, realistic service scene";

  return [
    "Create a photorealistic image for a Korean automotive battery article.",
    `Topic: ${params.title}`,
    `Keyword focus: ${params.keyword || "car battery maintenance"}`,
    `Shot style: ${slotHint}`,
    "Requirements: absolutely no text, no letters, no numbers, no symbols, no watermark, no logo, no brand marks, no signage.",
    "No captions, no UI overlays, no monitor screen text, no engraved labels in readable form.",
    "Composition: automotive battery, engine bay or maintenance shop context, natural lighting, 16:9.",
  ].join(" ");
}

async function requestGeminiImage(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const modelCandidates = getGeminiImageModelCandidates();
  if (modelCandidates.length === 0) {
    throw new Error("GEMINI_IMAGE_MODEL is not configured.");
  }

  let lastError = "";

  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "16:9" },
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      lastError = `model=${model}, status=${response.status}, detail=${detail}`;
      if (shouldTryNextImageModel(response.status, detail)) {
        continue;
      }
      throw new Error(`Gemini Image API error: ${lastError}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const imagePart = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .find((part) => Boolean(part.inlineData?.data));

    if (imagePart?.inlineData?.data) {
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${imagePart.inlineData.data}`;
    }

    const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    lastError = `model=${model}, response=${
      textPart ? `text-only:${textPart.slice(0, 200)}` : "no-image-part"
    }`;
  }

  throw new Error(
    `Gemini 이미지 호출 실패 (시도 모델: ${modelCandidates.join(", ")}). 마지막 오류: ${lastError || "unknown"}`,
  );
}

function parseDataUrlImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function parseBooleanField(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return null;
}

async function hasOverlayTextInImage(dataUrl: string) {
  const parsedImage = parseDataUrlImage(dataUrl);
  if (!parsedImage) {
    return false;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return false;
  }

  const modelCandidates = getGeminiModelCandidates();
  if (modelCandidates.length === 0) {
    return false;
  }

  const inspectionPrompt = [
    "Analyze this image for text overlays.",
    "Return JSON only:",
    '{"overlayCaption": true|false, "containsReadableText": true|false, "reason": "short"}',
    "Set overlayCaption=true when a visible title/banner/caption is overlaid in the image.",
    "Ignore tiny incidental labels unless clearly readable in the main scene.",
  ].join(" ");

  for (const model of modelCandidates) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0,
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: inspectionPrompt },
              {
                inlineData: {
                  mimeType: parsedImage.mimeType,
                  data: parsedImage.data,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!text) {
      continue;
    }

    const parsed = extractJsonObject(text);
    if (!parsed) {
      continue;
    }

    const overlayCaption = parseBooleanField(parsed.overlayCaption);
    const containsReadableText = parseBooleanField(parsed.containsReadableText);

    if (overlayCaption === null && containsReadableText === null) {
      continue;
    }

    return Boolean(overlayCaption) || Boolean(containsReadableText);
  }

  return false;
}

async function requestValidatedGeminiImage(
  prompt: string,
  maxAttempts = 4,
) {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const imageDataUrl = await requestGeminiImage(prompt);
      const hasOverlayText = await hasOverlayTextInImage(imageDataUrl);

      if (!hasOverlayText) {
        return imageDataUrl;
      }

      lastError = `overlay text detected (attempt ${attempt})`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError || "Gemini validated image generation failed.");
}

async function buildNoteImages(params: {
  title: string;
  imageKeywords: string[];
}) {
  const [thumbKeyword, bodyKeyword1, bodyKeyword2] = params.imageKeywords;
  const fallbackThumbnail = buildUnsplashSourceUrl(thumbKeyword, 1);
  const fallbackBodyImages = [
    buildUnsplashSourceUrl(bodyKeyword1, 2),
    buildUnsplashSourceUrl(bodyKeyword2, 3),
  ];

  try {
    const prompts = [
      buildGeminiImagePrompt({
        title: params.title,
        keyword: thumbKeyword,
        slot: "thumbnail",
      }),
      buildGeminiImagePrompt({
        title: params.title,
        keyword: bodyKeyword1,
        slot: "body",
      }),
      buildGeminiImagePrompt({
        title: params.title,
        keyword: bodyKeyword2,
        slot: "body",
      }),
    ];

    const generated: Array<string | null> = [];
    for (const prompt of prompts) {
      const image = await requestValidatedGeminiImage(prompt).catch(() => null);
      generated.push(image);
    }

    return {
      thumbnailUrl: generated[0] ?? fallbackThumbnail,
      bodyImageUrls: [
        generated[1] ?? fallbackBodyImages[0],
        generated[2] ?? fallbackBodyImages[1],
      ],
    };
  } catch {
    return {
      thumbnailUrl: fallbackThumbnail,
      bodyImageUrls: fallbackBodyImages,
    };
  }
}

async function createNote() {
  await ensureBatteryNoteSchema();

  const existing = await listRecentBatteryNoteTitles(20);
  const existingTitles = existing.map((item) => item.title);

  let generated;
  try {
    const generatedRawText = await requestGemini(buildPrompt(existingTitles));
    const parsed = extractJsonObject(generatedRawText);
    if (!parsed) {
      throw new Error("Gemini JSON parsing failed.");
    }
    generated = sanitizeGeneratedNote(parsed);
  } catch (error) {
    if (!shouldFallbackToLocalDraft(error)) {
      throw error;
    }
    generated = buildLocalDraft(existingTitles);
  }

  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slugBase = toSlug(generated.title);
  const fallbackBase = slugBase || `battery-note-${datePrefix}`;
  let slug = fallbackBase;
  let suffix = 2;

  while (await batteryNoteSlugExists(slug)) {
    slug = `${fallbackBase}-${suffix}`;
    suffix += 1;
  }

  const { thumbnailUrl, bodyImageUrls } = await buildNoteImages({
    title: generated.title,
    imageKeywords: generated.imageKeywords,
  });

  const created = await createBatteryNoteDraft({
    slug,
    title: generated.title,
    excerpt: generated.excerpt,
    content: generated.content,
    thumbnailUrl,
    bodyImageUrls,
    tags: generated.tags,
  });

  return created;
}

async function handleGenerate(request: Request) {
  const adminAccess = await hasAdminAccess(request);
  if (!adminAccess) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const item = await createNote();
    return NextResponse.json({ created: true, item });
  } catch (error) {
    return NextResponse.json(
      {
        created: false,
        message: "배터리노트 생성에 실패했습니다.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleGenerate(request);
}

export async function GET() {
  return NextResponse.json(
    { message: "관리자 페이지의 생성 버튼(POST)으로만 호출할 수 있습니다." },
    { status: 405 },
  );
}
