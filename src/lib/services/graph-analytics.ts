/**
 * Graph Analytics Service (per PROJECT.md § 41, 14)
 *
 * Implements graph algorithms in JavaScript as a lightweight alternative
 * to Neo4j. In production, these would be delegated to Neo4j or a
 * dedicated graph database for large-scale analytics.
 *
 * Algorithms:
 *   - Shortest path (BFS)
 *   - Degree centrality (in, out, total)
 *   - Betweenness centrality (simplified)
 *   - Connected components (Union-Find)
 *   - Top influential entities
 */
import "server-only";
import { db } from "../db";

export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  avgDegree: number;
  topEntitiesByDegree: { entityId: string; name: string; type: string; degree: number; inDegree: number; outDegree: number }[];
  topEntitiesByBetweenness: { entityId: string; name: string; betweenness: number }[];
  communities: { id: number; entities: { id: string; name: string; type: string }[] }[];
  isolatedEntities: { id: string; name: string; type: string }[];
}

/**
 * Compute comprehensive graph analytics for a workspace.
 */
export async function computeGraphAnalytics(workspaceId: string): Promise<GraphAnalytics> {
  const [entities, relationships] = await Promise.all([
    db.entity.findMany({
      where: { workspaceId, status: { not: "rejected" } },
      select: { id: true, name: true, type: true },
    }),
    db.relationship.findMany({
      where: { workspaceId, status: { not: "rejected" } },
      select: { id: true, sourceEntityId: true, targetEntityId: true, type: true },
    }),
  ]);

  const nodeCount = entities.length;
  const edgeCount = relationships.length;

  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const e of entities) {
    adjacency.set(e.id, new Set());
    inDegree.set(e.id, 0);
    outDegree.set(e.id, 0);
  }

  for (const r of relationships) {
    if (!adjacency.has(r.sourceEntityId)) adjacency.set(r.sourceEntityId, new Set());
    if (!adjacency.has(r.targetEntityId)) adjacency.set(r.targetEntityId, new Set());
    adjacency.get(r.sourceEntityId)!.add(r.targetEntityId);
    adjacency.get(r.targetEntityId)!.add(r.sourceEntityId); // undirected for centrality
    outDegree.set(r.sourceEntityId, (outDegree.get(r.sourceEntityId) || 0) + 1);
    inDegree.set(r.targetEntityId, (inDegree.get(r.targetEntityId) || 0) + 1);
  }

  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // Degree centrality
  const topByDegree = entities
    .map((e) => ({
      entityId: e.id,
      name: e.name,
      type: e.type,
      degree: (inDegree.get(e.id) || 0) + (outDegree.get(e.id) || 0),
      inDegree: inDegree.get(e.id) || 0,
      outDegree: outDegree.get(e.id) || 0,
    }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 10);

  // Betweenness centrality (simplified — sample-based for performance)
  const betweenness = computeBetweenness(adjacency, entities.map((e) => e.id));
  const topByBetweenness = entities
    .map((e) => ({
      entityId: e.id,
      name: e.name,
      betweenness: betweenness.get(e.id) || 0,
    }))
    .sort((a, b) => b.betweenness - a.betweenness)
    .slice(0, 10);

  // Connected components (Union-Find)
  const communities = findCommunities(adjacency, entities);

  // Isolated entities (no edges)
  const isolatedEntities = entities
    .filter((e) => (adjacency.get(e.id)?.size || 0) === 0)
    .map((e) => ({ id: e.id, name: e.name, type: e.type }));

  const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
  const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;

  return {
    nodeCount,
    edgeCount,
    density,
    avgDegree,
    topEntitiesByDegree: topByDegree,
    topEntitiesByBetweenness: topByBetweenness,
    communities,
    isolatedEntities,
  };
}

/**
 * Find shortest path between two entities using BFS.
 * Returns the sequence of entity IDs and edge types along the path.
 */
