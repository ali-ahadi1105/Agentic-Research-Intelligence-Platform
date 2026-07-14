import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  ok,
  created,
  badRequest,
  unauthorizedResponse,
  internalError,
  notFound,
} from "@/lib/services/api-helpers";
import { can } from "@/lib/services/permissions";
import { getAvailableProviders } from "@/lib/ai/providers";
import { AuditLog } from "@/lib/services/audit";
import { isDefaultProviderConfigured } from "@/lib/services/user-provider";

/**
 * GET /api/v1/admin/model-providers
 * Returns:
 *   - envProviders: providers configured via environment variables
 *   - userProviders: providers configured by the user (stored in DB)
 *   - defaultConfigured: whether the default (env) provider has an API key
 */
export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.settings")) {
      return notFound("دسترسی غیرمجاز");
    }

    const [userProviders, envProviders, defaultConfigured] = await Promise.all([
      db.modelProvider.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          label: true,
          type: true,
          baseUrl: true,
          chatModel: true,
          embeddingModel: true,
          isActive: true,
          isDefault: true,
          useForChat: true,
          useForEmbeddings: true,
          createdAt: true,
          // Don't return apiKey for security — only a masked version
        },
      }),
      Promise.resolve(getAvailableProviders()),
      Promise.resolve(isDefaultProviderConfigured()),
    ]);

    return ok({
      envProviders,
      userProviders: userProviders.map((p) => ({
        ...p,
        apiKeyMasked: "••••••••", // Never expose the actual key
      })),
      defaultConfigured,
    });
  } catch (err) {
    console.error("[Model Providers API] GET error:", err);
    return internalError();
  }
}

/**
 * POST /api/v1/admin/model-providers
 * Create a new user-configured model provider.
 * Body: {
 *   label, type, apiKey, baseUrl?, chatModel, embeddingModel?,
 *   isDefault?, useForChat?, useForEmbeddings?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) return unauthorizedResponse();

    if (!can(auth, "admin.settings")) {
      return notFound("دسترسی غیرمجاز");
    }

    const body = await request.json();
    const {
      label,
      type,
      apiKey,
      baseUrl,
      chatModel,
      embeddingModel,
      isDefault,
      useForChat = true,
      useForEmbeddings = false,
    } = body;

    if (!label || !type || !apiKey || !chatModel) {
      return badRequest("label, type, apiKey و chatModel لازم است");
    }

    const validTypes = ["openai-compatible", "openai", "anthropic", "gemini"];
    if (!validTypes.includes(type)) {
      return badRequest(`type باید یکی از ${validTypes.join(", ")} باشد`);
    }

    // If this is being set as default, unset other defaults
    if (isDefault) {
      await db.modelProvider.updateMany({
        where: { organizationId: auth.organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await db.modelProvider.create({
      data: {
        organizationId: auth.organizationId,
        label,
        type,
        apiKey,
        baseUrl: baseUrl || null,
        chatModel,
        embeddingModel: embeddingModel || null,
        isActive: true,
        isDefault: isDefault || false,
        useForChat,
        useForEmbeddings,
        createdBy: auth.userId,
      },
    });

    await AuditLog.log({
      userId: auth.userId,
      organizationId: auth.organizationId,
      action: "model_change",
      resourceType: "model_provider",
      resourceId: provider.id,
      details: { label, type, chatModel },
    });

    return created({
      ...provider,
      apiKeyMasked: "••••••••",
    });
  } catch (err) {
    console.error("[Model Providers API] POST error:", err);
    return internalError();
  }
}
