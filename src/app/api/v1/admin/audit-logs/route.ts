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

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.audit")) {
      return notFound("دسترسی غیرمجاز");
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { organizationId: auth.organizationId };
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return ok({ logs, total });
  } catch (err) {
    console.error("[Audit Logs API] GET error:", err);
    return internalError();
  }
}
