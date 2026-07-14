import { pipeline, env } from "@xenova/transformers";

// Ensure we don't look for models in the local filesystem by default
env.allowLocalModels = false;

let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
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
