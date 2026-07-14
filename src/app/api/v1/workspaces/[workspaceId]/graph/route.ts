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
 * GET /graph
 * Returns nodes (entities) and edges (relationships) for graph visualization.
 * Query params:
 *   - type: filter entities by type
 *   - minConfidence: minimum confidence threshold (default 0.3)
 *   - limit: max entities (default 100)
 */
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
    const typeFilter = searchParams.get("type");
    const minConfidence = parseFloat(searchParams.get("minConfidence") || "0.3");
    const limit = parseInt(searchParams.get("limit") || "100");
    const statusFilter = searchParams.get("status");

    const entityWhere: Record<string, unknown> = {
      workspaceId,
      confidence: { gte: minConfidence },
      status: { not: "rejected" },
    };
    if (typeFilter) entityWhere.type = typeFilter;
    if (statusFilter) entityWhere.status = statusFilter;

    const entities = await db.entity.findMany({
      where: entityWhere,
      take: limit,
      orderBy: { confidence: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        confidence: true,
        status: true,
      },
    });

    const entityIds = new Set(entities.map((e) => e.id));

    const relationships = await db.relationship.findMany({
      where: {
        workspaceId,
        sourceEntityId: { in: Array.from(entityIds) },
        targetEntityId: { in: Array.from(entityIds) },
        confidence: { gte: minConfidence },
        status: { not: "rejected" },
      },
      select: {
        id: true,
        sourceEntityId: true,
        targetEntityId: true,
        type: true,
        confidence: true,
      },
    });

    return ok({
      nodes: entities.map((e) => ({
        id: e.id,
        label: e.name,
        type: e.type,
        description: e.description,
        confidence: e.confidence,
        status: e.status,
      })),
      edges: relationships.map((r) => ({
        id: r.id,
        source: r.sourceEntityId,
        target: r.targetEntityId,
        type: r.type,
        confidence: r.confidence,
      })),
      stats: {
        nodeCount: entities.length,
        edgeCount: relationships.length,
        typeBreakdown: countBy(entities.map((e) => e.type)),
      },
    });
  } catch (err) {
    console.error("[Graph API] GET error:", err);
    return internalError();
  }
}

function countBy<T extends string>(arr: T[]): Record<string, number> {
  return arr.reduce(
    (acc, v) => {
      acc[v] = (acc[v] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}
