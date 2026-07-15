/**
 * Auto Research Agent (Module 8 — Research Automation)
 *
 * Orchestrates web search → page reading → source creation → pipeline extraction.
 */
import "server-only";
import { db } from "../db";
import { webSearch, readWebPage } from "./web-search";
import { processSourceKnowledge } from "./pipeline";
import { chatCompletion } from "../ai/client";
import { PROMPTS } from "../prompts/templates";

export interface AutoResearchResult {
  totalSearches: number;
  totalResults: number;
  pagesRead: number;
  sourcesCreated: number;
  summary: string;
}

// ============================================================
// Phase 1: Generate search queries from research goal
// ============================================================

async function generateSearchQueries(
  goal: string,
  existingEntities: string[]
): Promise<string[]> {
  const entityContext =
    existingEntities.length > 0
      ? `Existing knowledge entities: ${existingEntities.slice(0, 10).join(", ")}`
      : "";

  const response = await chatCompletion({
    messages: [
      {
        role: "system",
        content: `You are a research strategist. Based on a research goal, generate 3-5 diverse search queries that would find relevant information.

Each query should:
- Be specific and targeted
- Cover different aspects of the topic
- Include Persian terms where appropriate
- Be suitable for web search

Return ONLY a JSON array of strings, nothing else.`,
      },
      {
        role: "user",
        content: `Research goal: ${goal}
${entityContext}

Generate 3-5 diverse search queries to find relevant information.`,
      },
    ],
    temperature: 0.7,
    maxTokens: 500,
  });

  try {
    const cleaned = response
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const queries = JSON.parse(cleaned);
    return Array.isArray(queries) ? queries.slice(0, 5) : [goal];
  } catch {
    // Fallback: split by newlines or return the goal itself
    return response
      .split("\n")
      .map((l) => l.replace(/^\d+[.\)]\s*/, "").trim())
      .filter((l) => l.length > 5)
      .slice(0, 5)
      .concat([goal])
      .slice(0, 5);
  }
}

// ============================================================
// Phase 2: Rank and filter search results
// ============================================================

interface RankedResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
}

