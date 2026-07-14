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
import { processSourceKnowledge } from "@/lib/services/pipeline";

/**
 * GET /documents/[sourceId]
 * Returns the source with its document and processing status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, sourceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const source = await db.source.findUnique({
      where: { id: sourceId },
      include: {
        document: {
          select: {
            id: true,
            content: true,
            wordCount: true,
            language: true,
            metadata: true,
          },
        },
        _count: { select: { evidence: true } },
      },
    });

    if (!source || source.workspaceId !== workspaceId) {
      return notFound("Source");
    }

    return ok(source);
  } catch (err) {
    console.error("[Source API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /documents/[sourceId]?action=reprocess
 * Re-trigger knowledge extraction for a source.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, sourceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "reprocess";

    if (action === "reprocess") {
      const source = await db.source.findUnique({
        where: { id: sourceId },
        include: { document: true },
      });
      if (!source || source.workspaceId !== workspaceId) {
        return notFound("Source");
      }
      if (!source.document) {
        return notFound("Document");
      }

      await db.source.update({
        where: { id: sourceId },
        data: { status: "processing", processingProgress: 5, processingError: null },
      });

      // Trigger async processing
      processSourceKnowledge(sourceId).catch((err) => {
        console.error(`[Source API] Reprocess failed for ${sourceId}:`, err);
      });

      return ok({ reprocessing: true });
    }

    return notFound("Action");
  } catch (err) {
    console.error("[Source API] POST error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sourceId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, sourceId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    await db.source.delete({ where: { id: sourceId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[Source API] DELETE error:", err);
    return internalError();
  }
}
