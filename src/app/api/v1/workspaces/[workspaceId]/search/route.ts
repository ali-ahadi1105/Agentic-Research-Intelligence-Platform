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
import { semanticSearch } from "@/lib/services/semantic-search";

/**
 * GET /search?q=...&type=entities|claims|evidence|chunks|all
 * Hybrid search across the workspace knowledge base.
 * For chunks, uses TF-IDF semantic search.
 * For entities/claims/evidence, uses keyword matching with ranking.
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
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all";

    if (!q) return ok({ entities: [], claims: [], evidence: [], chunks: [], sources: [] });

    const keywords = q.split(/\s+/).filter((w) => w.length > 1);

    const results: {
      entities: unknown[];
      claims: unknown[];
      evidence: unknown[];
      chunks: unknown[];
      sources: unknown[];
    } = {
      entities: [],
      claims: [],
      evidence: [],
      chunks: [],
      sources: [],
    };

    // Semantic search on chunks (TF-IDF + cosine similarity)
    if (type === "all" || type === "chunks") {
      const chunkResults = await semanticSearch(workspaceId, q, 10);
      results.chunks = chunkResults.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        content: r.content.slice(0, 300) + (r.content.length > 300 ? "..." : ""),
        score: Math.round(r.score * 100) / 100,
        sourceTitle: r.sourceTitle,
        sourceType: r.sourceType,
      }));
    }

    if (type === "all" || type === "entities") {
      results.entities = await db.entity.findMany({
        where: {
          workspaceId,
          OR: keywords.flatMap((kw) => [
            { name: { contains: kw } },
            { description: { contains: kw } },
          ]),
        },
        take: 20,
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          confidence: true,
        },
      });
    }

    if (type === "all" || type === "claims") {
      results.claims = await db.claim.findMany({
        where: {
          workspaceId,
          OR: keywords.map((kw) => ({ statement: { contains: kw } })),
        },
        take: 20,
        select: {
          id: true,
          statement: true,
          confidence: true,
          status: true,
        },
      });
    }

    if (type === "all" || type === "evidence") {
      results.evidence = await db.evidence.findMany({
        where: {
          claim: { workspaceId },
          OR: keywords.map((kw) => ({ excerpt: { contains: kw } })),
        },
        take: 20,
        include: {
          claim: { select: { id: true, statement: true } },
          source: { select: { id: true, title: true } },
        },
      });
    }

    if (type === "all" || type === "sources") {
      results.sources = await db.source.findMany({
        where: {
          workspaceId,
          OR: keywords.map((kw) => ({ title: { contains: kw } })),
        },
        take: 20,
        select: { id: true, title: true, type: true, status: true },
      });
    }

    return ok(results);
  } catch (err) {
    console.error("[Search API] GET error:", err);
    return internalError();
  }
}
