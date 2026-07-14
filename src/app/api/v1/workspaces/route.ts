import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  created,
  badRequest,
  unauthorizedResponse,
  internalError,
} from "@/lib/services/api-helpers";
import { AuditLog } from "@/lib/services/audit";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const workspaces = await db.workspace.findMany({
      where: {
        organizationId: auth.organizationId,
        status,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            sources: true,
            entities: true,
            claims: true,
            reports: true,
          },
        },
      },
    });

    return ok(workspaces);
  } catch (err) {
    console.error("[Workspaces API] GET error:", err);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { name, description, researchGoal, color, tags } = body;

    if (!name || !name.trim()) {
      return badRequest("نام workspace لازم است");
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0600-\u06ff-]/g, "")
      .slice(0, 50);

    // Ensure uniqueness
    const existing = await db.workspace.findFirst({
      where: { organizationId: auth.organizationId, slug },
    });
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

    const workspace = await db.workspace.create({
      data: {
        organizationId: auth.organizationId,
        name: name.trim(),
        slug: finalSlug,
        description: description || null,
        researchGoal: researchGoal || null,
        color: color || null,
        tags: JSON.stringify(tags || []),
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "create",
      resourceType: "workspace",
      resourceId: workspace.id,
      details: { name: workspace.name },
    });

    return created(workspace);
  } catch (err) {
    console.error("[Workspaces API] POST error:", err);
    return internalError();
  }
}
