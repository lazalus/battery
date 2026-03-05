import { runQuery } from "@/lib/db";

let schemaEnsured = false;

export async function ensureBatteryNoteSchema() {
  if (schemaEnsured) {
    return;
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS "BatteryNotePost" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "excerpt" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "thumbnailUrl" TEXT NOT NULL,
      "bodyImageUrls" JSON,
      "tags" JSON,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "reviewedAt" DATETIME,
      "reviewerId" TEXT,
      "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  const columnsResult = await runQuery(`
    PRAGMA table_info("BatteryNotePost");
  `);
  const columnNames = new Set(
    columnsResult.rows
      .map((row) => {
        const record = row as unknown as { name?: unknown };
        return typeof record.name === "string" ? record.name : "";
      })
      .filter((name) => name.length > 0),
  );

  if (!columnNames.has("status")) {
    await runQuery(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
    `);
  }
  if (!columnNames.has("reviewedAt")) {
    await runQuery(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "reviewedAt" DATETIME;
    `);
  }
  if (!columnNames.has("reviewerId")) {
    await runQuery(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "reviewerId" TEXT;
    `);
  }

  await runQuery(`
    UPDATE "BatteryNotePost"
    SET "status" = 'PUBLISHED'
    WHERE "status" IS NULL OR "status" = '';
  `);

  await runQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BatteryNotePost_slug_key"
    ON "BatteryNotePost"("slug");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "BatteryNotePost_publishedAt_idx"
    ON "BatteryNotePost"("publishedAt");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "BatteryNotePost_status_publishedAt_idx"
    ON "BatteryNotePost"("status", "publishedAt");
  `);

  schemaEnsured = true;
}
