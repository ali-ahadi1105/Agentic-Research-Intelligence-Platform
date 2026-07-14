/**
 * OpenAI-Compatible Provider (DEFAULT)
 *
 * Works with any API that follows the OpenAI schema:
 *   - OpenAI official API
 *   - vLLM (https://docs.vllm.ai/)
 *   - Ollama (https://ollama.ai/) with OpenAI compatibility
 *   - LocalAI (https://localai.io/)
 *   - LM Studio
 *   - Together AI, Anyscale, etc.
 *
 * Env vars:
 *   LLM_PROVIDER=openai-compatible
 *   OPENAI_API_KEY=...
 *   OPENAI_BASE_URL=https://api.openai.com/v1   (or custom)
 *   OPENAI_CHAT_MODEL=gpt-4o-mini               (or custom)
 *   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
 *
 *   EMBEDDING_API_KEY=...                        (optional, separate key for embeddings)
 *   EMBEDDING_BASE_URL=https://api.openai.com/v1 (optional, separate endpoint)
 *   EMBEDDING_MODEL=text-embedding-3-small       (optional, alias)
 */
import "server-only";
import type {
  LLMProvider,
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./types";

export class OpenAICompatibleProvider implements LLMProvider {
  readonly type = "openai-compatible" as const;
  readonly name: string;

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private embeddingModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
    this.embeddingModel = config.embeddingModel || "text-embedding-3-small";
    this.name = config.label || `OpenAI-Compatible (${this.baseUrl})`;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isAvailable()) {
      throw new Error("OpenAI-compatible provider not configured: missing API key");
    }

    const model = request.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 2000,
      stream: request.stream === true ? true : false,  // explicit false to avoid forced SSE
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI-compatible chat failed (${response.status}): ${errorText.slice(0, 500)}`
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      // Server still sent SSE despite stream:false — read it manually
      const text = await response.text();
      let fullContent = "";
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch {}
        }
      }
      if (!fullContent) {
        throw new Error("Received empty response from OpenAI-compatible streaming provider");
      }
      return { content: fullContent, model };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content || "";
    if (!content) {
      throw new Error("Received empty response from OpenAI-compatible provider");
    }

    return {
      content,
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: choice?.finish_reason,
    };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.isAvailable()) {
      throw new Error("OpenAI-compatible provider not configured: missing API key");
    }

    const model = request.model || this.embeddingModel;
    const input = Array.isArray(request.input) ? request.input : [request.input];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model, input }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI-compatible embeddings failed (${response.status}): ${errorText.slice(0, 500)}`
      );
    }

    const data = await response.json();
    const embeddings = (data.data || [])
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((d: { embedding: number[] }) => d.embedding);

    return {
      embeddings,
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
