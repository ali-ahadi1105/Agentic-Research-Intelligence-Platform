import { NextRequest } from "next/server";
import {
  getAuthContext,
  ok,
  badRequest,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
} from "@/lib/services/api-helpers";
import { runAutoResearch } from "@/lib/services/auto-research";
import { AuditLog } from "@/lib/services/audit";

/**
 * POST /api/v1/workspaces/[workspaceId]/auto-research
 * Body: { goal?: string, maxQueries?: number, maxPages?: number }
 * Start automated research on a workspace.
 */
export async function POST(
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
    const { goal, maxQueries = 3, maxPages = 5 } = body;

    if (maxQueries > 10 || maxPages > 20) {
      return badRequest("maxQueries ≤ 10, maxPages ≤ 20");
    }

    const result = await runAutoResearch(workspaceId, goal, maxQueries, maxPages);

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "auto_research",
      resourceId: workspaceId,
      details: { goal, maxQueries, maxPages },
    });

    return ok(result);
  } catch (err) {
    console.error("[AutoResearch API] Error:", err);
    return internalError();
  }
}
