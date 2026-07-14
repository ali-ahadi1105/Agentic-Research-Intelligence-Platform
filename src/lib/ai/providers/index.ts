/**
 * LLM Provider Registry & Factory
 *
 * Reads configuration from environment variables and creates providers on demand.
 * Supports user-configured providers (stored in DB) that override defaults.
 *
 * Env vars (all optional except default provider key):
 *   LLM_PROVIDER=openai-compatible         (default | openai | anthropic | gemini)
 *   LLM_CHAT_MODEL=gpt-4o-mini             (default chat model)
 *   LLM_EMBEDDING_MODEL=text-embedding-3-small
 *
 * OpenAI-Compatible (DEFAULT):
 *   OPENAI_API_KEY=sk-...
 *   OPENAI_BASE_URL=https://api.openai.com/v1
 *   OPENAI_CHAT_MODEL=gpt-4o-mini
 *   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
 *
 * Anthropic:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
 *
 * Gemini:
 *   GEMINI_API_KEY=AIza...
 *   GEMINI_MODEL=gemini-1.5-pro
 *
 * Embeddings (can be separate from chat provider):
 *   EMBEDDING_API_KEY=...                  (defaults to OPENAI_API_KEY)
 *   EMBEDDING_BASE_URL=https://api.openai.com/v1
 *   EMBEDDING_MODEL=text-embedding-3-small
 */
import "server-only";
import type { LLMProvider, ProviderConfig, ProviderType } from "./types";
export type { LLMProvider, ProviderConfig, ProviderType };
import { OpenAICompatibleProvider } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

/**
 * Get the default provider config from environment variables.
 */
export function getDefaultProviderConfig(): ProviderConfig {
  const type = (process.env.LLM_PROVIDER as ProviderType) || "openai-compatible";

  switch (type) {
    case "anthropic":
      return {
        type: "anthropic",
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        defaultModel: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      };

    case "gemini":
      return {
        type: "gemini",
        apiKey: process.env.GEMINI_API_KEY || "",
        baseUrl: process.env.GEMINI_BASE_URL,
        defaultModel: process.env.GEMINI_MODEL || "gemini-1.5-pro",
        embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
      };

    case "openai":
      return {
        type: "openai-compatible", // OpenAI is a subset of OpenAI-compatible
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        defaultModel: process.env.OPENAI_CHAT_MODEL || process.env.LLM_CHAT_MODEL || "gpt-4o-mini",
        embeddingModel:
          process.env.OPENAI_EMBEDDING_MODEL ||
          process.env.LLM_EMBEDDING_MODEL ||
          "text-embedding-3-small",
      };

    case "openai-compatible":
    default:
      return {
        type: "openai-compatible",
        apiKey: process.env.OPENAI_API_KEY || "",
        baseUrl: process.env.OPENAI_BASE_URL || "http://localhost:8000/v1",
        defaultModel: process.env.OPENAI_CHAT_MODEL || process.env.LLM_CHAT_MODEL || "gpt-4o-mini",
        embeddingModel:
          process.env.OPENAI_EMBEDDING_MODEL ||
          process.env.LLM_EMBEDDING_MODEL ||
          "text-embedding-3-small",
      };
  }
}

/**
 * Get the embedding provider config (can be different from chat provider).
 * Embeddings always go through an OpenAI-compatible API (or Gemini which has its own).
 */
export function getEmbeddingProviderConfig(): ProviderConfig {
  // If a separate embedding endpoint is configured, use it
  if (process.env.EMBEDDING_API_KEY || process.env.EMBEDDING_BASE_URL) {
    return {
      type: "openai-compatible",
      apiKey: process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || "",
      baseUrl: process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1",
      defaultModel: process.env.LLM_CHAT_MODEL || "gpt-4o-mini",
      embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    };
  }

  // Otherwise use the default provider for embeddings
  const defaultConfig = getDefaultProviderConfig();

  // Claude doesn't support embeddings — fall back to OpenAI-compatible
  if (defaultConfig.type === "anthropic") {
    return {
      type: "openai-compatible",
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    };
  }

  return defaultConfig;
}

// Cache provider instances by config hash
const providerCache = new Map<string, LLMProvider>();

function configKey(config: ProviderConfig): string {
  return `${config.type}:${config.apiKey}:${config.baseUrl}:${config.defaultModel}:${config.embeddingModel}`;
}

/**
 * Create or retrieve a cached provider instance.
 */
export function getProvider(config: ProviderConfig): LLMProvider {
  const key = configKey(config);
  let provider = providerCache.get(key);
  if (!provider) {
    switch (config.type) {
      case "anthropic":
        provider = new AnthropicProvider(config);
        break;
      case "gemini":
        provider = new GeminiProvider(config);
        break;
      case "openai-compatible":
      case "openai":
      default:
        provider = new OpenAICompatibleProvider(config);
        break;
    }
    providerCache.set(key, provider);
  }
  return provider;
}

/**
 * Get the default chat provider (from env vars).
 */
export function getDefaultProvider(): LLMProvider {
  return getProvider(getDefaultProviderConfig());
}

/**
 * Get the default embedding provider (from env vars).
 */
export function getDefaultEmbeddingProvider(): LLMProvider {
  return getProvider(getEmbeddingProviderConfig());
}

/**
 * Create a provider from user-supplied config (stored in DB).
 */
export function createUserProvider(config: ProviderConfig): LLMProvider {
  return getProvider(config);
}

/**
 * Check which providers are configured (available) from env vars.
 */
export function getAvailableProviders(): {
  type: ProviderType;
  name: string;
  available: boolean;
  model?: string;
}[] {
  const defaultConfig = getDefaultProviderConfig();
  const embeddingConfig = getEmbeddingProviderConfig();

  const providers: {
    type: ProviderType;
    name: string;
    available: boolean;
    model?: string;
  }[] = [];

  // OpenAI-compatible
  providers.push({
    type: "openai-compatible",
    name: "OpenAI-Compatible",
    available: !!(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  });

  // Anthropic
  providers.push({
    type: "anthropic",
    name: "Anthropic Claude",
    available: !!(process.env.ANTHROPIC_API_KEY),
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
  });

  // Gemini
  providers.push({
    type: "gemini",
    name: "Google Gemini",
    available: !!(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-1.5-pro",
  });

  return providers;
}
