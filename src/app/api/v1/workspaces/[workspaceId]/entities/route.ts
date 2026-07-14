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
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: Record<string, unknown> = { workspaceId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const entities = await db.entity.findMany({
      where,
      orderBy: { confidence: "desc" },
      take: limit,
      include: {
        _count: {
          select: {
            claimEntities: true,
            sourceRelations: true,
            targetRelations: true,
          },
        },
      },
    });

    return ok(entities);
  } catch (err) {
    console.error("[Entities API] GET error:", err);
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
    const { name, type, description, aliases, attributes, confidence } = body;

    if (!name || !type) {
      return badRequest("name و type لازم است");
    }

    const entity = await db.entity.create({
      data: {
        workspaceId,
        name,
        type,
        description: description || null,
        aliases: JSON.stringify(aliases || []),
        attributes: JSON.stringify(attributes || {}),
        confidence: confidence ?? 1.0,
        status: "verified",
        sourceCount: 0,
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "entity",
      resourceId: entity.id,
      details: { name, type },
    });

    return created(entity);
  } catch (err) {
    console.error("[Entities API] POST error:", err);
    return internalError();
  }
}
