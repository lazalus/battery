import { randomUUID } from "node:crypto";
import { firstRow, runQuery } from "@/lib/db";

export type AppUserPublic = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type AppUserWithPassword = AppUserPublic & {
  passwordHash: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function findUserByEmail(email: string) {
  const result = await runQuery(
    `SELECT id, name, email, role, passwordHash
     FROM "AppUser"
     WHERE email = ?
     LIMIT 1`,
    [email],
  );
  const row = firstRow(result);
  if (!row) {
    return null;
  }

  return {
    id: readString(row.id),
    name: readString(row.name),
    email: readString(row.email),
    role: readString(row.role),
    passwordHash: readString(row.passwordHash),
  } satisfies AppUserWithPassword;
}

export async function findUserById(id: string) {
  const result = await runQuery(
    `SELECT id, name, email, role
     FROM "AppUser"
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  const row = firstRow(result);
  if (!row) {
    return null;
  }

  return {
    id: readString(row.id),
    name: readString(row.name),
    email: readString(row.email),
    role: readString(row.role),
  } satisfies AppUserPublic;
}

export async function countAdminUsers() {
  const result = await runQuery(
    `SELECT COUNT(*) as count
     FROM "AppUser"
     WHERE role = 'ADMIN'`,
  );
  const row = firstRow(result);
  return readNumber(row?.count);
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}) {
  const id = randomUUID();
  const now = new Date().toISOString();

  await runQuery(
    `INSERT INTO "AppUser" (id, name, email, passwordHash, role, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.email, data.passwordHash, data.role, now, now],
  );

  return {
    id,
    name: data.name,
    email: data.email,
    role: data.role,
  } satisfies AppUserPublic;
}
