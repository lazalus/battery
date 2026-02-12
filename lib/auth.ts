import { createHmac, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE_NAME = "batteryfit_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type UserRole = "USER" | "ADMIN";

type SessionPayload = {
  userId: string;
  role: UserRole;
  exp: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || "batteryfit-dev-secret";
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function createSignature(payloadSegment: string) {
  return toBase64Url(
    createHmac("sha256", getAuthSecret()).update(payloadSegment).digest(),
  );
}

export function createSessionToken(userId: string, role: UserRole) {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadSegment = toBase64Url(JSON.stringify(payload));
  const signatureSegment = createSignature(payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function verifySessionToken(token: string) {
  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return null;
  }
  if (createSignature(payloadSegment) !== signatureSegment) {
    return null;
  }

  try {
    const payload = JSON.parse(
      fromBase64Url(payloadSegment).toString("utf8"),
    ) as SessionPayload;
    if (!payload.userId || !payload.role || !payload.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (payload.role !== "USER" && payload.role !== "ADMIN") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function parseCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return "";
  }
  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const [rawKey, ...rawValue] = segment.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return "";
}

export function readSessionFromRequest(request: Request) {
  const token = parseCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME,
  );
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export function applySessionCookie(
  response: NextResponse,
  userId: string,
  role: UserRole,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(userId, role),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return derived.toString("hex") === hash;
}
