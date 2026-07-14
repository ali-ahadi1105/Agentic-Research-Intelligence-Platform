import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  badRequest,
  unauthorizedResponse,
  internalError,
  authorizeWorkspace,
  notFound,
} from "@/lib/services/api-helpers";
import { generateResearchPlan } from "@/lib/ai/agents";

/**
 * POST /plan
 * Body: { goal: string, context?: string }
 * Generates a research plan using the Research Planning Agent.
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
    const { goal, context } = body;

    if (!goal) return badRequest("goal لازم است");

    // Use workspace research goal as fallback
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, researchGoal: true, description: true },
    });

    const finalGoal = goal || workspace?.researchGoal || workspace?.name || "";
    const finalContext = context || workspace?.description || undefined;

    const plan = await generateResearchPlan(finalGoal, finalContext);

    return ok(plan);
  } catch (err) {
    console.error("[Plan API] POST error:", err);
    return internalError();
  }
}