export async function findShortestPath(
  workspaceId: string,
  sourceEntityId: string,
  targetEntityId: string
): Promise<{ path: { entityId: string; name: string; type: string }[]; edges: { type: string; direction: "forward" | "backward" }[]; length: number } | null> {
  const relationships = await db.relationship.findMany({
    where: { workspaceId, status: { not: "rejected" } },
    select: { sourceEntityId: true, targetEntityId: true, type: true },
  });

  const entities = await db.entity.findMany({
    where: { workspaceId, status: { not: "rejected" } },
    select: { id: true, name: true, type: true },
  });
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // Build adjacency with edge info
  const adjacency = new Map<string, { neighbor: string; type: string; direction: "forward" | "backward" }[]>();
  for (const e of entities) adjacency.set(e.id, []);
  for (const r of relationships) {
    if (!adjacency.has(r.sourceEntityId)) adjacency.set(r.sourceEntityId, []);
    if (!adjacency.has(r.targetEntityId)) adjacency.set(r.targetEntityId, []);
    adjacency.get(r.sourceEntityId)!.push({ neighbor: r.targetEntityId, type: r.type, direction: "forward" });
    adjacency.get(r.targetEntityId)!.push({ neighbor: r.sourceEntityId, type: r.type, direction: "backward" });
  }

  // BFS
  const visited = new Set<string>([sourceEntityId]);
  const queue: { entityId: string; path: string[]; edges: { type: string; direction: "forward" | "backward" }[] }[] = [
    { entityId: sourceEntityId, path: [sourceEntityId], edges: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.entityId === targetEntityId) {
      return {
        path: current.path.map((id) => ({
          entityId: id,
          name: entityMap.get(id)?.name || "",
          type: entityMap.get(id)?.type || "",
        })),
        edges: current.edges,
        length: current.path.length - 1,
      };
    }

    const neighbors = adjacency.get(current.entityId) || [];
    for (const { neighbor, type, direction } of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          entityId: neighbor,
          path: [...current.path, neighbor],
          edges: [...current.edges, { type, direction }],
        });
      }
    }
  }

  return null; // No path found
}

/**
 * Simplified betweenness centrality using sampling.
 * Full Brandes algorithm is O(VE) — too slow for large graphs.
 * We sample source nodes and compute shortest paths.
 */
function computeBetweenness(adjacency: Map<string, Set<string>>, allNodes: string[]): Map<string, number> {
  const betweenness = new Map<string, number>();
  for (const n of allNodes) betweenness.set(n, 0);

  // Sample up to 20 source nodes for performance
  const sampleSize = Math.min(20, allNodes.length);
  const sample = allNodes.slice(0, sampleSize);

  for (const source of sample) {
    // BFS from source
    const visited = new Set<string>([source]);
    const queue: string[] = [source];
    const paths = new Map<string, string[][]>(); // node -> list of shortest paths

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) || [];

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
          // Increment betweenness for intermediate nodes
          betweenness.set(current, (betweenness.get(current) || 0) + 1);
        }
      }
    }
  }

  return betweenness;
}

/**
 * Find connected components using Union-Find.
 */
function findCommunities(
  adjacency: Map<string, Set<string>>,
  entities: { id: string; name: string; type: string }[]
): { id: number; entities: { id: string; name: string; type: string }[] }[] {
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x);
      rank.set(x, 0);
    }
    const p = parent.get(x)!;
    if (p !== x) {
      parent.set(x, find(p));
    }
    return parent.get(x)!;
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px === py) return;
    const rx = rank.get(px) || 0;
    const ry = rank.get(py) || 0;
    if (rx < ry) {
      parent.set(px, py);
    } else if (rx > ry) {
      parent.set(py, px);
    } else {
      parent.set(py, px);
      rank.set(px, rx + 1);
    }
  }

  for (const e of entities) {
    find(e.id);
  }

  for (const [node, neighbors] of adjacency) {
    for (const neighbor of neighbors) {
      union(node, neighbor);
    }
  }

  const communities = new Map<string, { id: string; name: string; type: string }[]>();
  for (const e of entities) {
    const root = find(e.id);
    if (!communities.has(root)) {
      communities.set(root, []);
    }
    communities.get(root)!.push(e);
  }

  const result = Array.from(communities.entries())
    .map(([root, members], idx) => ({
      id: idx,
      entities: members,
    }))
    .sort((a, b) => b.entities.length - a.entities.length);

  return result;
}
