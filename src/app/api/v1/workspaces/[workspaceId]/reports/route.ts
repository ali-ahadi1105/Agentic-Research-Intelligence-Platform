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
import { generateReport, type ReportContext } from "@/lib/ai/agents";
import { AuditLog } from "@/lib/services/audit";
import { semanticSearch } from "@/lib/services/semantic-search";

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

    const reports = await db.report.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return ok(reports);
  } catch (err) {
    console.error("[Reports API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /reports
 * Body: { type: "executive_summary" | "company_report" | ... }
 * Generates a new report from current workspace knowledge.
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
    const { type = "executive_summary", title } = body;

    // Build report context from current knowledge base
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, researchGoal: true },
    });

    const [entities, relationships, claims, timelineEvents, sources] = await Promise.all([
      db.entity.findMany({
        where: { workspaceId, status: { not: "rejected" } },
        select: { name: true, type: true, description: true },
        take: 30,
        orderBy: { confidence: "desc" },
      }),
      db.relationship.findMany({
        where: { workspaceId, status: { not: "rejected" } },
        select: {
          sourceEntity: { select: { name: true } },
          targetEntity: { select: { name: true } },
          type: true,
          confidence: true,
        },
        take: 30,
      }),
      db.claim.findMany({
        where: { workspaceId, status: { not: "rejected" } },
        select: { statement: true, confidence: true, status: true },
        take: 30,
        orderBy: { confidence: "desc" },
      }),
      db.timelineEvent.findMany({
        where: { workspaceId },
        select: { title: true, description: true, eventDate: true },
        orderBy: { eventDate: "asc" },
        take: 20,
      }),
      db.source.findMany({
        where: { workspaceId },
        select: { title: true, type: true },
        take: 30,
      }),
    ]);

    // Get evidence samples
    const evidence = await db.evidence.findMany({
      where: { claim: { workspaceId } },
      select: {
        excerpt: true,
        source: { select: { title: true } },
      },
      take: 15,
      orderBy: { createdAt: "desc" },
    });

    // Fetch relevant chunks for richer context
    const query = workspace?.researchGoal || type.replace(/_/g, " ");
    const similarChunks = await semanticSearch(workspaceId, query, 5).catch(() => []);

    const reportContext: ReportContext = {
      workspaceName: workspace?.name || "نامشخص",
      researchGoal: workspace?.researchGoal || "",
      entities: entities.map((e) => ({
        name: e.name,
        type: e.type,
        description: e.description,
      })),
      relationships: relationships.map((r) => ({
        source: r.sourceEntity.name,
        target: r.targetEntity.name,
        type: r.type,
        confidence: r.confidence,
      })),
      claims: claims.map((c) => ({
        statement: c.statement,
        confidence: c.confidence,
        status: c.status,
      })),
      evidence: evidence.map((e) => ({
        excerpt: e.excerpt,
        sourceTitle: e.source?.title || "منبع نامشخص",
      })),
      timelineEvents: timelineEvents.map((t) => ({
        title: t.title,
        description: t.description,
        eventDate: t.eventDate ? t.eventDate.toISOString() : null,
      })),
      sources: sources.map((s) => ({ title: s.title, type: s.type })),
      relevantChunks: similarChunks.map((ch) => ({
        content: ch.content,
        sourceTitle: ch.sourceTitle || "بدون عنوان",
        score: ch.score,
      })),
    };

    const contentMarkdown = await generateReport(type, reportContext);

    const report = await db.report.create({
      data: {
        workspaceId,
        title: title || `گزارش ${type.replace(/_/g, " ")} — ${new Date().toLocaleDateString("fa-IR")}`,
        type,
        contentMarkdown,
        contentJson: JSON.stringify(reportContext),
        status: "generated",
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "report",
      resourceId: report.id,
      details: { type },
    });

    return created(report);
  } catch (err) {
    console.error("[Reports API] POST error:", err);
    return internalError();
  }
}
