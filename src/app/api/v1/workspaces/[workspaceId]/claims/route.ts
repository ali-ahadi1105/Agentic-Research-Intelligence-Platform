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
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: Record<string, unknown> = { workspaceId };
    if (status) where.status = status;

    const claims = await db.claim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        entities: { include: { entity: true } },
        evidence: { include: { source: true } },
      },
    });

    return ok(claims);
  } catch (err) {
    console.error("[Claims API] GET error:", err);
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
    const { statement, type, confidence, entityIds, evidence } = body;

    if (!statement) {
      return badRequest("statement لازم است");
    }

    const claim = await db.claim.create({
      data: {
        workspaceId,
        statement,
        type: type || "fact",
        confidence: confidence ?? 1.0,
        status: "verified",
        authoredBy: `user:${auth.userId}`,
      },
    });

    if (entityIds && Array.isArray(entityIds)) {
      for (const entityId of entityIds) {
        await db.claimEntity
          .create({
            data: { claimId: claim.id, entityId, role: "subject" },
          })
          .catch(() => null);
      }
    }

    if (evidence && Array.isArray(evidence)) {
      for (const ev of evidence) {
        await db.evidence.create({
          data: {
            claimId: claim.id,
            sourceId: ev.sourceId || null,
            excerpt: ev.excerpt || statement,
            confidence: ev.confidence ?? 1.0,
            authoredBy: `user:${auth.userId}`,
          },
        });
      }
    }

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "claim",
      resourceId: claim.id,
    });

    return created(claim);
  } catch (err) {
    console.error("[Claims API] POST error:", err);
    return internalError();
  }
}
