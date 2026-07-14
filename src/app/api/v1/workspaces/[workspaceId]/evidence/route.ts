import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  created,
  badRequest,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
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

    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get("claimId");

    const where: Record<string, unknown> = {};
    if (claimId) where.claimId = claimId;

    // Get evidence through claims in this workspace
    const evidence = await db.evidence.findMany({
      where: {
        claim: { workspaceId },
        ...where,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        claim: { select: { id: true, statement: true } },
        source: { select: { id: true, title: true, type: true } },
      },
    });

    return ok(evidence);
  } catch (err) {
    console.error("[Evidence API] GET error:", err);
    return internalError();
  }
}

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
    const { claimId, excerpt, sourceId, confidence } = body;

    if (!claimId || !excerpt) {
      return badRequest("claimId و excerpt لازم است");
    }

    const evidence = await db.evidence.create({
      data: {
        claimId,
        sourceId: sourceId || null,
        excerpt,
        confidence: confidence ?? 1.0,
        authoredBy: `user:${auth.userId}`,
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "evidence",
      resourceId: evidence.id,
    });

    return created(evidence);
  } catch (err) {
    console.error("[Evidence API] POST error:", err);
    return internalError();
  }
}
