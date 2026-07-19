/**
 * Vector Store Service using PostgreSQL + pgvector
 */
import "server-only";
import { db } from "../db";

export interface VectorSearchResult {
  chunkId: string;
  distance: number;
}

/**
 * Store or update an embedding for a chunk.
 */
export async function storeEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  if (embedding.length === 0) return;
  const vectorStr = `[${embedding.join(",")}]`;
  await db.$executeRawUnsafe(
    `UPDATE "Chunk" SET "embedding" = cast($1 as vector) WHERE "id" = $2`,
    vectorStr,
    chunkId
  );
}

/**
 * Store embeddings for multiple chunks in a single transaction.
 */
export async function storeEmbeddings(
  items: { chunkId: string; embedding: number[] }[]
): Promise<void> {
  if (items.length === 0) return;

  for (const item of items) {
    try {
      const vectorStr = `[${item.embedding.join(",")}]`;
      await db.$executeRawUnsafe(
        `UPDATE "Chunk" SET "embedding" = cast($1 as vector) WHERE "id" = $2`,
        vectorStr,
        item.chunkId
      );
    } catch (err) {
      console.warn(`[VectorStore] Failed to store embedding for chunk ${item.chunkId} (${item.embedding.length}dims):`, (err as Error)?.message?.slice(0, 100));
    }
  }
}

/**
 * Search for the k most similar chunks to a query embedding.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  k: number = 10
): Promise<VectorSearchResult[]> {
  if (queryEmbedding.length === 0) return [];

  const vectorStr = `[${queryEmbedding.join(",")}]`;
  try {
    const rows = await db.$queryRawUnsafe<{ id: string; distance: number }[]>(
      `SELECT "id", "embedding" <=> cast($1 as vector) AS "distance"
       FROM "Chunk"
       WHERE "embedding" IS NOT NULL
       ORDER BY "embedding" <=> cast($1 as vector)
       LIMIT $2`,
      vectorStr,
      k
    );

    return rows.map((r) => ({
      chunkId: r.id,
      distance: Number(r.distance),
    }));
  } catch (error) {
    console.warn("[VectorStore] Search failed:", error);
    return [];
  }
}

/**
 * Delete an embedding for a chunk.
 */
export async function deleteEmbedding(chunkId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE "Chunk"
    SET "embedding" = NULL
    WHERE "id" = ${chunkId}
  `;
}

/**
 * Delete all embeddings for the given chunk IDs.
 */
export async function deleteEmbeddingsForChunks(chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return;
  await db.$executeRawUnsafe(
    `UPDATE "Chunk" SET "embedding" = NULL WHERE "id" = ANY($1::text[])`,
    chunkIds
  );
}

/**
 * Get the count of stored embeddings.
 */
export async function getEmbeddingCount(): Promise<number> {
  try {
    const result = await db.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int as "count"
      FROM "Chunk"
      WHERE "embedding" IS NOT NULL
    `;
    return result[0]?.count || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if a chunk has an embedding stored.
 */
export async function hasEmbedding(chunkId: string): Promise<boolean> {
  try {
    const result = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1
        FROM "Chunk"
        WHERE "id" = ${chunkId} AND "embedding" IS NOT NULL
      ) as "exists"
    `;
    return result[0]?.exists || false;
  } catch {
    return false;
  }
}
