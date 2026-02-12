import { prisma } from "@/lib/prisma";

let schemaEnsured = false;

export async function ensureBatteryNoteSchema() {
  if (schemaEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
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

  const columns = (await prisma.$queryRawUnsafe(`
    PRAGMA table_info("BatteryNotePost");
  `)) as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("status")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
    `);
  }
  if (!columnNames.has("reviewedAt")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "reviewedAt" DATETIME;
    `);
  }
  if (!columnNames.has("reviewerId")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BatteryNotePost"
      ADD COLUMN "reviewerId" TEXT;
    `);
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "BatteryNotePost"
    SET "status" = 'PUBLISHED'
    WHERE "status" IS NULL OR "status" = '';
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BatteryNotePost_slug_key"
    ON "BatteryNotePost"("slug");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BatteryNotePost_publishedAt_idx"
    ON "BatteryNotePost"("publishedAt");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BatteryNotePost_status_publishedAt_idx"
    ON "BatteryNotePost"("status", "publishedAt");
  `);

  schemaEnsured = true;
}
