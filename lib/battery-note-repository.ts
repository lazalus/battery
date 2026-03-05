import { randomUUID } from "node:crypto";
import { firstRow, runQuery } from "@/lib/db";
import { safeStringArray } from "@/lib/battery-note";

type BatteryNoteStatus = "DRAFT" | "PUBLISHED";

type BatteryNoteBase = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  thumbnailUrl: string;
  tags: string[];
  publishedAt: string;
};

export type BatteryNoteListItem = BatteryNoteBase;

export type BatteryNoteDetailItem = BatteryNoteBase & {
  content: string;
  bodyImageUrls: string[];
};

export type AdminBatteryNoteItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  status: string;
  tags: string[];
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string;
};

type GeneratedDraftInput = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  thumbnailUrl: string;
  bodyImageUrls: string[];
  tags: string[];
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function rowToBaseItem(row: Record<string, unknown>): BatteryNoteBase {
  return {
    id: readString(row.id),
    slug: readString(row.slug),
    title: readString(row.title),
    excerpt: readString(row.excerpt),
    thumbnailUrl: readString(row.thumbnailUrl),
    tags: safeStringArray(parseMaybeJson(row.tags)),
    publishedAt: toIsoString(row.publishedAt),
  };
}

export async function listPublishedBatteryNotes(limit: number) {
  const result = await runQuery(
    `SELECT id, slug, title, excerpt, thumbnailUrl, tags, publishedAt
     FROM "BatteryNotePost"
     WHERE status = 'PUBLISHED'
     ORDER BY publishedAt DESC
     LIMIT ?`,
    [limit],
  );

  return result.rows.map((row) => rowToBaseItem(row as Record<string, unknown>));
}

export async function findPublishedBatteryNoteBySlug(slug: string) {
  const result = await runQuery(
    `SELECT id, slug, title, excerpt, content, thumbnailUrl, bodyImageUrls, tags, publishedAt
     FROM "BatteryNotePost"
     WHERE slug = ? AND status = 'PUBLISHED'
     LIMIT 1`,
    [slug],
  );

  const row = firstRow(result);
  if (!row) {
    return null;
  }

  const base = rowToBaseItem(row);
  return {
    ...base,
    content: readString(row.content),
    bodyImageUrls: safeStringArray(parseMaybeJson(row.bodyImageUrls)),
  } satisfies BatteryNoteDetailItem;
}

export async function listRecentBatteryNoteTitles(limit = 20) {
  const result = await runQuery(
    `SELECT title, slug
     FROM "BatteryNotePost"
     ORDER BY publishedAt DESC
     LIMIT ?`,
    [limit],
  );

  return result.rows.map((row) => ({
    title: readString((row as Record<string, unknown>).title),
    slug: readString((row as Record<string, unknown>).slug),
  }));
}

export async function batteryNoteSlugExists(slug: string) {
  const result = await runQuery(
    `SELECT id
     FROM "BatteryNotePost"
     WHERE slug = ?
     LIMIT 1`,
    [slug],
  );
  return Boolean(firstRow(result));
}

export async function createBatteryNoteDraft(input: GeneratedDraftInput) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO "BatteryNotePost" (
      id, slug, title, excerpt, content, thumbnailUrl,
      bodyImageUrls, tags, status, publishedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
    [
      id,
      input.slug,
      input.title,
      input.excerpt,
      input.content,
      input.thumbnailUrl,
      JSON.stringify(input.bodyImageUrls),
      JSON.stringify(input.tags),
      now,
      now,
      now,
    ],
  );

  return {
    id,
    slug: input.slug,
    title: input.title,
    status: "DRAFT",
    publishedAt: now,
  };
}

export async function listAdminBatteryNotes(limit = 60) {
  const result = await runQuery(
    `SELECT id, slug, title, excerpt, status, tags, createdAt, reviewedAt, publishedAt
     FROM "BatteryNotePost"
     ORDER BY createdAt DESC
     LIMIT ?`,
    [limit],
  );

  return result.rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: readString(row.id),
      slug: readString(row.slug),
      title: readString(row.title),
      excerpt: readString(row.excerpt),
      status: readString(row.status),
      tags: safeStringArray(parseMaybeJson(row.tags)),
      createdAt: toIsoString(row.createdAt),
      reviewedAt:
        row.reviewedAt == null || readString(row.reviewedAt) === ""
          ? null
          : toIsoString(row.reviewedAt),
      publishedAt: toIsoString(row.publishedAt),
    } satisfies AdminBatteryNoteItem;
  });
}

export async function updateBatteryNoteStatus(params: {
  id: string;
  status: BatteryNoteStatus;
  reviewerId: string;
}) {
  const now = new Date().toISOString();

  if (params.status === "PUBLISHED") {
    await runQuery(
      `UPDATE "BatteryNotePost"
       SET status = ?, reviewedAt = ?, reviewerId = ?, publishedAt = ?, updatedAt = ?
       WHERE id = ?`,
      [params.status, now, params.reviewerId, now, now, params.id],
    );
  } else {
    await runQuery(
      `UPDATE "BatteryNotePost"
       SET status = ?, reviewedAt = ?, reviewerId = ?, updatedAt = ?
       WHERE id = ?`,
      [params.status, now, params.reviewerId, now, params.id],
    );
  }

  const result = await runQuery(
    `SELECT id, slug, title, status, reviewedAt
     FROM "BatteryNotePost"
     WHERE id = ?
     LIMIT 1`,
    [params.id],
  );

  const row = firstRow(result);
  if (!row) {
    return null;
  }

  return {
    id: readString(row.id),
    slug: readString(row.slug),
    title: readString(row.title),
    status: readString(row.status),
    reviewedAt: row.reviewedAt ? toIsoString(row.reviewedAt) : null,
  };
}

export async function deleteBatteryNoteById(id: string) {
  const result = await runQuery(
    `DELETE FROM "BatteryNotePost"
     WHERE id = ?`,
    [id],
  );

  return (result.rowsAffected ?? 0) > 0;
}
