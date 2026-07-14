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
import { can } from "@/lib/services/permissions";
import { continuousUpdate } from "@/lib/services/continuous-updates";

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

    if (!can(auth, "entity.merge")) {
      return notFound("دسترسی غیرمجاز");
    }

    const result = await continuousUpdate(workspaceId);

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        organizationId: auth.organizationId,
        action: "update",
        resourceType: "workspace",
        resourceId: workspaceId,
        details: JSON.stringify({ action: "continuous_update", ...result }),
      },
    });

    return ok({
      ...result,
      message: `ادغام ${result.mergedEntities} موجودیت تکراری، حذف ${result.removedRelationships} رابطه تکراری، بازسازی ایندکس`,
    });
  } catch (err) {
    console.error("[Continuous Update API] POST error:", err);
    return internalError();
  }
}
