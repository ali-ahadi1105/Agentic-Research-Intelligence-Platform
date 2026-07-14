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

    const relationships = await db.relationship.findMany({
      where: { workspaceId },
      orderBy: { confidence: "desc" },
      take: 100,
      include: {
        sourceEntity: { select: { id: true, name: true, type: true } },
        targetEntity: { select: { id: true, name: true, type: true } },
      },
    });

    return ok(relationships);
  } catch (err) {
    console.error("[Relationships API] GET error:", err);
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
    const { sourceEntityId, targetEntityId, type, confidence } = body;

    if (!sourceEntityId || !targetEntityId || !type) {
      return badRequest("sourceEntityId, targetEntityId و type لازم است");
    }

    const relationship = await db.relationship.create({
      data: {
        workspaceId,
        sourceEntityId,
        targetEntityId,
        type,
        confidence: confidence ?? 1.0,
        status: "verified",
      },
    });

    return created(relationship);
  } catch (err) {
    console.error("[Relationships API] POST error:", err);
    return internalError();
  }
}
