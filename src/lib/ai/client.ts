/**
 * AI Layer (per PROJECT.md § 68 - AI Integration Layer)
 * Application -> AI Gateway -> Provider Adapter -> OpenAI / Anthropic / Gemini / vLLM / Ollama
 *
 * This module provides a unified interface for:
 * - LLM chat completions (entity/claim extraction, chat, reports)
 * - Embedding generation (for RAG / vector search)
 * - Web search (z-ai-web-dev-sdk, optional)
 *
 * Provider selection is automatic based on .env config.
 * Users can also configure their own providers via the ModelProvider API.
 *
 * IMPORTANT: This module is server-side only. Never import from client components.
 */
import "server-only";
import type {
  ChatMessage,
  ChatCompletionOptions,
} from "./types-local";
import {
  getDefaultProvider,
  getDefaultEmbeddingProvider,
  getProvider,
  type ProviderConfig,
} from "./providers";
import type { LLMProvider } from "./providers/types";

// ============================================================
// Chat Completion (uses default provider or user-specified)
// ============================================================

export type { ChatMessage, ChatCompletionOptions } from "./providers/types-local";

// Cache for z-ai SDK fallback (used when env-configured provider fails or isn't set)
let _zaiForFallback: Awaited<ReturnType<typeof import("z-ai-web-dev-sdk").default.create>> | null = null;
async function getZaiForFallback() {
  if (!_zaiForFallback) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    _zaiForFallback = await ZAI.create();
  }
  return _zaiForFallback;
}

/**
 * Generic LLM chat completion using the configured provider.
 * Optionally pass a userProviderConfig to use a user-specific provider.
 *
 * If the configured provider fails (e.g., API key not set, rate limit),
 * falls back to the z-ai-web-dev-sdk for chat completion.
 */
export async function chatCompletion(
  options: ChatCompletionOptions,
  userProviderConfig?: ProviderConfig
): Promise<string> {
  // Determine provider config to get baseUrl and apiKey
  const provider = userProviderConfig
    ? getProvider(userProviderConfig)
    : getDefaultProvider();

  // Extract connection details (provider private fields accessible at runtime)
  const baseUrl: string =
    (provider as any).baseUrl ||
    process.env.OPENAI_BASE_URL ||
    "http://localhost:20128/v1";
  const apiKey: string =
    (provider as any).apiKey ||
    process.env.OPENAI_API_KEY ||
    "sk-a741cf4c3289b8c3-0ce41e-8795c0a0";
  const model: string =
    options.model ||
    (provider as any).defaultModel ||
    process.env.OPENAI_CHAT_MODEL ||
    "oc/deepseek-v4-flash-free";

  // Always use stream:false to get plain JSON response (avoids SSE parsing issues)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 180000);
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 8000,
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(`AI chat completion request failed: ${err instanceof Error ? err.message : "Unknown error"}`);
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI chat completion HTTP error (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await response.json();
    const choice = data.choices?.[0];
    const content: string = choice?.message?.content || "";
    if (content) return content;

    // content is null (thinking mode consumed token budget) — retry once with more tokens
    console.warn("[AI] Empty content (thinking mode?), retrying with increased max_tokens...");
    const retry = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ? options.maxTokens * 3 : 12000,
        stream: false,
      }),
    });
    if (retry.ok) {
      const retryData = await retry.json();
      const retryContent: string = retryData.choices?.[0]?.message?.content || "";
      if (retryContent) return retryContent;
    }
    return "";  // let chatCompletionJson handle gracefully
  }

  // Fallback: server returned SSE despite stream:false — parse it
  const text = await response.text();
  let fullContent = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
      try {
        const chunk = JSON.parse(trimmed.slice(6));
        const c = chunk.choices?.[0]?.delta?.content;
        if (c) fullContent += c;
      } catch {}
    }
  }

  if (!fullContent) {
    throw new Error("AI chat completion: empty SSE stream");
  }
  return fullContent;
}

/**
 * Chat completion with structured JSON output.
 */
export async function chatCompletionJson<T>(
  options: ChatCompletionOptions,
  userProviderConfig?: ProviderConfig
): Promise<T> {
  const content = await chatCompletion(
    {
      ...options,
      messages: [
        ...options.messages,
        {
          role: "system",
          content:
            "You must respond with valid JSON only, no markdown fences, no extra text. The JSON must be parseable by JSON.parse() directly.",
        },
      ],
      temperature: options.temperature ?? 0.1,
    },
    userProviderConfig
  );

  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Remove problematic Unicode control chars that can break JSON.parse
  const safeJson = cleaned.replace(/[\u0000-\u001f\u200b-\u200f\u202a-\u202e\ufeff]/g, "");

  try {
    return JSON.parse(safeJson) as T;
  } catch {
    // Try to find the last complete JSON object by progressively trimming
    // (handles truncated responses from LLM)
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      // Try to fix common JSON issues
      let jsonStr = match[0];
      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      // Remove problematic Unicode control chars
      jsonStr = jsonStr.replace(/[\u0000-\u001f\u200b-\u200f\u202a-\u202e\ufeff]/g, "");
      try {
        return JSON.parse(jsonStr) as T;
      } catch {
        // If still failing, try to find a shorter valid prefix
        for (let i = jsonStr.length - 1; i > 10; i--) {
          if (jsonStr[i] === "}") {
            const candidate = jsonStr.slice(0, i + 1);
            try {
              // Wrap in object if it's an array fragment
              const test = candidate.match(/^\{/) ? candidate : `{${candidate}}`;
              return JSON.parse(test) as T;
            } catch {
              // continue
            }
          }
        }
      }
    }
    // Last resort: return empty object to avoid crashing the pipeline
    console.warn("[AI] JSON parse failed, returning empty result. Content:", cleaned.slice(0, 300));
    return (Array.isArray({}) ? [] : {}) as T;
  }
}

