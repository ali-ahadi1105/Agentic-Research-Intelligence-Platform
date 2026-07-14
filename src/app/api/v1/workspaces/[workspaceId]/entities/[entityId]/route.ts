import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  badRequest,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
} from "@/lib/services/api-helpers";
import { AuditLog } from "@/lib/services/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; entityId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, entityId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const body = await request.json();
    const allowedFields = [
      "name",
      "type",
      "description",
      "aliases",
      "attributes",
      "confidence",
      "status",
    ];
    const data: Record<string, unknown> = {};
    for (const f of allowedFields) {
      if (f in body) {
        if (f === "aliases" || f === "attributes") {
          data[f] = JSON.stringify(body[f] || (f === "aliases" ? [] : {}));
        } else {
          data[f] = body[f];
        }
      }
    }

    const updated = await db.entity.update({
      where: { id: entityId },
      data,
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "update",
      resourceType: "entity",
      resourceId: entityId,
      details: data,
    });

    return ok(updated);
  } catch (err) {
    console.error("[Entity API] PATCH error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; entityId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, entityId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    await db.entity.delete({ where: { id: entityId } });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "delete",
      resourceType: "entity",
      resourceId: entityId,
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[Entity API] DELETE error:", err);
    return internalError();
  }
}

/**
 * POST /entities/[entityId]?action=merge  body: { targetEntityId }
 * Merge two entities: moves all claims/relationships to target, deletes source.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; entityId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, entityId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    if (action === "merge") {
      const body = await request.json();
      const { targetEntityId } = body;
      if (!targetEntityId) return badRequest("targetEntityId لازم است");

      const source = await db.entity.findUnique({ where: { id: entityId } });
      const target = await db.entity.findUnique({ where: { id: targetEntityId } });
      if (!source || !target) return notFound("Entity");

      // Move claim entities
      await db.claimEntity.updateMany({
        where: { entityId },
        data: { entityId: targetEntityId },
      });

      // Move relationships where this entity is source
      await db.relationship.updateMany({
        where: { sourceEntityId: entityId },
        data: { sourceEntityId: targetEntityId },
      });

      // Move relationships where this entity is target
      await db.relationship.updateMany({
        where: { targetEntityId: entityId },
        data: { targetEntityId: targetEntityId },
      });

      // Update timeline events
      await db.timelineEvent.updateMany({
        where: { entityId },
        data: { entityId: targetEntityId },
      });

      // Mark source as merged
      await db.entity.update({
        where: { id: entityId },
        data: { status: "merged", mergedIntoId: targetEntityId },
      });

      await AuditLog.log({
        userId: auth.userId,
        organizationId: auth.organizationId,
        action: "update",
        resourceType: "entity",
        resourceId: entityId,
        details: { action: "merge", targetEntityId },
      });

      return ok({ merged: true, targetEntityId });
    }

    return badRequest("action نامعتبر است (merge)");
  } catch (err) {
    console.error("[Entity API] POST error:", err);
    return internalError();
  }
}
