/**
 * Re-export shared types for the AI client module.
 */
import type { ChatMessage } from "./types";
export type { ChatMessage };

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  thinking?: boolean;
}
