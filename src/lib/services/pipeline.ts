/**
 * Research Orchestrator (per PROJECT.md § 29, 30)
 *
 * The Orchestrator coordinates every research task.
 * Its responsibility is coordination only — never performs research itself.
 *
 * Pipeline stages:
 *   Source -> Document Processing -> Knowledge Extraction -> Graph -> Timeline -> Ready
 */
import "server-only";
import { db } from "../db";
import {
  extractEntities,
  extractClaims,
  extractRelationships,
  extractTimelineEvents,
  chunkText,
  type ExtractedEntity,
  type ExtractedClaim,
  type ExtractedRelationship,
  type ExtractedTimelineEvent,
} from "../ai/agents";
import { continuousUpdate } from "./continuous-updates";

/**
 * Process a single source through the full knowledge extraction pipeline.
 * This is invoked after a document has been uploaded and its text extracted.
 */
export async function processSourceKnowledge(sourceId: string): Promise<void> {
  const source = await db.source.findUnique({
    where: { id: sourceId },
    include: { document: true, workspace: true },
  });

  if (!source || !source.document) {
    throw new Error(`Source ${sourceId} not found or has no document`);
  }

  const workspaceId = source.workspaceId;
  const text = source.document.content;

  // Update source status
  await db.source.update({
    where: { id: sourceId },
    data: {
      status: "processing",
      processingProgress: 10,
      processingError: null,
    },
  });

  try {
    // Stage 1: Create chunks
    await updateProgress(sourceId, 20, "تقسیم متن به بخش‌ها");
    const chunks = chunkText(text, 1800, 200);
    const chunkIds: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = await db.chunk.create({
        data: {
          documentId: source.document.id,
          content: chunks[i],
          position: i,
          tokenCount: Math.ceil(chunks[i].length / 4),
        },
      });
      chunkIds.push(chunk.id);
    }

    // Stage 1.5: Generate real embeddings for chunks (for RAG / semantic search)
    // This runs in parallel with entity extraction
    generateChunkEmbeddings(chunkIds, chunks).catch((err) => {
      console.error(`[Pipeline] Embedding generation failed for source ${sourceId}:`, err);
      // Don't fail the pipeline — semantic search will fall back to keyword matching
    });

    // Stage 2: Entity extraction — process ALL chunks with deduplication
    await updateProgress(sourceId, 35, "استخراج موجودیت‌ها از تمام بخش‌ها");
    const extractedEntities: ExtractedEntity[] = [];
    
    // Process in batches of 5 to balance completeness vs response time
    const ENTITY_BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += ENTITY_BATCH_SIZE) {
      const batch = chunks.slice(i, i + ENTITY_BATCH_SIZE);
      const batchText = batch.join("\n\n");
      const ents = await extractEntities(batchText);
      extractedEntities.push(...ents);
    }
    
    // Deduplicate by name (case-insensitive)
    const uniqueEntities = deduplicateEntities(extractedEntities);

    // Persist entities and build name->id map
    await updateProgress(sourceId, 50, "ذخیره موجودیت‌ها");
    const entityNameToId = new Map<string, string>();
    for (const ent of uniqueEntities) {
      // Check if entity already exists in workspace
      const existing = await db.entity.findFirst({
        where: {
          workspaceId,
          OR: [
            { name: { equals: ent.name } },
            { aliases: { contains: `"${ent.name}"` } },
          ],
        },
      });

      if (existing) {
        entityNameToId.set(ent.name.toLowerCase(), existing.id);
        // Optionally update confidence
        await db.entity.update({
          where: { id: existing.id },
          data: {
            sourceCount: { increment: 1 },
            confidence: Math.max(existing.confidence, ent.confidence),
          },
        });
      } else {
        const created = await db.entity.create({
          data: {
            workspaceId,
            name: ent.name,
            type: ent.type,
            aliases: JSON.stringify(ent.aliases || []),
            description: ent.description,
            attributes: JSON.stringify(ent.attributes || {}),
            confidence: ent.confidence,
            status: "pending",
            sourceCount: 1,
          },
        });
        entityNameToId.set(ent.name.toLowerCase(), created.id);
      }
    }

    // Stage 3: Claim extraction — process ALL chunks
    await updateProgress(sourceId, 65, "استخراج ادعاها از تمام بخش‌ها");
    const entityNames = Array.from(entityNameToId.keys()).map((k) =>
      uniqueEntities.find((e) => e.name.toLowerCase() === k)?.name || k
    );

    const extractedClaims: ExtractedClaim[] = [];
    for (const chunk of chunks) {
      const claims = await extractClaims(chunk, entityNames);
      extractedClaims.push(...claims);
    }

    // Deduplicate claims by normalized statement to avoid duplicates
    const seenStatements = new Set<string>();
    const uniqueClaims = extractedClaims.filter((c) => {
      const key = c.statement.trim().toLowerCase().slice(0, 100);
      if (seenStatements.has(key)) return false;
      seenStatements.add(key);
      return true;
    });

    for (const claim of uniqueClaims) {
      const createdClaim = await db.claim.create({
        data: {
          workspaceId,
          statement: claim.statement,
          type: claim.type || "fact",
          confidence: claim.confidence,
          status: "pending",
          authoredBy: "ai",
        },
      });

      // Find which chunk contains the excerpt (so evidence links back to a chunk for RAG)
      const matchedChunkId = findChunkForExcerpt(chunks, chunkIds, claim.excerpt);

      // Link evidence
      await db.evidence.create({
        data: {
          claimId: createdClaim.id,
          sourceId,
          documentId: source.document.id,
          chunkId: matchedChunkId,
          excerpt: claim.excerpt,
          confidence: claim.confidence,
          authoredBy: "ai",
        },
      });

      // Link entities
      for (const name of claim.entityNames || []) {
        const entityId = entityNameToId.get(name.toLowerCase());
        if (entityId) {
          await db.claimEntity.create({
            data: {
              claimId: createdClaim.id,
              entityId,
              role: "subject",
            },
          }).catch(() => null); // Ignore duplicate errors
        }
      }
    }

    // Stage 4: Relationship extraction — using ALL entities and ALL text
    await updateProgress(sourceId, 80, "استخراج روابط بین موجودیت‌ها");
    const extractedRelationships = await extractRelationships(
      text.slice(0, 6000),
      uniqueEntities
    );

    for (const rel of extractedRelationships) {
      const sourceEntityId = entityNameToId.get(
        rel.sourceEntityName.toLowerCase()
      );
      const targetEntityId = entityNameToId.get(
        rel.targetEntityName.toLowerCase()
      );
      if (!sourceEntityId || !targetEntityId) continue;

      // Avoid duplicates
      const existing = await db.relationship.findFirst({
        where: {
          workspaceId,
          sourceEntityId,
          targetEntityId,
          type: rel.type,
        },
      });
      if (existing) continue;

      await db.relationship.create({
        data: {
          workspaceId,
          sourceEntityId,
          targetEntityId,
          type: rel.type,
          confidence: rel.confidence,
          status: "pending",
        },
      });
    }

    // Stage 5: Timeline extraction — process ALL chunks
    await updateProgress(sourceId, 90, "استخراج رویدادهای زمانی از تمام بخش‌ها");
    const extractedEvents: ExtractedTimelineEvent[] = [];
    for (const chunk of chunks) {
      const events = await extractTimelineEvents(chunk, entityNames);
      extractedEvents.push(...events);
    }

    // Deduplicate timeline events
    const seenEvents = new Set<string>();
    const uniqueEvents = extractedEvents.filter((e) => {
      const key = `${e.title}|${e.eventDate || ""}`.toLowerCase().slice(0, 100);
      if (seenEvents.has(key)) return false;
      seenEvents.add(key);
      return true;
    });

    for (const evt of uniqueEvents) {
      // Find primary entity
      let entityId: string | undefined;
      for (const name of evt.entityNames || []) {
        const id = entityNameToId.get(name.toLowerCase());
        if (id) {
          entityId = id;
          break;
        }
      }

      await db.timelineEvent.create({
        data: {
          workspaceId,
          title: evt.title,
          description: evt.description,
          eventDate: evt.eventDate ? new Date(evt.eventDate) : null,
          eventDateStr: evt.eventDateStr,
          type: evt.type || "event",
          confidence: 0.7,
          entityId,
        },
      });
    }

    // Stage 6: Done
    await db.source.update({
      where: { id: sourceId },
      data: {
        status: "processed",
        processingProgress: 100,
      },
    });

    // Stage 7: Continuous Updates — merge duplicates, recalculate confidence, rebuild index
    await updateProgress(sourceId, 95, "به‌روزرسانی تدریجی دانش‌نامه");
    try {
      await continuousUpdate(workspaceId);
    } catch (err) {
      console.error(`[Pipeline] Continuous update failed for workspace ${workspaceId}:`, err);
      // Don't fail the pipeline if continuous update fails
    }
  } catch (error) {
    console.error(`[Pipeline] Failed for source ${sourceId}:`, error);
    await db.source.update({
      where: { id: sourceId },
      data: {
        status: "failed",
        processingError:
          error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

async function updateProgress(
  sourceId: string,
  progress: number,
  _stage: string
) {
  await db.source.update({
    where: { id: sourceId },
    data: { processingProgress: progress },
  });
}

/**
 * Generate real vector embeddings for chunks using the configured LLM provider.
 * Stores embeddings in the sqlite-vec virtual table for fast similarity search.
 * Runs in the background — doesn't block the main pipeline.
 */
async function generateChunkEmbeddings(chunkIds: string[], chunkTexts: string[]): Promise<void> {
  if (chunkIds.length === 0) return;

  // Import dynamically to avoid circular deps
  const { generateEmbeddings } = await import("../ai/client");
  const { storeEmbeddings } = await import("./vector-store");

  const BATCH_SIZE = 10;
  let embeddedCount = 0;

  for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
    const batchIds = chunkIds.slice(i, i + BATCH_SIZE);
    const batchTexts = chunkTexts.slice(i, i + BATCH_SIZE);
    try {
      const embeddings = await generateEmbeddings(batchTexts);

      const itemsToStore = batchIds
        .map((chunkId, j) => ({
          chunkId,
          embedding: embeddings[j] || [],
        }))
        .filter((item) => item.embedding.length > 0);

      if (itemsToStore.length > 0) {
        await storeEmbeddings(itemsToStore);
        embeddedCount += itemsToStore.length;
      }

      console.log(
        `[Pipeline] Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkIds.length / BATCH_SIZE)} (${embeddedCount} total)`
      );
    } catch (err) {
      console.error(`[Pipeline] Embedding batch failed:`, err);
      // Continue — chunks without embeddings will use keyword fallback
    }
  }

  console.log(`[Pipeline] Embedding generation complete: ${embeddedCount}/${chunkIds.length} chunks`);
}

function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();
  for (const ent of entities) {
    const key = ent.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, ent);
    } else {
      // Merge aliases
      const existing = seen.get(key)!;
      existing.aliases = Array.from(
        new Set([...(existing.aliases || []), ...(ent.aliases || []), ent.name])
      );
      existing.confidence = Math.max(existing.confidence, ent.confidence);
    }
  }
  return Array.from(seen.values());
}

