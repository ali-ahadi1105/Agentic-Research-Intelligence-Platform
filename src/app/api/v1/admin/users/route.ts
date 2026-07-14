import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  unauthorizedResponse,
  internalError,
  notFound,
} from "@/lib/services/api-helpers";
import { can } from "@/lib/services/permissions";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.users")) {
      return notFound("دسترسی غیرمجاز");
    }

    const members = await db.organizationMember.findMany({
      where: { organizationId: auth.organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return ok(members);
  } catch (err) {
    console.error("[Users API] GET error:", err);
    return internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.users")) {
      return notFound("دسترسی غیرمجاز");
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return notFound("memberId و role لازم است");
    }

    const member = await db.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        organizationId: auth.organizationId,
        action: "permission_change",
        resourceType: "member",
        resourceId: memberId,
        details: JSON.stringify({ role }),
      },
    });

    return ok(member);
  } catch (err) {
    console.error("[Users API] PATCH error:", err);
    return internalError();
  }
}
