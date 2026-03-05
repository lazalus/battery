import { NextResponse } from "next/server";
import { ensureMarketingSchema } from "@/lib/ensure-marketing-schema";
import { runQuery } from "@/lib/db";

function verifyAdminToken(request: Request): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || request.headers.get("x-admin-token");
  return token === adminToken;
}

type RawStatRow = Record<string, unknown>;

export async function GET(request: Request) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.max(1, Math.min(365, Number(searchParams.get("days") || "30")));

  await ensureMarketingSchema();

  // Total page views & unique sessions
  const overviewResult = await runQuery(
    `SELECT
      COUNT(*) AS totalEvents,
      SUM(CASE WHEN eventType = 'PAGE_VIEW' THEN 1 ELSE 0 END) AS pageViews,
      SUM(CASE WHEN eventType = 'COUPANG_CLICK' THEN 1 ELSE 0 END) AS coupangClicks,
      SUM(CASE WHEN eventType = 'CTA_CLICK' THEN 1 ELSE 0 END) AS ctaClicks,
      COUNT(DISTINCT sessionId) AS uniqueVisitors
    FROM "MarketingEvent"
    WHERE createdAt >= datetime('now', ?)`,
    [`-${days} days`],
  );

  // Daily breakdown
  const dailyResult = await runQuery(
    `SELECT
      DATE(createdAt) AS date,
      SUM(CASE WHEN eventType = 'PAGE_VIEW' THEN 1 ELSE 0 END) AS views,
      SUM(CASE WHEN eventType = 'COUPANG_CLICK' THEN 1 ELSE 0 END) AS clicks,
      COUNT(DISTINCT sessionId) AS visitors
    FROM "MarketingEvent"
    WHERE createdAt >= datetime('now', ?)
    GROUP BY DATE(createdAt)
    ORDER BY date DESC
    LIMIT 30`,
    [`-${days} days`],
  );

  // Top pages
  const topPagesResult = await runQuery(
    `SELECT
      pagePath,
      COUNT(*) AS views
    FROM "MarketingEvent"
    WHERE eventType = 'PAGE_VIEW'
      AND createdAt >= datetime('now', ?)
      AND pagePath IS NOT NULL
    GROUP BY pagePath
    ORDER BY views DESC
    LIMIT 15`,
    [`-${days} days`],
  );

  // Brand CTR
  const brandCtrResult = await runQuery(
    `SELECT
      COALESCE(brandName, '') AS brandName,
      SUM(CASE WHEN eventType = 'PAGE_VIEW' THEN 1 ELSE 0 END) AS impressions,
      SUM(CASE WHEN eventType = 'COUPANG_CLICK' THEN 1 ELSE 0 END) AS clicks
    FROM "MarketingEvent"
    WHERE createdAt >= datetime('now', ?)
      AND brandName IS NOT NULL
    GROUP BY brandName
    HAVING impressions > 0 OR clicks > 0
    ORDER BY clicks DESC, impressions DESC
    LIMIT 15`,
    [`-${days} days`],
  );

  const overview = overviewResult.rows[0] as RawStatRow | undefined;
  const pageViews = Number(overview?.pageViews ?? 0);
  const coupangClicks = Number(overview?.coupangClicks ?? 0);

  return NextResponse.json({
    days,
    overview: {
      totalEvents: Number(overview?.totalEvents ?? 0),
      pageViews,
      coupangClicks,
      ctaClicks: Number(overview?.ctaClicks ?? 0),
      uniqueVisitors: Number(overview?.uniqueVisitors ?? 0),
      overallCtr: pageViews > 0 ? Number(((coupangClicks / pageViews) * 100).toFixed(2)) : 0,
    },
    daily: dailyResult.rows.map((row) => ({
      date: row.date as string,
      views: Number(row.views ?? 0),
      clicks: Number(row.clicks ?? 0),
      visitors: Number(row.visitors ?? 0),
    })),
    topPages: topPagesResult.rows.map((row) => ({
      path: row.pagePath as string,
      views: Number(row.views ?? 0),
    })),
    brandCtr: brandCtrResult.rows.map((row) => {
      const impressions = Number(row.impressions ?? 0);
      const clicks = Number(row.clicks ?? 0);
      return {
        brand: row.brandName as string,
        impressions,
        clicks,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
      };
    }),
  });
}
