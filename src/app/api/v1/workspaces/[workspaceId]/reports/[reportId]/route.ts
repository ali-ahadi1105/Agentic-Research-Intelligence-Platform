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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; reportId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, reportId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    const report = await db.report.findUnique({
      where: { id: reportId },
    });

    if (!report || report.workspaceId !== workspaceId) {
      return notFound("Report");
    }

    return ok(report);
  } catch (err) {
    console.error("[Report API] GET error:", err);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; reportId: string }> }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();
    const { workspaceId, reportId } = await params;

    const ws = await authorizeWorkspace(workspaceId, auth);
    if (!ws) return notFound("Workspace");

    await db.report.delete({ where: { id: reportId } });
    return ok({ deleted: true });
  } catch (err) {
    console.error("[Report API] DELETE error:", err);
    return internalError();
  }
}
