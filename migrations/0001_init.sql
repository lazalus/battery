-- AppUser
CREATE TABLE IF NOT EXISTS "AppUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX IF NOT EXISTS "AppUser_role_idx" ON "AppUser"("role");

-- BatteryNotePost
CREATE TABLE IF NOT EXISTS "BatteryNotePost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "bodyImageUrls" TEXT,
  "tags" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewedAt" TEXT,
  "reviewerId" TEXT,
  "publishedAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
  "updatedAt" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "BatteryNotePost_slug_key" ON "BatteryNotePost"("slug");
CREATE INDEX IF NOT EXISTS "BatteryNotePost_publishedAt_idx" ON "BatteryNotePost"("publishedAt");
CREATE INDEX IF NOT EXISTS "BatteryNotePost_status_publishedAt_idx" ON "BatteryNotePost"("status", "publishedAt");

-- MarketingEvent
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
  "metadata" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS "MarketingEvent_createdAt_idx" ON "MarketingEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "MarketingEvent_eventType_createdAt_idx" ON "MarketingEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingEvent_pageType_createdAt_idx" ON "MarketingEvent"("pageType", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingEvent_brand_model_idx" ON "MarketingEvent"("brandId", "modelId", "createdAt");
