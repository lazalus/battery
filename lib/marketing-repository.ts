import { randomUUID } from "node:crypto";
import { runQuery } from "@/lib/db";

export type MarketingEventInput = {
  eventType: "PAGE_VIEW" | "COUPANG_CLICK" | "CTA_CLICK";
  pageType?: string | null;
  pagePath?: string | null;
  source?: string | null;
  brandId?: string | null;
  brandSlug?: string | null;
  brandName?: string | null;
  modelId?: string | null;
  modelName?: string | null;
  noteSlug?: string | null;
  query?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RawAggRow = {
  brandId: string | null;
  brandName: string | null;
  brandSlug: string | null;
  modelId: string | null;
  modelName: string | null;
  impressions: number | string | null;
  clicks: number | string | null;
};

function cleanText(input?: string | null, max = 200) {
  if (!input) {
    return null;
  }
  const value = input.trim();
  if (!value) {
    return null;
  }
  return value.slice(0, max);
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function recordMarketingEvent(input: MarketingEventInput) {
  const id = randomUUID();

  await runQuery(
    `INSERT INTO "MarketingEvent" (
      id, eventType, pageType, pagePath, source, brandId, brandSlug, brandName,
      modelId, modelName, noteSlug, query, sessionId, metadata, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.eventType,
      cleanText(input.pageType, 50),
      cleanText(input.pagePath, 300),
      cleanText(input.source, 100),
      cleanText(input.brandId, 30),
      cleanText(input.brandSlug, 80),
      cleanText(input.brandName, 80),
      cleanText(input.modelId, 30),
      cleanText(input.modelName, 120),
      cleanText(input.noteSlug, 140),
      cleanText(input.query, 150),
      cleanText(input.sessionId, 80),
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    ],
  );

  return { id };
}

export async function getAffiliateCtrSummary(days = 30) {
  const daysSafe = Math.max(1, Math.min(365, Math.floor(days)));

  const modelRowsResult = await runQuery(
    `SELECT
        COALESCE(brandId, '') AS brandId,
        COALESCE(brandName, '') AS brandName,
        COALESCE(brandSlug, '') AS brandSlug,
        COALESCE(modelId, '') AS modelId,
        COALESCE(modelName, '') AS modelName,
        SUM(CASE WHEN eventType = 'PAGE_VIEW' AND pageType = 'MODEL_LANDING' THEN 1 ELSE 0 END) AS impressions,
        SUM(CASE WHEN eventType = 'COUPANG_CLICK' AND pageType = 'MODEL_LANDING' THEN 1 ELSE 0 END) AS clicks
      FROM "MarketingEvent"
      WHERE createdAt >= datetime('now', ?)
        AND brandName IS NOT NULL
        AND modelName IS NOT NULL
      GROUP BY brandId, brandName, brandSlug, modelId, modelName
      HAVING impressions > 0 OR clicks > 0
      ORDER BY clicks DESC, impressions DESC
      LIMIT 20`,
    [`-${daysSafe} days`],
  );

  const brandRowsResult = await runQuery(
    `SELECT
        COALESCE(brandId, '') AS brandId,
        COALESCE(brandName, '') AS brandName,
        COALESCE(brandSlug, '') AS brandSlug,
        SUM(CASE WHEN eventType = 'PAGE_VIEW' AND pageType = 'BRAND_HUB' THEN 1 ELSE 0 END) AS impressions,
        SUM(CASE WHEN eventType = 'COUPANG_CLICK' AND pageType = 'BRAND_HUB' THEN 1 ELSE 0 END) AS clicks
      FROM "MarketingEvent"
      WHERE createdAt >= datetime('now', ?)
        AND brandName IS NOT NULL
      GROUP BY brandId, brandName, brandSlug
      HAVING impressions > 0 OR clicks > 0
      ORDER BY clicks DESC, impressions DESC
      LIMIT 20`,
    [`-${daysSafe} days`],
  );

  const models = modelRowsResult.rows.map((raw) => {
    const row = raw as unknown as RawAggRow;
    const impressions = toNumber(row.impressions);
    const clicks = toNumber(row.clicks);
    return {
      brandId: row.brandId || "",
      brandName: row.brandName || "",
      brandSlug: row.brandSlug || "",
      modelId: row.modelId || "",
      modelName: row.modelName || "",
      impressions,
      clicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    };
  });

  const brands = brandRowsResult.rows.map((raw) => {
    const row = raw as unknown as RawAggRow;
    const impressions = toNumber(row.impressions);
    const clicks = toNumber(row.clicks);
    return {
      brandId: row.brandId || "",
      brandName: row.brandName || "",
      brandSlug: row.brandSlug || "",
      impressions,
      clicks,
      ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    };
  });

  return { days: daysSafe, brands, models };
}
