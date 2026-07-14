/**
 * User Provider Service
 *
 * Resolves which LLM provider to use for a given organization.
 * Priority:
 *   1. Organization's default ModelProvider (from DB, if marked isDefault)
 *   2. Environment variables (OPENAI_API_KEY, etc.)
 *
 * This allows per-organization provider configuration while keeping
 * environment variables as the system-wide fallback.
 */
import "server-only";
import { db } from "../db";
import { getDefaultProviderConfig, getEmbeddingProviderConfig } from "../ai/providers";
import type { ProviderConfig } from "../ai/providers/types";

/**
 * Get the chat provider config for an organization.
 * Falls back to env vars if no user-configured provider exists.
 */
export async function getChatProviderConfig(organizationId: string): Promise<ProviderConfig> {
  const userProvider = await db.modelProvider.findFirst({
    where: {
      organizationId,
      isActive: true,
      useForChat: true,
      OR: [{ isDefault: true }, { isDefault: false }],
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (userProvider) {
    return {
      id: userProvider.id,
      type: userProvider.type as ProviderConfig["type"],
      apiKey: userProvider.apiKey,
      baseUrl: userProvider.baseUrl || undefined,
      defaultModel: userProvider.chatModel,
      embeddingModel: userProvider.embeddingModel || undefined,
      label: userProvider.label,
      isActive: userProvider.isActive,
    };
  }

  return getDefaultProviderConfig();
}

/**
 * Get the embedding provider config for an organization.
 * Falls back to env vars if no user-configured provider exists.
 */
export async function getEmbeddingProviderConfigForOrg(
  organizationId: string
): Promise<ProviderConfig> {
  const userProvider = await db.modelProvider.findFirst({
    where: {
      organizationId,
      isActive: true,
      useForEmbeddings: true,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (userProvider) {
    return {
      id: userProvider.id,
      type: userProvider.type as ProviderConfig["type"],
      apiKey: userProvider.apiKey,
      baseUrl: userProvider.baseUrl || undefined,
      defaultModel: userProvider.chatModel,
      embeddingModel: userProvider.embeddingModel || undefined,
      label: userProvider.label,
      isActive: userProvider.isActive,
    };
  }

  return getEmbeddingProviderConfig();
}

/**
 * Check if the default provider (from env) is configured.
 */
export function isDefaultProviderConfigured(): boolean {
  const config = getDefaultProviderConfig();
  return !!config.apiKey;
}

/**
 * Check if embeddings are available (either env or user-configured).
 */
export async function areEmbeddingsAvailable(organizationId: string): Promise<boolean> {
  const userProvider = await db.modelProvider.findFirst({
    where: {
      organizationId,
      isActive: true,
      useForEmbeddings: true,
    },
  });

  if (userProvider) return true;

  const envConfig = getEmbeddingProviderConfig();
  return !!envConfig.apiKey;
}
