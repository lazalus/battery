import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error("D1 database binding 'DB' is not configured.");
  }
  return db;
}

export async function runQuery(sql: string, args: unknown[] = []) {
  const db = await getDB();
  const stmt = db.prepare(sql).bind(...args);
  const result = await stmt.all();
  return {
    rows: (result.results ?? []) as Record<string, unknown>[],
    rowsAffected: result.meta?.changes ?? 0,
  };
}

export async function runExec(sql: string, args: unknown[] = []) {
  const db = await getDB();
  const result = await db.prepare(sql).bind(...args).run();
  return { rowsAffected: result.meta?.changes ?? 0 };
}

export function firstRow(result: { rows: Record<string, unknown>[] }) {
  return result.rows[0] as Record<string, unknown> | undefined;
}
