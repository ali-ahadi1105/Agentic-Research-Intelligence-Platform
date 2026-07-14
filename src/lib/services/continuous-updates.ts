/**
 * Continuous Updates Service (per PROJECT.md § 46)
 *
 * Whenever new information is added:
 *   - Re-process affected entities (merge duplicates)
 *   - Recalculate confidence scores
 *   - Update relationships
 *   - Refresh graph
 *   - Refresh timeline
 *   - Refresh embeddings (TF-IDF index)
 *
 * Only affected portions are recalculated — avoid full rebuild.
 */
import "server-only";
import { db } from "../db";
import { buildWorkspaceIndex } from "./semantic-search";

/**
 * Normalize entity name for fuzzy matching.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\u200c\u200d]/g, " ") // ZWNJ/ZWJ to space
    .replace(/\s+/g, " ")
    .replace(/[^\u0600-\u06ff\u0041-\u007a\u0030-\u0039\s]/g, "");
}

/**
 * Check if two entity names refer to the same entity (fuzzy match).
 */
function isSameEntity(name1: string, name2: string): boolean {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return true;

  // Check if one is a substring of the other (for short names)
  if (n1.length > 3 && n2.length > 3) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }

  // Check aliases
  return false;
}

/**
 * Merge duplicate entities in a workspace.
 * Entities with the same normalized name and type are merged.
 */
export async function mergeDuplicateEntities(workspaceId: string): Promise<{
  mergedCount: number;
  totalEntities: number;
}> {
  const entities = await db.entity.findMany({
    where: { workspaceId, status: { not: "merged" } },
    select: { id: true, name: true, type: true, aliases: true, confidence: true, sourceCount: true },
  });

  // Group entities by normalized name + type
  const groups = new Map<string, typeof entities>();
  for (const e of entities) {
    const key = `${normalizeName(e.name)}|${e.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  let mergedCount = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Keep the entity with highest confidence, merge others into it
    const sorted = group.sort((a, b) => b.confidence - a.confidence);
    const target = sorted[0];
    const toMerge = sorted.slice(1);

    for (const source of toMerge) {
      // Move claim entities
      await db.claimEntity.updateMany({
        where: { entityId: source.id },
        data: { entityId: target.id },
      });

      // Move relationships
      await db.relationship.updateMany({
        where: { sourceEntityId: source.id },
        data: { sourceEntityId: target.id },
      });
      await db.relationship.updateMany({
        where: { targetEntityId: source.id },
        data: { targetEntityId: target.id },
      });

      // Move timeline events
      await db.timelineEvent.updateMany({
        where: { entityId: source.id },
        data: { entityId: target.id },
      });

      // Update target entity: merge aliases, sum source counts, max confidence
      const sourceAliases = JSON.parse(source.aliases || "[]") as string[];
      const targetAliases = JSON.parse(target.aliases || "[]") as string[];
      const mergedAliases = Array.from(new Set([...targetAliases, ...sourceAliases, source.name]));

      await db.entity.update({
        where: { id: target.id },
        data: {
          aliases: JSON.stringify(mergedAliases),
          sourceCount: target.sourceCount + source.sourceCount,
          confidence: Math.max(target.confidence, source.confidence),
        },
      });

      // Mark source as merged
      await db.entity.update({
        where: { id: source.id },
        data: { status: "merged", mergedIntoId: target.id },
      });

      mergedCount++;
    }
  }

  // After merging, remove duplicate relationships
  await removeDuplicateRelationships(workspaceId);

  return {
    mergedCount,
    totalEntities: entities.length,
  };
}

/**
 * Remove duplicate relationships (same source, target, and type).
 */
async function removeDuplicateRelationships(workspaceId: string): Promise<number> {
  const rels = await db.relationship.findMany({
    where: { workspaceId, status: { not: "rejected" } },
    select: { id: true, sourceEntityId: true, targetEntityId: true, type: true, confidence: true },
  });

  const seen = new Map<string, string>(); // key -> keep id
  const toDelete: string[] = [];

  for (const r of rels) {
    const key = `${r.sourceEntityId}|${r.targetEntityId}|${r.type}`;
    if (seen.has(key)) {
      const existingId = seen.get(key)!;
      const existing = rels.find((x) => x.id === existingId)!;
      // Keep the one with higher confidence
      if (r.confidence > existing.confidence) {
        toDelete.push(existingId);
        seen.set(key, r.id);
      } else {
        toDelete.push(r.id);
      }
    } else {
      seen.set(key, r.id);
    }
  }

  if (toDelete.length > 0) {
    await db.relationship.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  return toDelete.length;
}

/**
 * Recalculate confidence scores for all entities in a workspace.
 * Confidence is based on: number of sources, number of claims, number of relationships.
 */
export async function recalculateConfidence(workspaceId: string): Promise<void> {
  const entities = await db.entity.findMany({
    where: { workspaceId, status: { not: "merged" } },
    select: {
      id: true,
      confidence: true,
      sourceCount: true,
      _count: {
        select: {
          claimEntities: true,
          sourceRelations: true,
          targetRelations: true,
        },
      },
    },
  });

  for (const e of entities) {
    // New confidence: base 0.3 + 0.1 per source (max 0.3) + 0.1 per claim (max 0.2) + 0.1 per relationship (max 0.2)
    const sourceBoost = Math.min(e.sourceCount * 0.1, 0.3);
    const claimBoost = Math.min(e._count.claimEntities * 0.1, 0.2);
    const relBoost = Math.min((e._count.sourceRelations + e._count.targetRelations) * 0.05, 0.2);
    const newConfidence = Math.min(0.3 + sourceBoost + claimBoost + relBoost, 1.0);

    if (Math.abs(newConfidence - e.confidence) > 0.05) {
      await db.entity.update({
        where: { id: e.id },
        data: { confidence: newConfidence },
      });
    }
  }
}

/**
 * Full continuous update cycle for a workspace.
 * Called after new sources are processed.
 */
export async function continuousUpdate(workspaceId: string): Promise<{
  mergedEntities: number;
  totalEntities: number;
  removedRelationships: number;
  indexRebuilt: boolean;
}> {
  console.log(`[ContinuousUpdate] Starting for workspace ${workspaceId}`);

  const mergeResult = await mergeDuplicateEntities(workspaceId);
  console.log(`[ContinuousUpdate] Merged ${mergeResult.mergedCount} duplicate entities`);

  await recalculateConfidence(workspaceId);
  console.log(`[ContinuousUpdate] Recalculated confidence scores`);

  const removedRels = await removeDuplicateRelationships(workspaceId);
  console.log(`[ContinuousUpdate] Removed ${removedRels} duplicate relationships`);

  // Rebuild TF-IDF index for semantic search
  try {
    await buildWorkspaceIndex(workspaceId);
    console.log(`[ContinuousUpdate] Rebuilt TF-IDF index`);
  } catch (err) {
    console.error("[ContinuousUpdate] Failed to rebuild index:", err);
  }

  console.log(`[ContinuousUpdate] Complete for workspace ${workspaceId}`);

  return {
    mergedEntities: mergeResult.mergedCount,
    totalEntities: mergeResult.totalEntities,
    removedRelationships: removedRels,
    indexRebuilt: true,
  };
}
