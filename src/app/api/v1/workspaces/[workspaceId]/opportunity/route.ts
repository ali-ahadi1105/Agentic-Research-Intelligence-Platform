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
import { generateOpportunityAnalysis, type OpportunityContext } from "@/lib/ai/agents";
import { AuditLog } from "@/lib/services/audit";

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  organization_fit: "تناسب سازمانی",
  investment_fit: "تناسب سرمایه‌گذاری",
  collaboration: "فرصت همکاری",
  entry_strategy: "استراتژی ورود",
  risk_analysis: "تحلیل ریسک",
  swot: "تحلیل SWOT",
  pitch: "پیشنهاد پیچ",
  decision_makers: "تصمیم‌گیرندگان",
  general: "تحلیل عمومی",
};

/**
 * GET /api/v1/workspaces/[workspaceId]/opportunity
 * List all opportunity analyses in the workspace.
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

    const analyses = await db.opportunity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return ok(analyses);
  } catch (err) {
    console.error("[Opportunity API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /api/v1/workspaces/[workspaceId]/opportunity
 * Body: { type: "organization_fit" | "investment_fit" | ... }
 * Generates a new opportunity analysis from current workspace knowledge.
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
    const { type = "general", title } = body;

    const validTypes = ["organization_fit", "investment_fit", "collaboration", "entry_strategy", "risk_analysis", "swot", "pitch", "decision_makers", "general"];
    if (!validTypes.includes(type)) {
      return badRequest(`نوع تحلیل نامعتبر است. انواع مجاز: ${validTypes.join(", ")}`);
    }

    // Build context from current knowledge base
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

    const analysisContext: OpportunityContext = {
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
    };

    const contentMarkdown = await generateOpportunityAnalysis(type, analysisContext);

    const analysis = await db.opportunity.create({
      data: {
        workspaceId,
        title: title || `تحلیل ${OPPORTUNITY_TYPE_LABELS[type] || type} — ${new Date().toLocaleDateString("fa-IR")}`,
        type,
        summary: contentMarkdown.split("\n").slice(0, 3).join(" ").slice(0, 300),
        contentMarkdown,
        contentJson: JSON.stringify(analysisContext),
        status: "generated",
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "opportunity",
      resourceId: analysis.id,
      details: { type },
    });

    return created(analysis);
  } catch (err) {
    console.error("[Opportunity API] POST error:", err);
    return internalError();
  }
}

/**
 * GET /api/v1/workspaces/[workspaceId]/opportunity/[id]
 * Get a single opportunity analysis.
 */
export async function getById(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; id: string }> }
) {
  // Handled by the catch-all route pattern
  return internalError();
}