function rankResults(
  results: { title: string; url: string; snippet: string; source: string }[],
  goal: string
): RankedResult[] {
  const goalLower = goal.toLowerCase();
  const goalWords = goalLower.split(/\s+/).filter((w) => w.length > 2);

  return results
    .map((r) => {
      let score = 0;
      const titleLower = r.title.toLowerCase();
      const snippetLower = r.snippet.toLowerCase();

      // Title match gives higher score
      for (const word of goalWords) {
        if (titleLower.includes(word)) score += 3;
        if (snippetLower.includes(word)) score += 1;
      }

      // Prefer .org, .edu, .gov sources
      try {
        const hostname = new URL(r.url).hostname;
        if (hostname.endsWith(".edu")) score += 2;
        if (hostname.endsWith(".gov")) score += 2;
        if (hostname.endsWith(".org")) score += 1;
      } catch {}

      // Avoid duplicates
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);
}

// ============================================================
// Phase 3: Create sources from web pages
// ============================================================

async function createSourceFromPage(
  workspaceId: string,
  url: string,
  title: string,
  text: string
): Promise<string | null> {
  try {
    // Check for duplicate source
    const existing = await db.source.findFirst({
      where: { workspaceId, sourceUrl: url, status: { not: "error" } },
    });
    if (existing) {
      console.log(`[AutoResearch] Source already exists: ${url}`);
      return existing.id;
    }

    // Create source first
    const source = await db.source.create({
      data: {
        workspaceId,
        title: title.slice(0, 500),
        sourceUrl: url,
        type: "web",
        status: "pending",
        mimeType: "text/html",
      },
    }).catch((err) => {
      console.error(`[AutoResearch] Failed to create source for ${url}:`, err);
      return null;
    });

    if (!source) return null;

    // Then create document linked to source
    await db.document.create({
      data: {
        sourceId: source.id,
        content: text.slice(0, 50000),
      },
    }).catch((err) => {
      console.error(`[AutoResearch] Failed to create document for ${url}:`, err);
      return null;
    });

    console.log(`[AutoResearch] Created source: ${source.id} — ${title.slice(0, 50)}`);
    return source.id;
  } catch (err) {
    console.error(`[AutoResearch] Error creating source for ${url}:`, err);
    return null;
  }
}

// ============================================================
// Main: Run Automated Research
// ============================================================

/**
 * Run automated research on a workspace.
 *
 * @param workspaceId - Target workspace
 * @param goal - Optional override for the research goal
 * @param maxQueries - Max search queries to run (default 3)
 * @param maxPages - Max pages to read and process (default 5)
 * @returns Summary of what was accomplished
 */
export async function runAutoResearch(
  workspaceId: string,
  goal?: string,
  maxQueries: number = 3,
  maxPages: number = 5
): Promise<AutoResearchResult> {
  const startTime = Date.now();

  // Get workspace info
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true, researchGoal: true },
  });

  const researchGoal = goal || workspace?.researchGoal || "تحقیق عمومی";
  console.log(`[AutoResearch] Starting for "${workspace?.name || workspaceId}"`);
  console.log(`[AutoResearch] Goal: ${researchGoal}`);

  // Get existing entity names for context
  const existingEntities = await db.entity.findMany({
    where: { workspaceId, status: "confirmed" },
    select: { name: true },
    take: 10,
    orderBy: { confidence: "desc" },
  });

  // Phase 1: Generate search queries
  const queries = await generateSearchQueries(
    researchGoal,
    existingEntities.map((e) => e.name)
  );
  console.log(`[AutoResearch] Generated ${queries.length} queries`);

  // Phase 2: Search for each query
  const allResults: { title: string; url: string; snippet: string; source: string }[] = [];
  for (const q of queries.slice(0, maxQueries)) {
    const results = await webSearch(q, 8);
    allResults.push(...results);
    console.log(`[AutoResearch] Query "${q.slice(0, 40)}..." → ${results.length} results`);
  }

  // Remove duplicates
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Phase 3: Rank results
  const ranked = rankResults(uniqueResults, researchGoal);
  const topResults = ranked.slice(0, maxPages + 2);
  console.log(`[AutoResearch] Total unique: ${uniqueResults.length}, top: ${topResults.length}`);

  // Phase 4: Read top pages and create sources
  const processedUrls = new Set<string>();
  let sourcesCreated = 0;

  for (const result of topResults) {
    if (sourcesCreated >= maxPages) break;
    if (processedUrls.has(result.url)) continue;
    processedUrls.add(result.url);

    try {
      const page = await readWebPage(result.url);
      if (!page || !page.text || page.text.length < 100) {
        console.log(`[AutoResearch] Page too short: ${result.url}`);
        continue;
      }

      const sourceId = await createSourceFromPage(
        workspaceId,
        result.url,
        page.title || result.title,
        page.text
      );

      if (sourceId) {
        sourcesCreated++;
        // Process through pipeline (don't await - let it run in background)
        processSourceKnowledge(sourceId).catch((err) => {
          console.error(`[AutoResearch] Pipeline error for ${sourceId}:`, err);
        });
      }
    } catch (err) {
      console.error(`[AutoResearch] Failed to process ${result.url}:`, err);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    totalSearches: queries.length,
    totalResults: uniqueResults.length,
    pagesRead: processedUrls.size,
    sourcesCreated,
    summary: `تحقیق خودکار در ${elapsed} ثانیه انجام شد. ${queries.length} جستجو انجام شد، ${uniqueResults.length} نتیجه منحصربه‌فرد یافت شد، ${processedUrls.size} صفحه خوانده شد و ${sourcesCreated} منبع جدید ایجاد شد. پردازش این منابع (استخراج موجودیت و ادعا) در پس‌زمینه ادامه دارد.`,
  };
}
