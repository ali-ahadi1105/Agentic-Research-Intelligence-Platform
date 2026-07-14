/**
 * LLM Provider Types (per PROJECT.md § 47, 68)
 *
 * Model-agnostic architecture. No business logic should depend on a specific LLM vendor.
 * Supported providers:
 *   - openai-compatible (DEFAULT): any OpenAI-compatible API (vLLM, Ollama, LocalAI, etc.)
 *   - openai: official OpenAI API
 *   - anthropic: Claude models
 *   - gemini: Google Gemini models
 */

export type ProviderType = "openai-compatible" | "openai" | "anthropic" | "gemini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  readonly type: ProviderType;
  readonly name: string;

  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  isAvailable(): boolean;
}

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  // Optional user-specific config (stored in DB)
  id?: string;
  label?: string;
  isActive?: boolean;
}
