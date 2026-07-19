#!/usr/bin/env node

/**
 * Pre-download the Xenova/all-MiniLM-L6-v2 model into the local Hugging Face
 * Transformers.js cache so the app does not need to fetch it at runtime.
 *
 * Usage:
 *   node scripts/download-embeddings-model.mjs
 *
 * The model will be cached under ~/.cache/huggingface/transformers/ (or
 * $HF_CACHE if set).
 *
 * If huggingface.co is blocked in your network, set the HF_ENDPOINT env var
 * to a mirror, e.g.:
 *   HF_ENDPOINT=https://hf-mirror.com node scripts/download-embeddings-model.mjs
 */

import { pipeline, env } from "@xenova/transformers";
import path from "path";
import { homedir } from "os";

// ── Configuration (mirrors what local-embeddings.ts does) ──────────────
env.allowLocalModels = true;
env.allowRemoteModels = true;

const cacheDir = process.env.HF_CACHE || path.join(homedir(), ".cache", "huggingface", "transformers");
env.cacheDir = cacheDir;

if (process.env.HF_ENDPOINT) {
  env.remoteHost = process.env.HF_ENDPOINT;
  env.remotePathTemplate = "{model}/resolve/main/{file}";
}
// ────────────────────────────────────────────────────────────────────────

const MODEL = "Xenova/all-MiniLM-L6-v2";

async function main() {
  console.log(`[download-model] Pre-downloading "${MODEL}"…`);
  console.log(`[download-model]   cacheDir  : ${env.cacheDir}`);
  console.log(`[download-model]   remoteHost: ${env.remoteHost}`);

  const extractor = await pipeline("feature-extraction", MODEL);

  // Run a tiny inference to make sure weights are fully loaded
  const test = await extractor("Hello world", {
    pooling: "mean",
    normalize: true,
  });

  console.log(`[download-model] ✓ Model downloaded & cached. Embedding dimension: ${test.data.length}`);
  console.log(`[download-model] ✓ Cache location: ${cacheDir}`);
}

main().catch((err) => {
  console.error("[download-model] Failed:", err.message);
  process.exitCode = 1;
});
