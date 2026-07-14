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
 * GET /stats
 * Returns aggregated statistics for the workspace dashboard.
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

    const [
      sourceCount,
      entityCount,
      relationshipCount,
      claimCount,
      evidenceCount,
      timelineCount,
      reportCount,
      conversationCount,
      pendingClaims,
      verifiedClaims,
      rejectedClaims,
      sourceStats,
      entityByType,
      recentActivity,
    ] = await Promise.all([
      db.source.count({ where: { workspaceId } }),
      db.entity.count({ where: { workspaceId } }),
      db.relationship.count({ where: { workspaceId } }),
      db.claim.count({ where: { workspaceId } }),
      db.evidence.count({ where: { claim: { workspaceId } } }),
      db.timelineEvent.count({ where: { workspaceId } }),
      db.report.count({ where: { workspaceId } }),
      db.conversation.count({ where: { workspaceId } }),
      db.claim.count({ where: { workspaceId, status: "pending" } }),
      db.claim.count({ where: { workspaceId, status: "verified" } }),
      db.claim.count({ where: { workspaceId, status: "rejected" } }),
      db.source.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: true,
      }),
      db.entity.groupBy({
        by: ["type"],
        where: { workspaceId },
        _count: true,
      }),
      db.source.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          processingProgress: true,
          createdAt: true,
        },
      }),
    ]);

    return ok({
      counts: {
        sources: sourceCount,
        entities: entityCount,
        relationships: relationshipCount,
        claims: claimCount,
        evidence: evidenceCount,
        timeline: timelineCount,
        reports: reportCount,
        conversations: conversationCount,
      },
      claims: {
        pending: pendingClaims,
        verified: verifiedClaims,
        rejected: rejectedClaims,
      },
      sourceStats,
      entityByType,
      recentActivity,
    });
  } catch (err) {
    console.error("[Stats API] GET error:", err);
    return internalError();
  }
}
