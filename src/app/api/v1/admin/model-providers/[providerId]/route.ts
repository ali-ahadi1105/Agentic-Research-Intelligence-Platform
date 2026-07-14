import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  badRequest,
  unauthorizedResponse,
  internalError,
  notFound,
} from "@/lib/services/api-helpers";
import { can } from "@/lib/services/permissions";
import { AuditLog } from "@/lib/services/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { providerId } = await params;

    if (!can(auth, "admin.settings")) {
      return notFound("دسترسی غیرمجاز");
    }

    const body = await request.json();
    const allowedFields = [
      "label",
      "type",
      "baseUrl",
      "chatModel",
      "embeddingModel",
      "isActive",
      "isDefault",
      "useForChat",
      "useForEmbeddings",
    ];

    const data: Record<string, unknown> = {};
    for (const f of allowedFields) {
      if (f in body) data[f] = body[f];
    }

    // If apiKey is provided, update it (don't overwrite with empty)
    if (body.apiKey && body.apiKey !== "••••••••") {
      data.apiKey = body.apiKey;
    }

    // If setting as default, unset others
    if (body.isDefault === true) {
      await db.modelProvider.updateMany({
        where: {
          organizationId: auth.organizationId,
          isDefault: true,
          id: { not: providerId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await db.modelProvider.update({
      where: { id: providerId },
      data,
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "model_change",
      resourceType: "model_provider",
      resourceId: providerId,
      details: data,
    });

    return ok({ ...updated, apiKeyMasked: "••••••••" });
  } catch (err) {
    console.error("[Model Provider API] PATCH error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ providerId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { providerId } = await params;

    if (!can(auth, "admin.settings")) {
      return notFound("دسترسی غیرمجاز");
    }

    await db.modelProvider.delete({ where: { id: providerId } });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "delete",
      resourceType: "model_provider",
      resourceId: providerId,
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[Model Provider API] DELETE error:", err);
    return internalError();
  }
}
