/**
 * Anthropic Claude Provider
 *
 * Env vars:
 *   ANTHROPIC_API_KEY=...
 *   ANTHROPIC_MODEL=claude-3-5-sonnet-20241022   (optional)
 *
 * Note: Claude doesn't have a native embeddings API — embeddings fall back to
 * the OpenAI-compatible provider (set EMBEDDING_API_KEY / EMBEDDING_BASE_URL).
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

export class AnthropicProvider implements LLMProvider {
  readonly type = "anthropic" as const;
  readonly name: string;

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "claude-3-5-sonnet-20241022";
    this.name = config.label || "Anthropic Claude";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isAvailable()) {
      throw new Error("Anthropic provider not configured: missing API key");
    }

    const model = request.model || this.defaultModel;

    // Claude separates system from user/assistant messages
    const systemMsg = request.messages.find((m) => m.role === "system");
    const conversationMsgs = request.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model,
      messages: conversationMsgs,
      max_tokens: request.maxTokens ?? 2000,
      temperature: request.temperature ?? 0.3,
    };
    if (systemMsg) body.system = systemMsg.content;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Anthropic chat failed (${response.status}): ${errorText.slice(0, 500)}`
      );
    }

    const data = await response.json();
    const content = (data.content || [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("");

    return {
      content,
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined,
      finishReason: data.stop_reason,
    };
  }

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new Error(
      "Anthropic Claude does not provide an embeddings API. Configure a separate EMBEDDING_API_KEY with an OpenAI-compatible provider."
    );
  }
}
