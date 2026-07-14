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
 * GET /chat/[conversationId]
 * Returns all messages in a conversation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; conversationId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, conversationId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation || conversation.workspaceId !== workspaceId) {
      return notFound("Conversation");
    }

    // Parse JSON fields
    const messages = conversation.messages.map((m) => ({
      ...m,
      citations: JSON.parse(m.citations || "[]"),
      relatedEntities: JSON.parse(m.relatedEntities || "[]"),
    }));

    return ok({ ...conversation, messages });
  } catch (err) {
    console.error("[Chat messages API] GET error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; conversationId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, conversationId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    await db.conversation.delete({ where: { id: conversationId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[Chat API] DELETE error:", err);
    return internalError();
  }
}
