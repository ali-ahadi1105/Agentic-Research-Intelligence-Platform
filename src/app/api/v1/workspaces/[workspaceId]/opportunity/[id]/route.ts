import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
} from "@/lib/services/api-helpers";

/**
 * GET /api/v1/workspaces/[workspaceId]/opportunity/[id]
 * Get a single opportunity analysis.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, id } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const analysis = await db.opportunity.findUnique({
      where: { id },
    });

    if (!analysis || analysis.workspaceId !== workspaceId) {
      return notFound("Opportunity");
    }

    return ok(analysis);
  } catch (err) {
    console.error("[Opportunity API] GET by ID error:", err);
    return internalError();
  }
}

/**
 * DELETE /api/v1/workspaces/[workspaceId]/opportunity/[id]
 * Delete an opportunity analysis.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, id } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const analysis = await db.opportunity.findUnique({
      where: { id },
    });

    if (!analysis || analysis.workspaceId !== workspaceId) {
      return notFound("Opportunity");
    }

    await db.opportunity.delete({ where: { id } });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[Opportunity API] DELETE error:", err);
    return internalError();
  }
}
