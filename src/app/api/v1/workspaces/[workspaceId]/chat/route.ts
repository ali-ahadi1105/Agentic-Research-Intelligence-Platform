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
import { answerWithKnowledgeBase } from "@/lib/ai/agents";

/**
 * GET /chat
 * List all conversations in workspace.
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

    const conversations = await db.conversation.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });

    return ok(conversations);
  } catch (err) {
    console.error("[Chat API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /chat
 * Body options:
 *   - { action: "create_conversation", title? }
 *   - { action: "send", conversationId, question }
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
    const { action } = body;

    if (action === "create_conversation") {
      const conversation = await db.conversation.create({
        data: {
          workspaceId,
          title: body.title || "گفتگوی جدید",
        },
      });
      return created(conversation);
    }

    if (action === "send") {
      const { conversationId, question } = body;
      if (!conversationId || !question) {
        return badRequest("conversationId و question لازم است");
      }

      const conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: {
          workspace: { select: { name: true, researchGoal: true } },
        },
      });
      if (!conversation || conversation.workspaceId !== workspaceId) {
        return notFound("Conversation");
      }

      // Save user message
      await db.message.create({
        data: {
          conversationId,
          role: "user",
          content: question,
        },
      });

      // Knowledge Base retrieval — REAL RAG using vector embeddings
      // 1. Use semantic search to find chunks most relevant to the question
      // 2. Find claims connected to those chunks
      // 3. Find entities mentioned in those claims
      const { semanticSearch } = await import("@/lib/services/semantic-search");

      // Vector similarity search on chunks
      const similarChunks = await semanticSearch(workspaceId, question, 5);

      // Get claims by keyword matching (as a complementary signal)
      const keywords = question
        .split(/\s+/)
        .filter((w: string) => w.length > 2)
        .slice(0, 8);

      const keywordClaims = await db.claim.findMany({
        where: {
          workspaceId,
          status: { not: "rejected" },
          OR: keywords.map((kw: string) => ({
            statement: { contains: kw },
          })),
        },
        take: 10,
        orderBy: { confidence: "desc" },
        include: {
          evidence: {
            take: 2,
            include: { source: { select: { title: true } } },
          },
          entities: { include: { entity: true } },
        },
      });

      // Merge results — deduplicate by claim ID
      const claimMap = new Map<string, typeof keywordClaims[number]>();
      for (const c of keywordClaims) claimMap.set(c.id, c);

      // If we have semantic search results, also pull claims connected to those chunks
      if (similarChunks.length > 0) {
        const chunkIds = similarChunks.map((c) => c.chunkId);
        const evidenceFromChunks = await db.evidence.findMany({
          where: { chunkId: { in: chunkIds } },
          take: 20,
          include: {
            claim: {
              include: {
                evidence: {
                  take: 2,
                  include: { source: { select: { title: true } } },
                },
                entities: { include: { entity: true } },
              },
            },
          },
        });
        for (const ev of evidenceFromChunks) {
          if (ev.claim && !claimMap.has(ev.claim.id)) {
            claimMap.set(ev.claim.id, ev.claim);
          }
        }
      }

      const claimsForContext = Array.from(claimMap.values()).slice(0, 10);

      // Find entities mentioned in the retrieved claims
      const entityIdsFromClaims = new Set<string>();
      for (const c of claimsForContext) {
        for (const ce of c.entities || []) {
          entityIdsFromClaims.add(ce.entityId);
        }
      }

      // Also search entities by keyword
      const keywordEntities = await db.entity.findMany({
        where: {
          workspaceId,
          status: { not: "rejected" },
          OR: keywords.map((kw: string) => [
            { name: { contains: kw } },
            { description: { contains: kw } },
          ]).flat(),
        },
        take: 10,
        select: { id: true, name: true, type: true, description: true },
      });

      // Merge entities from both sources
      const relevantEntities = await db.entity.findMany({
        where: {
          id: { in: Array.from(entityIdsFromClaims) },
        },
        take: 10,
        select: { id: true, name: true, type: true, description: true },
      });

      const allEntities = [...relevantEntities, ...keywordEntities.filter(
        (e) => !relevantEntities.some((re) => re.id === e.id)
      )].slice(0, 10);

      const relevantRelationships = await db.relationship.findMany({
        where: {
          workspaceId,
          status: { not: "rejected" },
          OR: [
            {
              sourceEntity: {
                name: { in: allEntities.map((e) => e.name) },
              },
            },
            {
              targetEntity: {
                name: { in: allEntities.map((e) => e.name) },
              },
            },
          ],
        },
        take: 10,
        select: {
          sourceEntity: { select: { name: true } },
          targetEntity: { select: { name: true } },
          type: true,
        },
      });

      const timelineEvents = await db.timelineEvent.findMany({
        where: { workspaceId },
        take: 5,
        orderBy: { eventDate: "desc" },
        select: { title: true, description: true, eventDate: true },
      });

      // Get conversation history
      const history = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { role: true, content: true },
      });

      // Build context for the LLM
      const claimContext = claimsForContext.map((c) => ({
        id: c.id,
        statement: c.statement,
        confidence: c.confidence,
        excerpt: c.evidence[0]?.excerpt || c.statement,
        sourceTitle: c.evidence[0]?.source?.title || "بدون منبع",
      }));

      const answer = await answerWithKnowledgeBase(question, {
        workspaceName: conversation.workspace.name,
        researchGoal: conversation.workspace.researchGoal || "",
        relevantClaims: claimContext,
        relevantChunks: similarChunks.map((ch) => ({
          content: ch.content,
          sourceTitle: ch.sourceTitle || "بدون عنوان",
          score: ch.score,
        })),
        relevantEntities: allEntities.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          description: e.description,
        })),
        relevantRelationships: relevantRelationships.map((r) => ({
          source: r.sourceEntity.name,
          target: r.targetEntity.name,
          type: r.type,
        })),
        timelineEvents: timelineEvents.map((t) => ({
          title: t.title,
          description: t.description,
          eventDate: t.eventDate ? t.eventDate.toISOString() : null,
        })),
        conversationHistory: history.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Save assistant message with citations
      const citations = claimsForContext.map((c, i) => ({
        index: i + 1,
        claimId: c.id,
        statement: c.statement,
        excerpt: c.evidence[0]?.excerpt || c.statement,
        sourceTitle: c.evidence[0]?.source?.title || "بدون منبع",
        confidence: c.confidence,
      }));

      const assistantMessage = await db.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: answer,
          citations: JSON.stringify(citations),
          relatedEntities: JSON.stringify(
            allEntities.slice(0, 5).map((e) => e.id)
          ),
          confidence: Math.min(
            ...claimsForContext.map((c) => c.confidence),
            0.8
          ),
        },
      });

      // Return parsed message for frontend
      const responseMessage = {
        ...assistantMessage,
        citations: citations as unknown[],
        relatedEntities: allEntities.slice(0, 5).map((e) => e.id),
      };

      // Update conversation title if it's the first exchange
      if (history.length === 1 && conversation.title === "گفتگوی جدید") {
        await db.conversation.update({
          where: { id: conversationId },
          data: {
            title: question.slice(0, 60),
            updatedAt: new Date(),
          },
        });
      } else {
        await db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      }

      return ok({
        message: responseMessage,
        answer,
        citations,
        relatedEntities: allEntities.slice(0, 5),
      });
    }

    return badRequest("action نامعتبر است (create_conversation | send)");
  } catch (err) {
    console.error("[Chat API] POST error:", err);
    return internalError();
  }
}
