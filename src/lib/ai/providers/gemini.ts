/**
 * Google Gemini Provider
 *
 * Env vars:
 *   GEMINI_API_KEY=...
 *   GEMINI_MODEL=gemini-1.5-pro   (optional)
 *
 * Note: Gemini has its own embeddings API (text-embedding-004).
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

export class GeminiProvider implements LLMProvider {
  readonly type = "gemini" as const;
  readonly name: string;

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private embeddingModel: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "gemini-1.5-pro";
    this.embeddingModel = config.embeddingModel || "text-embedding-004";
    this.name = config.label || "Google Gemini";
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.isAvailable()) {
      throw new Error("Gemini provider not configured: missing API key");
    }

    const model = request.model || this.defaultModel;

    // Convert OpenAI-style messages to Gemini format
    const systemMsg = request.messages.find((m) => m.role === "system");
    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 2000,
      },
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const response = await fetch(
      `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini chat failed (${response.status}): ${errorText.slice(0, 500)}`);
    }

    const data = await response.json();
    const content = (data.candidates?.[0]?.content?.parts || [])
      .map((p: { text: string }) => p.text)
      .join("");

    return {
      content,
      model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.isAvailable()) {
      throw new Error("Gemini provider not configured: missing API key");
    }

    const model = request.model || this.embeddingModel;
    const input = Array.isArray(request.input) ? request.input : [request.input];

    // Gemini embeddings API takes one request at a time for text-embedding-004,
    // but supports batch via "requests" for newer models. We do sequential for simplicity.
    const embeddings: number[][] = [];
    for (const text of input) {
      const response = await fetch(
        `${this.baseUrl}/v1beta/models/${model}:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text }] },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini embed failed (${response.status}): ${errorText.slice(0, 500)}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding?.values || []);
    }

    return {
      embeddings,
      model,
    };
  }
}
