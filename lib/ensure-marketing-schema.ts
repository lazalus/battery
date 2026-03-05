import { runQuery } from "@/lib/db";

let marketingSchemaEnsured = false;

export async function ensureMarketingSchema() {
  if (marketingSchemaEnsured) {
    return;
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS "MarketingEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "eventType" TEXT NOT NULL,
      "pageType" TEXT,
      "pagePath" TEXT,
      "source" TEXT,
      "brandId" TEXT,
      "brandSlug" TEXT,
      "brandName" TEXT,
      "modelId" TEXT,
      "modelName" TEXT,
      "noteSlug" TEXT,
      "query" TEXT,
      "sessionId" TEXT,
      "metadata" JSON,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "MarketingEvent_createdAt_idx"
    ON "MarketingEvent"("createdAt");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "MarketingEvent_eventType_createdAt_idx"
    ON "MarketingEvent"("eventType", "createdAt");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "MarketingEvent_pageType_createdAt_idx"
    ON "MarketingEvent"("pageType", "createdAt");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "MarketingEvent_brand_model_idx"
    ON "MarketingEvent"("brandId", "modelId", "createdAt");
  `);

  marketingSchemaEnsured = true;
}
