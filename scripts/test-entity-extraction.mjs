/**
 * Test: Entity extraction covers all chunks.
 *
 * Verifies that pipeline.ts no longer limits entity extraction
 * to `.slice(0, 3)` — all chunks are processed.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pipelinePath = join(__dirname, "..", "src", "lib", "services", "pipeline.ts");
const source = readFileSync(pipelinePath, "utf-8");

let passed = 0;
let failed = 0;

// Test 1: No `.slice(0, 3)` in entity extraction loop
console.log("1. Entity extraction loop...");
const entityExtractionSection = source.match(
  /Stage 2: Entity extraction[\s\S]*?Deduplicate by name/
)?.[0];
if (entityExtractionSection) {
  const hasSlice0to3 = entityExtractionSection.includes(".slice(0, 3)");
  if (hasSlice0to3) {
    console.log("   ❌ FAIL: .slice(0, 3) still present in entity extraction");
    failed++;
  } else {
    console.log("   ✅ PASS: No .slice(0, 3) limit in entity extraction");
    passed++;
  }
} else {
  console.log("   ❌ FAIL: Could not find entity extraction section");
  failed++;
}

// Test 2: The loop uses `for (const chunk of chunks)` (all chunks)
console.log("2. Loop iterates over all chunks...");
const loopMatch = entityExtractionSection?.match(/for \(const chunk of chunks\)/);
if (loopMatch) {
  console.log("   ✅ PASS: Loop iterates over all chunks (no slice)");
  passed++;
} else {
  console.log("   ❌ FAIL: Loop does not iterate full chunks");
  failed++;
}

// Test 3: All stages still present (regression check)
console.log("3. Pipeline stages unchanged...");
const stages = ["Stage 2: Entity", "Stage 3: Claim", "Stage 4: Relationship", "Stage 5: Timeline"];
for (const stage of stages) {
  if (source.includes(stage)) {
    console.log(`   ✅ Found: ${stage.split(":")[0].trim()}`);
    passed++;
  } else {
    console.log(`   ❌ Missing: ${stage}`);
    failed++;
  }
}

// Test 4: chunkText still used for splitting
console.log("4. Dependencies present...");
const deps = ["chunkText", "extractEntities", "extractClaims", "extractRelationships", "extractTimelineEvents"];
for (const dep of deps) {
  if (source.includes(dep)) {
    console.log(`   ✅ Uses: ${dep}`);
    passed++;
  } else {
    console.log(`   ⚠️  Missing: ${dep} (may have been refactored)`);
    failed++;
  }
}

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
