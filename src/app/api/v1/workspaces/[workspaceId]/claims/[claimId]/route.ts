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

/**
 * PATCH /claims/[claimId]
 * Body: { status: "verified" | "rejected" | "disputed" | "archived", notes?: string }
 * Or: { statement, confidence } for editing
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; claimId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, claimId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const body = await request.json();
    const allowedFields = ["statement", "type", "confidence", "status", "notes"];
    const data: Record<string, unknown> = {};
    for (const f of allowedFields) {
      if (f in body) data[f] = body[f];
    }

    const updated = await db.claim.update({
      where: { id: claimId },
      data,
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: body.status ? "approve" : "update",
      resourceType: "claim",
      resourceId: claimId,
      details: data,
    });

    return ok(updated);
  } catch (err) {
    console.error("[Claim API] PATCH error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; claimId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, claimId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    await db.claim.delete({ where: { id: claimId } });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "delete",
      resourceType: "claim",
      resourceId: claimId,
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[Claim API] DELETE error:", err);
    return internalError();
  }
}
