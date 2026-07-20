/**
 * Semantic Search Service (per PROJECT.md § 66)
 *
 * REAL vector-based semantic search using sqlite-vec.
 *
 * How it works:
 *   1. When documents are processed, each chunk is embedded via the LLM provider
 *      (OpenAI text-embedding-3-small, or whatever EMBEDDING_MODEL is configured).
 *   2. Embeddings are stored in a sqlite-vec virtual table (chunk_embeddings)
 *      for fast native vector similarity search.
 *   3. At query time, the query is embedded using the same model.
 *   4. sqlite-vec computes cosine distance natively (very fast).
 *   5. Top-K most similar chunks are returned.
 *
 * If embeddings are not available (no API key configured), falls back to
 * keyword-based matching.
 *
 * For PostgreSQL + pgvector migration:
 *   - Drop this file's sqlite-vec usage
 *   - Add `embedding Unsupported("vector(1536)")` to Chunk model in Prisma
 *   - Use: SELECT * FROM chunk ORDER BY embedding <=> $1 LIMIT 10
 */
import "server-only";
import { db } from "../db";
import { generateEmbedding } from "../ai/client";
import {
  storeEmbedding,
  storeEmbeddings,
  searchSimilar,
  hasEmbedding,
  getEmbeddingCount,
  deleteEmbeddingsForChunks,
  type VectorSearchResult,
} from "./vector-store";

export interface SemanticSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  score: number; // 0-1, higher = more similar
  sourceTitle?: string;
  sourceType?: string;
}

/**
 * Generate and store embeddings for all chunks in a workspace that don't have them yet.
 * Called automatically during the pipeline after document processing.
 */
export async function buildWorkspaceIndex(workspaceId: string): Promise<void> {
  // Find chunks that don't have embeddings in the vector store yet
  const chunks = await db.chunk.findMany({
    where: { document: { source: { workspaceId } } },
    select: { id: true, content: true },
    take: 500,
  });

  if (chunks.length === 0) {
    console.log(`[SemanticSearch] No chunks found for workspace ${workspaceId}`);
    return;
  }

  // Filter to only chunks without embeddings
  const chunksWithEmbeddings = new Set<string>();
  for (const chunk of chunks) {
    if (await hasEmbedding(chunk.id)) {
      chunksWithEmbeddings.add(chunk.id);
    }
  }
  const chunksToEmbed = chunks.filter((c) => !chunksWithEmbeddings.has(c.id));

  if (chunksToEmbed.length === 0) {
    console.log(`[SemanticSearch] All ${chunks.length} chunks already have embeddings`);
    return;
  }

  console.log(
    `[SemanticSearch] Generating embeddings for ${chunksToEmbed.length}/${chunks.length} chunks...`
  );

  // Generate embeddings in batches
  const BATCH_SIZE = 10;
  let embeddedCount = 0;

  for (let i = 0; i < chunksToEmbed.length; i += BATCH_SIZE) {
    const batch = chunksToEmbed.slice(i, i + BATCH_SIZE);
    try {
      const { generateEmbeddings } = await import("../ai/client");
      const embeddings = await generateEmbeddings(batch.map((c) => c.content));

      const itemsToStore = batch
        .map((chunk, j) => ({
          chunkId: chunk.id,
          embedding: embeddings[j] || [],
        }))
        .filter((item) => item.embedding.length > 0);

      if (itemsToStore.length > 0) {
        await storeEmbeddings(itemsToStore);
        embeddedCount += itemsToStore.length;
      }

      console.log(
        `[SemanticSearch] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunksToEmbed.length / BATCH_SIZE)} (${embeddedCount} total)`
      );
    } catch (err) {
      console.error(`[SemanticSearch] Failed to embed batch:`, err);
    }
  }

  console.log(
    `[SemanticSearch] Index build complete: ${embeddedCount}/${chunksToEmbed.length} chunks embedded`
  );
}

/**
 * Semantic search across workspace chunks using real vector embeddings.
 *
 * 1. Generate embedding for the query using the same model used for chunks.
 * 2. Use sqlite-vec to find the k most similar chunks (native C implementation).
 * 3. Fetch chunk content from Prisma.
 * 4. Convert distance to similarity score (0-1).
 *
 * If embeddings are not available, falls back to keyword matching.
 */
