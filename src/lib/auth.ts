import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const SESSION_COOKIE = "research_session";
const SESSION_DURATION_DAYS = 7;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  sessionId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${SESSION_DURATION_DAYS}d`,
  });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(
  userId: string,
  email: string,
  name: string | null,
  role: string,
  userAgent?: string,
  ipAddress?: string
) {
  const token = signToken({ userId, email, name, role, sessionId: "" });
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const session = await db.session.create({
    data: {
      userId,
      token,
      userAgent,
      ipAddress,
      expiresAt,
    },
  });

  // Re-sign with sessionId
  const finalToken = signToken({
    userId,
    email,
    name,
    role,
    sessionId: session.id,
  });

  await db.session.update({
    where: { id: session.id },
    data: { token: finalToken },
  });

  return { token: finalToken, expiresAt };
}

export async function revokeSession(sessionId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // Verify session is still valid in DB
  const session = await db.session.findUnique({
    where: { token },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  return payload;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const payload = await getSessionFromCookie();
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

import type { NextResponse } from "next/server";

/**
 * Set session cookie directly on a NextResponse object.
 * This is the correct way to set cookies in Route Handlers —
 * cookies().set() from next/headers does NOT work when returning NextResponse.json().
 */
export function setSessionCookieOnResponse(
  response: NextResponse,
  token: string,
  expiresAt: Date
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}

/**
 * Clear session cookie directly on a NextResponse object.
 */
export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

// Keep these for backward compatibility (Server Components, Server Actions)
// but they do NOT work in Route Handlers that return NextResponse.json()
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
