/**
 * Web Search Service
 *
 * Sources (tiered):
 *   1. Wikipedia API (FREE, no key)  — research/encyclopedic
 *   2. arXiv API (FREE, no key)      — academic papers
 *   3. Tavily (free 1000/mo)          — general web search (needs TAVILY_API_KEY)
 */

import "server-only";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}

// ============================================================
// Tier 1: Wikipedia (FREE, no API key, generous rate limit)
// ============================================================

async function searchWikipedia(query: string, num: number = 5): Promise<WebSearchResult[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${num}&format=json&origin=*`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ResearchBot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.search || []).map((r: any) => ({
      title: r.title || "",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title || "")}`,
      snippet: r.snippet?.replace(/<[^>]*>/g, "") || "",
      source: "wikipedia",
    }));
  } catch (err) {
    console.warn("[WebSearch] Wikipedia failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ============================================================
// Tier 2: arXiv (FREE, no API key — academic papers)
// ============================================================

async function searchArxiv(query: string, num: number = 5): Promise<WebSearchResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${num}&sortBy=relevance`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ResearchBot/1.0", Accept: "application/xml" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parse
    const results: WebSearchResult[] = [];
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries.slice(0, num)) {
      const title = entry.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() || "";
      const id = entry.match(/<id[^>]*>([^<]*)<\/id>/)?.[1]?.trim() || "";
      const summary = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";
      const published = entry.match(/<published[^>]*>([^<]*)<\/published>/)?.[1]?.trim();

      if (title && id) {
        results.push({
          title,
          url: id,
          snippet: summary.replace(/\s+/g, " ").slice(0, 300),
          source: "arxiv",
          publishedDate: published,
        });
      }
    }
    return results;
  } catch (err) {
    console.warn("[WebSearch] arXiv failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ============================================================
// Tier 3: Tavily (API key required, free quota available)
// ============================================================

async function searchTavily(query: string, num: number = 5): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  try {
    const tavily = await import("@tavily/core");
    const client = tavily.tavily({ apiKey });
    const response = await client.search(query, {
      maxResults: num,
      searchDepth: "basic",
    });

    return (response.results || []).map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      snippet: String(r.content || r.snippet || ""),
      source: "tavily",
      publishedDate: r.publishedDate || undefined,
    }));
  } catch (err) {
    console.warn("[WebSearch] Tavily failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ============================================================
// Tier 4: Direct web page fetch (for follow-up reading)
// ============================================================

async function searchDirectFetch(query: string, num: number = 5): Promise<WebSearchResult[]> {
  try {
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: WebSearchResult[] = [];

    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || "",
        snippet: data.AbstractText.slice(0, 500),
        source: "duckduckgo",
      });
    }

    const topics = data.RelatedTopics || [];
    for (const t of topics) {
      if (results.length >= num) break;
      if (t.Text && t.FirstURL) {
        results.push({
          title: t.Text.split(" - ")[0] || t.Text,
          url: t.FirstURL,
          snippet: t.Text,
          source: "duckduckgo",
        });
      }
      if (t.Topics) {
        for (const sub of t.Topics) {
          if (results.length >= num) break;
          if (sub.Text && sub.FirstURL) {
            results.push({
              title: sub.Text.split(" - ")[0] || sub.Text,
              url: sub.FirstURL,
              snippet: sub.Text,
              source: "duckduckgo",
            });
          }
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ============================================================
// Unified Search API
// ============================================================

/**
 * Web search with tiered fallback.
 * Tries multiple free sources first, then falls back to Tavily.
 */
export async function webSearch(
  query: string,
  num: number = 5
): Promise<WebSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  // Tier 1: Wikipedia (best for research)
  let results = await searchWikipedia(query, num);
  if (results.length >= num) {
    return results.slice(0, num);
  }

  // Tier 2: arXiv (academic)
  if (results.length < num) {
    const arxiv = await searchArxiv(query, num - results.length);
    results = [...results, ...arxiv];
  }

  // Tier 3: DuckDuckGo Instant Answers
  if (results.length < num) {
    const ddg = await searchDirectFetch(query, num - results.length);
    results = [...results, ...ddg];
  }

  // Tier 4: Tavily (requires API key)
  if (results.length < 3) {
    const tavily = await searchTavily(query, num);
    // Only use Tavily results if they add value
    const existingUrls = new Set(results.map((r) => r.url));
    for (const r of tavily) {
      if (!existingUrls.has(r.url) && results.length < num) {
        results.push(r);
        existingUrls.add(r.url);
      }
    }
  }

  return results.slice(0, num);
}

// ============================================================
// Page Content Extraction
// ============================================================

/**
 * Read a web page and extract its text content.
 */
export async function readWebPage(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || url;

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    return { title, text };
  } catch (err) {
    console.warn(`[WebSearch] Failed to read page:`, err instanceof Error ? err.message : err);
    return null;
  }
}
