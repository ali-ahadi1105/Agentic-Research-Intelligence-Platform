import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSession,
  setSessionCookieOnResponse,
  clearSessionCookieOnResponse,
  getCurrentUser,
} from "@/lib/auth";
import { success, error, HttpStatus } from "@/lib/api-response";
import { AuditLog } from "@/lib/services/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, action } = body;

    if (action === "register") {
      if (!email || !password || !name) {
        return NextResponse.json(
          error("BAD_REQUEST", "ایمیل، رمز عبور و نام لازم است"),
          { status: HttpStatus.BAD_REQUEST }
        );
      }

      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          error("CONFLICT", "کاربری با این ایمیل وجود دارد"),
          { status: HttpStatus.CONFLICT }
        );
      }

      const passwordHash = await hashPassword(password);
      const user = await db.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: "admin",
        },
      });

      // Create a default organization
      const orgSlug = `${email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "")}-org`;
      const org = await db.organization.create({
        data: {
          name: `سازمان ${name}`,
          slug: orgSlug,
        },
      });

      await db.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: "admin",
        },
      });

      const { token, expiresAt } = await createSession(
        user.id,
        user.email,
        user.name,
        user.role
      );

      await AuditLog.log({
        userId: user.id,
        organizationId: org.id,
        action: "login",
        resourceType: "user",
        resourceId: user.id,
        details: { method: "register" },
      });

      const response = NextResponse.json(
        success({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          organization: { id: org.id, name: org.name, slug: org.slug },
        }),
        { status: HttpStatus.CREATED }
      );
      return setSessionCookieOnResponse(response, token, expiresAt);
    }

    if (action === "login") {
      if (!email || !password) {
        return NextResponse.json(
          error("BAD_REQUEST", "ایمیل و رمز عبور لازم است"),
          { status: HttpStatus.BAD_REQUEST }
        );
      }

      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        return NextResponse.json(
          error("UNAUTHORIZED", "ایمیل یا رمز عبور اشتباه است"),
          { status: HttpStatus.UNAUTHORIZED }
        );
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          error("UNAUTHORIZED", "ایمیل یا رمز عبور اشتباه است"),
          { status: HttpStatus.UNAUTHORIZED }
        );
      }

      const { token, expiresAt } = await createSession(
        user.id,
        user.email,
        user.name,
        user.role
      );

      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const membership = await db.organizationMember.findFirst({
        where: { userId: user.id },
        include: { organization: true },
      });

      await AuditLog.log({
        userId: user.id,
        organizationId: membership?.organizationId,
        action: "login",
        resourceType: "user",
        resourceId: user.id,
      });

      const response = NextResponse.json(
        success({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          organization: membership?.organization
            ? {
                id: membership.organization.id,
                name: membership.organization.name,
                slug: membership.organization.slug,
              }
            : null,
        }),
        { status: HttpStatus.OK }
      );
      return setSessionCookieOnResponse(response, token, expiresAt);
    }

    if (action === "logout") {
      const response = NextResponse.json(success({}), { status: HttpStatus.OK });
      return clearSessionCookieOnResponse(response);
    }

    return NextResponse.json(
      error("BAD_REQUEST", "action نامعتبر است (register | login | logout)"),
      { status: HttpStatus.BAD_REQUEST }
    );
  } catch (err) {
    console.error("[Auth API] Error:", err);
    return NextResponse.json(error("INTERNAL", "خطای داخلی سرور"), {
      status: HttpStatus.INTERNAL,
    });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(error("UNAUTHORIZED", "لطفاً وارد شوید"), {
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const membership = await db.organizationMember.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    return NextResponse.json(
      success({
        user,
        organization: membership?.organization
          ? {
              id: membership.organization.id,
              name: membership.organization.name,
              slug: membership.organization.slug,
            }
          : null,
      }),
      { status: HttpStatus.OK }
    );
  } catch {
    return NextResponse.json(error("UNAUTHORIZED", "لطفاً وارد شوید"), {
      status: HttpStatus.UNAUTHORIZED,
    });
  }
}