export async function semanticSearch(
  workspaceId: string,
  query: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  // Try vector search first
  try {
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding.length > 0 && (await getEmbeddingCount()) > 0) {
      // Use sqlite-vec for native vector search (very fast)
      const vectorResults = await searchSimilar(queryEmbedding, limit * 2).catch((err) => {
        // Handle dimension mismatch: if the query embedding model differs from chunk embedding model
        console.warn("[SemanticSearch] Vector search query failed (dimension mismatch?), falling back to keyword:", err.message?.slice(0, 150));
        return [] as VectorSearchResult[];
      }); // fetch extra in case some don't belong to this workspace

      if (vectorResults.length > 0) {
        // Fetch chunk details from Prisma, filtered by workspace
        const chunkIds = vectorResults.map((r) => r.chunkId);
        const chunks = await db.chunk.findMany({
          where: {
            id: { in: chunkIds },
            document: { source: { workspaceId } },
          },
          select: {
            id: true,
            content: true,
            documentId: true,
            document: {
              select: {
                source: { select: { title: true, type: true } },
              },
            },
          },
        });

        // Build results with scores, sorted by distance
        const chunkMap = new Map(chunks.map((c) => [c.id, c]));
        const results: SemanticSearchResult[] = [];

        for (const vr of vectorResults) {
          const chunk = chunkMap.get(vr.chunkId);
          if (!chunk) continue; // chunk doesn't belong to this workspace or doesn't exist

          // Convert distance to similarity score (cosine distance 0 = identical, 2 = opposite)
          // score = 1 - (distance / 2), clamped to 0-1
          const score = Math.max(0, 1 - vr.distance / 2);

          results.push({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            content: chunk.content,
            score,
            sourceTitle: chunk.document?.source?.title || undefined,
            sourceType: chunk.document?.source?.type || undefined,
          });
        }

        if (results.length > 0) {
          return results.slice(0, limit);
        }
      }
    }
  } catch (err) {
    console.warn("[SemanticSearch] Vector search failed, falling back to keyword search:", err);
  }

  // Fallback: keyword-based search
  return keywordSearch(workspaceId, query, limit);
}

/**
 * Fallback keyword search when embeddings are not available.
 */
async function keywordSearch(
  workspaceId: string,
  query: string,
  limit: number
): Promise<SemanticSearchResult[]> {
  const chunks = await db.chunk.findMany({
    where: { document: { source: { workspaceId } } },
    select: {
      id: true,
      content: true,
      documentId: true,
      document: {
        select: {
          source: { select: { title: true, type: true } },
        },
      },
    },
    take: 500,
  });

  const queryTokens = query
    .toLowerCase()
    .replace(/[^\u0600-\u06ff\u0041-\u007a\u0030-\u0039\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const results: SemanticSearchResult[] = [];

  for (const chunk of chunks) {
    const contentLower = chunk.content.toLowerCase();
    let matchCount = 0;
    for (const token of queryTokens) {
      if (contentLower.includes(token)) matchCount += 1;
    }
    const score = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;

    if (score > 0) {
      results.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        score,
        sourceTitle: chunk.document?.source?.title || undefined,
        sourceType: chunk.document?.source?.type || undefined,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Find chunks semantically similar to a given text (for RAG context retrieval).
 */
export async function findSimilarChunks(
  workspaceId: string,
  text: string,
  limit: number = 5
): Promise<SemanticSearchResult[]> {
  return semanticSearch(workspaceId, text, limit);
}

/**
 * Delete all embeddings for chunks in a workspace.
 * Useful when reprocessing or deleting a workspace.
 */
export async function deleteWorkspaceEmbeddings(workspaceId: string): Promise<void> {
  const chunks = await db.chunk.findMany({
    where: { document: { source: { workspaceId } } },
    select: { id: true },
  });

  if (chunks.length > 0) {
    await deleteEmbeddingsForChunks(chunks.map((c) => c.id));
  }
}

/**
 * Get statistics about the vector index.
 */
export async function getVectorIndexStats(): Promise<{ count: number }> {
  return { count: await getEmbeddingCount() };
}