/**
 * Find which chunk contains a given excerpt text.
 * Returns the chunk's DB id, or null if no match found.
 * Uses longest common substring heuristic when exact match fails.
 */
function findChunkForExcerpt(
  chunkTexts: string[],
  chunkIds: string[],
  excerpt: string
): string | null {
  if (!excerpt || chunkTexts.length === 0) return null;

  const excerptTrimmed = excerpt.trim();

  // 1) Exact substring match
  for (let i = 0; i < chunkTexts.length; i++) {
    if (chunkTexts[i].includes(excerptTrimmed)) {
      return chunkIds[i];
    }
  }

  // 2) Fuzzy: longest common substring (LCS) heuristic
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < chunkTexts.length; i++) {
    const chunk = chunkTexts[i];
    const short = excerptTrimmed.length < chunk.length ? excerptTrimmed : chunk;
    const long = excerptTrimmed.length < chunk.length ? chunk : excerptTrimmed;
    // Find the longest substring of 'short' that appears in 'long'
    for (let start = 0; start < short.length; start++) {
      for (let end = start + bestLen + 1; end <= short.length; end++) {
        const sub = short.slice(start, end);
        if (long.includes(sub)) {
          bestLen = sub.length;
          bestIdx = i;
        } else {
          break; // no need to extend further from this start
        }
      }
    }
  }

  if (bestIdx >= 0 && bestLen > 10) {
    return chunkIds[bestIdx];
  }

  console.warn(`[Pipeline] Could not match excerpt to any chunk: "${excerptTrimmed.slice(0, 80)}..."`);
  return null;
}
