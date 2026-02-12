import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type AppUserPublic = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type AppUserWithPassword = AppUserPublic & {
  passwordHash: string;
};

type AppUserDelegate = {
  findUnique: (args: unknown) => Promise<unknown>;
  create: (args: unknown) => Promise<unknown>;
  count: (args?: unknown) => Promise<number>;
};

function getAppUserDelegate(): AppUserDelegate | null {
  const maybe = (prisma as unknown as { appUser?: AppUserDelegate }).appUser;
  if (!maybe) {
    return null;
  }
  if (
    typeof maybe.findUnique !== "function" ||
    typeof maybe.create !== "function" ||
    typeof maybe.count !== "function"
  ) {
    return null;
  }
  return maybe;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export async function findUserByEmail(email: string) {
  const delegate = getAppUserDelegate();
  if (delegate) {
    const result = (await delegate.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    })) as AppUserWithPassword | null;
    return result;
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, email, role, passwordHash FROM "AppUser" WHERE email = ? LIMIT 1`,
    email,
  )) as AppUserWithPassword[];
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const delegate = getAppUserDelegate();
  if (delegate) {
    const result = (await delegate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })) as AppUserPublic | null;
    return result;
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, name, email, role FROM "AppUser" WHERE id = ? LIMIT 1`,
    id,
  )) as AppUserPublic[];
  return rows[0] ?? null;
}

export async function countAdminUsers() {
  const delegate = getAppUserDelegate();
  if (delegate) {
    return delegate.count({
      where: { role: "ADMIN" },
    });
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM "AppUser" WHERE role = 'ADMIN'`,
  )) as Array<{ count: unknown }>;
  return toNumber(rows[0]?.count);
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}) {
  const delegate = getAppUserDelegate();
  if (delegate) {
    const result = (await delegate.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })) as AppUserPublic;
    return result;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AppUser" (id, name, email, passwordHash, role, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.name,
    data.email,
    data.passwordHash,
    data.role,
    now,
    now,
  );

  return {
    id,
    name: data.name,
    email: data.email,
    role: data.role,
  } satisfies AppUserPublic;
}
