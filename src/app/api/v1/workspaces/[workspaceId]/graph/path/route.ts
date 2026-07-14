import { NextRequest, NextResponse } from "next/server";
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
import { findShortestPath } from "@/lib/services/graph-analytics";

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
    const sourceId = searchParams.get("source");
    const targetId = searchParams.get("target");

    if (!sourceId || !targetId) {
      return badRequest("source و target لازم است");
    }

    const path = await findShortestPath(workspaceId, sourceId, targetId);

    return ok(path);
  } catch (err) {
    console.error("[Graph Path API] GET error:", err);
    return internalError();
  }
}
