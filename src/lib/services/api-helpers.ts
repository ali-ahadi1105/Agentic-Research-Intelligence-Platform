/**
 * API Route helpers - common patterns for authentication, authorization, and response handling.
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../auth";
import { db } from "../db";
import { success, error, HttpStatus, type ApiResponse } from "../api-response";

export interface AuthContext {
  userId: string;
  userEmail: string;
  userName: string | null;
  userRole: string;
  organizationId: string;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  if (!membership) return null;

  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    organizationId: membership.organizationId,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json(error("UNAUTHORIZED", "لطفاً وارد شوید"), {
    status: HttpStatus.UNAUTHORIZED,
  });
}

export function forbiddenResponse(message = "اجازه دسترسی ندارید") {
  return NextResponse.json(error("FORBIDDEN", message), {
    status: HttpStatus.FORBIDDEN,
  });
}

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(success(data, meta), { status: HttpStatus.OK });
}

export function created<T>(data: T) {
  return NextResponse.json(success(data), { status: HttpStatus.CREATED });
}

export function badRequest(message: string) {
  return NextResponse.json(error("BAD_REQUEST", message), {
    status: HttpStatus.BAD_REQUEST,
  });
}

export function notFound(message = "یافت نشد") {
  return NextResponse.json(error("NOT_FOUND", message), {
    status: HttpStatus.NOT_FOUND,
  });
}

export function internalError(message = "خطای داخلی سرور") {
  return NextResponse.json(error("INTERNAL", message), {
    status: HttpStatus.INTERNAL,
  });
}

/**
 * Verify that the user has access to the workspace.
 * Returns the workspace or null if not authorized.
 */
export async function authorizeWorkspace(
  workspaceId: string,
  auth: AuthContext
): Promise<{ id: string; organizationId: string; name: string } | null> {
  const ws = await db.workspace.findFirst({
    where: {
      id: workspaceId,
      organizationId: auth.organizationId,
      status: { not: "deleted" },
    },
    select: { id: true, organizationId: true, name: true },
  });
  return ws;
}

/**
 * Wrapper for authenticated API handlers.
 */
export function withAuth<TArgs extends unknown[]>(
  handler: (auth: AuthContext, ...args: TArgs) => Promise<NextResponse>
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    const auth = await getAuthContext();
    if (!auth) {
      return unauthorizedResponse();
    }
    return handler(auth, ...args);
  };
}
