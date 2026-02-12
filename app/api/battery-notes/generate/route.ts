import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
      }>;
    };
  }>;
};

const GEMINI_MODEL_ALIASES: Record<string, string> = {
  "gemini-3-flash": "gemini-2.5-flash",
  "gemini-3-pro": "gemini-2.5-pro",
};

const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

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
- 한국어, 자연스러운 문장.
- 본문은 약 1500자(최소 1300자, 최대 1800자).
- 본문은 6~10개 단락으로 작성하고 단락 구분은 "\\n\\n" 사용.
- 기존 글 제목과 중복 또는 유사 제목 금지.
- 사실 확인 가능한 일반 상식 수준으로만 작성하고 과장 금지.

기존 제목 목록:
${titleBlock}

JSON 스키마:
{
  "title": "문자열",
  "excerpt": "80~140자 요약",
  "tags": ["#태그1", "#태그2", "#태그3"],
  "content": "단락형 본문",
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
          temperature: 0.8,
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

async function createNote() {
  await ensureBatteryNoteSchema();

  const existing = await prisma.batteryNotePost.findMany({
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { title: true, slug: true },
  });

  const generatedRawText = await requestGemini(buildPrompt(existing.map((item) => item.title)));
  const parsed = extractJsonObject(generatedRawText);
  if (!parsed) {
    throw new Error("Gemini JSON parsing failed.");
  }
  const generated = sanitizeGeneratedNote(parsed);

  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const slugBase = toSlug(generated.title);
  const fallbackBase = slugBase || `battery-note-${datePrefix}`;
  let slug = fallbackBase;
  let suffix = 2;
  while (await prisma.batteryNotePost.findUnique({ where: { slug } })) {
    slug = `${fallbackBase}-${suffix}`;
    suffix += 1;
  }

  const [thumbKeyword, bodyKeyword1, bodyKeyword2] = generated.imageKeywords;
  const thumbnailUrl = buildUnsplashSourceUrl(thumbKeyword, 1);
  const bodyImageUrls = [
    buildUnsplashSourceUrl(bodyKeyword1, 2),
    buildUnsplashSourceUrl(bodyKeyword2, 3),
  ];

  const created = await prisma.batteryNotePost.create({
    data: {
      slug,
      title: generated.title,
      excerpt: generated.excerpt,
      content: generated.content,
      thumbnailUrl,
      bodyImageUrls,
      tags: generated.tags,
      status: "DRAFT",
      publishedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      publishedAt: true,
    },
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
