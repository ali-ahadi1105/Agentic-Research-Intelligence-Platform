import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  notFound,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
} from "@/lib/services/api-helpers";
import { AuditLog } from "@/lib/services/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: {
            sources: true,
            entities: true,
            relationships: true,
            claims: true,
            timelineEvents: true,
            reports: true,
            conversations: true,
          },
        },
      },
    });

    if (!workspace) return notFound("Workspace");

    // Get source status breakdown
    const sourceStats = await db.source.groupBy({
      by: ["status"],
      where: { workspaceId },
      _count: true,
    });

    return ok({ ...workspace, sourceStats });
  } catch (err) {
    console.error("[Workspace API] GET error:", err);
    return internalError();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const body = await request.json();
    const allowedFields = ["name", "description", "researchGoal", "color", "status", "tags"];
    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        if (field === "tags") {
          data.tags = JSON.stringify(body.tags || []);
        } else {
          data[field] = body[field];
        }
      }
    }

    const updated = await db.workspace.update({
      where: { id: workspaceId },
      data,
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "update",
      resourceType: "workspace",
      resourceId: workspaceId,
      details: data,
    });

    return ok(updated);
  } catch (err) {
    console.error("[Workspace API] PATCH error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    // Soft delete
    await db.workspace.update({
      where: { id: workspaceId },
      data: { status: "deleted" },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "delete",
      resourceType: "workspace",
      resourceId: workspaceId,
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[Workspace API] DELETE error:", err);
    return internalError();
  }
}