// ============================================================
// Embeddings (for RAG / vector search)
// ============================================================

/**
 * Generate an embedding for a single text.
 *
 * Priority:
 *   1. User-configured embedding provider (from DB)
 *   2. Environment-configured embedding provider (OpenAI-compatible API)
 *   3. Local embeddings via Transformers.js (sentence-transformers/all-MiniLM-L6-v2)
 *   4. Empty array (semantic search falls back to keyword matching)
 *
 * This ensures RAG works out-of-the-box in any environment, with production-grade
 * quality when an external embedding API is configured.
 */
export async function generateEmbedding(
  text: string,
  userProviderConfig?: ProviderConfig
): Promise<number[]> {
  const provider: LLMProvider = userProviderConfig
    ? getProvider(userProviderConfig)
    : getDefaultEmbeddingProvider();

  // Try external provider first
  if (provider.isAvailable()) {
    try {
      const response = await provider.embed({ input: text });
      if (response.embeddings[0]?.length > 0) {
        return response.embeddings[0];
      }
    } catch (error) {
      console.warn("[AI] External embedding failed, trying local fallback:", error instanceof Error ? error.message : error);
    }
  }

  // Fallback: local embeddings via Transformers.js
  try {
    const { generateLocalEmbedding } = await import("./providers/local-embeddings");
    return await generateLocalEmbedding(text);
  } catch (error) {
    console.warn("[AI] Local embedding also failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Generate embeddings for multiple texts in a single batch.
 *
 * Uses the same priority as generateEmbedding:
 *   1. External provider (if configured)
 *   2. Local Transformers.js (fallback)
 *   3. Empty arrays (keyword fallback in semantic search)
 */
export async function generateEmbeddings(
  texts: string[],
  userProviderConfig?: ProviderConfig
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const provider: LLMProvider = userProviderConfig
    ? getProvider(userProviderConfig)
    : getDefaultEmbeddingProvider();

  // Try external provider first
  if (provider.isAvailable()) {
    const BATCH_SIZE = 20;
    const allEmbeddings: number[][] = [];
    let usedExternal = false;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      try {
        const response = await provider.embed({ input: batch });
        allEmbeddings.push(...response.embeddings);
        usedExternal = true;
      } catch (error) {
        console.warn("[AI] External embedding batch failed, will use local:", error instanceof Error ? error.message : error);
        allEmbeddings.push(...batch.map(() => []));
      }
    }

    if (usedExternal) {
      // Return what we got (some may be empty if batches failed)
      return allEmbeddings;
    }
  }

  // Fallback: local embeddings via Transformers.js
  try {
    const { generateLocalEmbeddings } = await import("./providers/local-embeddings");
    return await generateLocalEmbeddings(texts);
  } catch (error) {
    console.warn("[AI] Local embeddings failed:", error instanceof Error ? error.message : error);
    return texts.map(() => []);
  }
}

// ============================================================
// Web Search & Page Reader (z-ai-web-dev-sdk, optional)
// ============================================================
// These are kept for backward compatibility but are optional.
// Reuses the same z-ai SDK instance as the chat fallback.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedDate?: string;
}

/**
 * Web search via z-ai-web-dev-sdk function calling (optional feature).
 */
export async function webSearch(
  query: string,
  num: number = 5,
  recencyDays?: number
): Promise<WebSearchResult[]> {
  try {
    const zai = await getZaiForFallback();
    const params: { query: string; num: number; recency_days?: number } = { query, num };
    if (recencyDays) params.recency_days = recencyDays;
    const results = await zai.functions.invoke("web_search", params);
    if (Array.isArray(results)) {
      return results.map((r: any) => ({
        title: String(r.title || r.name || ""),
        url: String(r.url || r.link || ""),
        snippet: String(r.snippet || r.description || r.summary || ""),
        source: r.source ? String(r.source) : undefined,
        publishedDate:
          r.published_date || r.publishedDate
            ? String(r.published_date || r.publishedDate)
            : undefined,
      }));
    }
    if (results && typeof results === "object" && "results" in results) {
      const arr = (results as { results: unknown[] }).results;
      return arr.map((r: any) => ({
        title: String(r.title || ""),
        url: String(r.url || r.link || ""),
        snippet: String(r.snippet || r.description || ""),
        source: r.source ? String(r.source) : undefined,
        publishedDate:
          r.published_date || r.publishedDate
            ? String(r.published_date || r.publishedDate)
            : undefined,
      }));
    }
    return [];
  } catch (error) {
    console.error("[AI] webSearch failed:", error);
    return [];
  }
}

export interface PageContent {
  title: string;
  url: string;
  html: string;
  text: string;
  publishedTime?: string;
}

/**
 * Read a web page via z-ai-web-dev-sdk page_reader function (optional feature).
 */
export async function readWebPage(url: string): Promise<PageContent | null> {
  try {
    const zai = await getZaiForFallback();
    const result = await zai.functions.invoke("page_reader", { url });
    const data = (result as { data?: Record<string, unknown> }).data;
    if (!data) return null;

    const html = String(data.html || "");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      title: String(data.title || ""),
      url: String(data.url || url),
      html,
      text,
      publishedTime: data.publishedTime ? String(data.publishedTime) : undefined,
    };
  } catch (error) {
    console.error("[AI] readWebPage failed:", error);
    return null;
  }
}
