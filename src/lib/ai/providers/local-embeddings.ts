import { pipeline, env } from "@xenova/transformers";
import path from "path";

// ── Transformers.js configuration ─────────────────────────────────────────
// Allow loading models from local cache (under ~/.cache/huggingface/transformers/)
env.allowLocalModels = true;

// Keep remote downloads enabled as a fallback (will fail if blocked, but tries)
env.allowRemoteModels = true;

// Explicitly set the cache directory so it's visible and predictable
const HF_CACHE = process.env.HF_CACHE || path.join(process.env.HOME || "/tmp", ".cache", "huggingface", "transformers");
env.cacheDir = HF_CACHE;

// For environments where huggingface.co is blocked, set a mirror via env:
//   HF_ENDPOINT=https://hf-mirror.com
if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT;
  env.remotePathTemplate = "{model}/resolve/main/{file}";
}
// ─────────────────────────────────────────────────────────────────────────

let extractor: any = null;

/**
 * Get (or initialise) the feature-extraction pipeline.
 * The model is loaded from local cache first; if missing it will attempt a
 * remote download (which may fail in restricted networks — pre-download via
 * `scripts/download-embeddings-model.mjs` to avoid that).
 */
async function getExtractor() {
  if (!extractor) {
    console.log("[LocalEmbeddings] Loading feature-extraction pipeline (Xenova/all-MiniLM-L6-v2)…");
    console.log(`[LocalEmbeddings]   cacheDir  : ${env.cacheDir}`);
    console.log(`[LocalEmbeddings]   remoteHost: ${env.remoteHost}`);
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("[LocalEmbeddings] Pipeline loaded successfully.");
  }
  return extractor;
}

/**
 * Generate a local embedding for a single text using Transformers.js.
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
  try {
    const extract = await getExtractor();
    const output = await extract(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  } catch (error) {
    console.error("[LocalEmbeddings] Failed to generate local embedding:", error);
    throw error;
  }
}

/**
 * Generate local embeddings for a batch of texts using Transformers.js.
 */
export async function generateLocalEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const extract = await getExtractor();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const output = await extract(text, {
        pooling: "mean",
        normalize: true,
      });
      embeddings.push(Array.from(output.data));
    }
    return embeddings;
  } catch (error) {
    console.error("[LocalEmbeddings] Failed to generate batch local embeddings:", error);
    throw error;
  }
}
