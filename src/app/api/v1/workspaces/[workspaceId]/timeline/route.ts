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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const where: Record<string, unknown> = { workspaceId };
    if (type) where.type = type;

    const events = await db.timelineEvent.findMany({
      where,
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    // If any events have entityId, fetch the entity names separately
    const entityIds = events
      .map((e) => e.entityId)
      .filter((id): id is string => id !== null);
    const entities = entityIds.length > 0
      ? await db.entity.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const entityMap = new Map(entities.map((e) => [e.id, e]));

    const eventsWithEntities = events.map((e) => ({
      ...e,
      entity: e.entityId ? entityMap.get(e.entityId) || null : null,
    }));

    return ok(eventsWithEntities);
  } catch (err) {
    console.error("[Timeline API] GET error:", err);
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
    const { title, description, eventDate, type, entityId } = body;

    if (!title) return badRequest("title لازم است");

    const event = await db.timelineEvent.create({
      data: {
        workspaceId,
        title,
        description: description || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventDateStr: eventDate || null,
        type: type || "event",
        entityId: entityId || null,
        confidence: 1.0,
      },
    });

    return created(event);
  } catch (err) {
    console.error("[Timeline API] POST error:", err);
    return internalError();
  }
}
