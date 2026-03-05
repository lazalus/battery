import { NextResponse } from "next/server";

const GEMINI_PROXY_BASE =
  process.env.GEMINI_PROXY_URL || "https://generativelanguage.googleapis.com";

const IMAGE_MODELS = [
  "gemini-2.5-flash-preview-image-generation",
  "gemini-2.0-flash-preview-image-generation",
];

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
};

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const prompt = [
    "Create a cinematic, photorealistic wide-angle photograph of a modern automotive engine bay at dusk.",
    "Focus on a car battery with visible terminals, warm golden hour lighting filtering through the hood.",
    "Shallow depth of field, rich shadows, dark moody atmosphere with teal and amber accent tones.",
    "No text, no letters, no numbers, no watermarks, no logos, no UI elements whatsoever.",
    "Aspect ratio 16:9, professional automotive photography style.",
  ].join(" ");

  let lastError = "";

  for (const model of IMAGE_MODELS) {
    const endpoint = `${GEMINI_PROXY_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "16:9" },
          },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });

      if (!res.ok) {
        lastError = `${model}: ${res.status} ${await res.text().catch(() => "")}`;
        continue;
      }

      const data = (await res.json()) as GeminiResponse;
      const imagePart = data.candidates
        ?.flatMap((c) => c.content?.parts ?? [])
        .find((p) => Boolean(p.inlineData?.data));

      if (imagePart?.inlineData?.data) {
        const mime = imagePart.inlineData.mimeType || "image/png";
        return new NextResponse(Buffer.from(imagePart.inlineData.data, "base64"), {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
          },
        });
      }

      lastError = `${model}: no image in response`;
    } catch (e) {
      lastError = `${model}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json(
    { error: "Image generation failed", detail: lastError },
    { status: 502 },
  );
}
