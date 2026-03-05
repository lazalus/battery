import { runQuery } from "@/lib/db";

let authSchemaEnsured = false;

export async function ensureAuthSchema() {
  if (authSchemaEnsured) {
    return;
  }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS "AppUser" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'USER',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await runQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key"
    ON "AppUser"("email");
  `);

  await runQuery(`
    CREATE INDEX IF NOT EXISTS "AppUser_role_idx"
    ON "AppUser"("role");
  `);

  authSchemaEnsured = true;
}
