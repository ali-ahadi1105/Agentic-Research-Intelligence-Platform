import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  badRequest,
  unauthorizedResponse,
  internalError,
  notFound,
} from "@/lib/services/api-helpers";
import { can } from "@/lib/services/permissions";
import {
  listPrompts,
  listPromptVersions,
  updatePrompt,
  rollbackPrompt,
} from "@/lib/prompts/store";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.prompts")) {
      return notFound("دسترسی غیرمجاز");
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      // List all versions of a specific prompt
      const versions = await listPromptVersions(key);
      return ok(versions);
    }

    // List all active prompts
    const prompts = await listPrompts();
    return ok(prompts);
  } catch (err) {
    console.error("[Prompts API] GET error:", err);
    return internalError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.prompts")) {
      return notFound("دسترسی غیرمجاز");
    }

    const body = await request.json();
    const { key, systemPrompt, description, temperature, maxTokens, action, version } = body;

    if (action === "rollback") {
      if (!key || !version) return badRequest("key و version لازم است");
      const result = await rollbackPrompt(key, version);
      return ok(result);
    }

    if (!key) return badRequest("key لازم است");

    const result = await updatePrompt(
      key,
      {
        systemPrompt,
        description,
        temperature,
        maxTokens,
      },
      auth.userId
    );

    // Log
    await db.auditLog.create({
      data: {
        userId: auth.userId,
        organizationId: auth.organizationId,
        action: "model_change",
        resourceType: "prompt",
        resourceId: result.id,
        details: JSON.stringify({ key, version: result.version }),
      },
    });

    return ok(result);
  } catch (err) {
    console.error("[Prompts API] PATCH error:", err);
    return internalError();
  }
}
